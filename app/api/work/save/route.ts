// app/api/work/save/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// ─────────────────────────────────────────────────────────────────
// UTC helpers (same convention as the rest of the project)
// "8:40" → stored as 08:40 UTC → isoToHHMM uses getUTCHours() to read it back
// ─────────────────────────────────────────────────────────────────
function toMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function timeStrToUTC(timeStr: string, midnightUTC: Date): Date {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(
    midnightUTC.getUTCFullYear(),
    midnightUTC.getUTCMonth(),
    midnightUTC.getUTCDate(),
    h, m, 0, 0
  ));
}

// ── POST /api/work/save ────────────────────────────────────────
//
// Body:
// {
//   entryTime:         "HH:MM" | null
//   exitTime:          "HH:MM" | null
//   breaks:            Array<{ start: "HH:MM", end: "HH:MM", type, label? }>
//   notes:             string
//   requiredWorkHours: number | null   ← per-day override
//                        number = set override for TODAY only
//                        null   = clear override (revert to profile default)
//                        omit   = leave existing override unchanged
// }
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    await connectDB();

    const user = await User.findById(decoded.userId).select("defaultWorkHours");
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      entryTime,
      exitTime,
      breaks,
      notes,
      // requiredWorkHours sent by the new UI:
      //   number  → save as per-day override
      //   null    → clear override (use profile default)
      //   undefined → don't change the existing override
      requiredWorkHours: requiredWorkHoursFromBody,
    } = body;

    const now           = new Date();
    const todayMidnight = toMidnightUTC(now);

    // ── Holiday guard ──────────────────────────────────────────
    const existing = await WorkLog.findOne({
      userId: decoded.userId,
      date:   todayMidnight,
    }).select("isHoliday requiredWorkHoursOverride").lean();

    if ((existing as any)?.isHoliday) {
      return NextResponse.json(
        {
          success: false,
          message: "Today is marked as a holiday. Remove the holiday first before logging work.",
        },
        { status: 403 }
      );
    }

    // ── Resolve per-day override ───────────────────────────────
    // Priority: body value (if explicitly sent) > existing stored override
    let resolvedOverride: number | null;

    if (requiredWorkHoursFromBody === undefined) {
      // Caller did not send the field — preserve whatever is stored
      resolvedOverride = (existing as any)?.requiredWorkHoursOverride ?? null;
    } else if (requiredWorkHoursFromBody === null) {
      // Caller explicitly cleared the override
      resolvedOverride = null;
    } else {
      // Caller set a specific override value
      resolvedOverride = Number(requiredWorkHoursFromBody);
    }

    // Effective hours used for calculation and stored in requiredWorkHours
    const effectiveHours: number =
      resolvedOverride != null ? resolvedOverride : (user.defaultWorkHours ?? 8.5);

    // ── Build Date objects ─────────────────────────────────────
    const entryDate = entryTime ? timeStrToUTC(entryTime, todayMidnight) : null;
    const exitDate  = exitTime  ? timeStrToUTC(exitTime,  todayMidnight) : null;

    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s   = timeStrToUTC(b.start, todayMidnight);
        const e   = timeStrToUTC(b.end,   todayMidnight);
        const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
        return { start: s, end: e, duration: dur, type: b.type || "custom", label: b.label || "" };
      });

    const totalBreakTime = parsedBreaks.reduce(
      (acc: number, b: any) => acc + b.duration, 0
    );

    let totalOfficeTime = 0;
    let productiveTime  = 0;
    if (entryDate && exitDate && exitDate > entryDate) {
      totalOfficeTime = Math.floor((exitDate.getTime() - entryDate.getTime()) / 1000);
      productiveTime  = Math.max(0, totalOfficeTime - totalBreakTime);
    }

    // ── Upsert ────────────────────────────────────────────────
    const workLog = await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: todayMidnight },
      {
        $set: {
          entryTime:                 entryDate,
          exitTime:                  exitDate,
          breaks:                    parsedBreaks,
          totalBreakTime,
          totalOfficeTime,
          productiveTime,
          requiredWorkHoursOverride: resolvedOverride,
          requiredWorkHours:         effectiveHours,
          notes:                     notes || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Work log saved successfully",
      data: {
        requiredWorkHoursOverride: workLog.requiredWorkHoursOverride,
        requiredWorkHours:         workLog.requiredWorkHours,
        productiveTime:            workLog.productiveTime,
        totalOfficeTime:           workLog.totalOfficeTime,
        totalBreakTime:            workLog.totalBreakTime,
      },
    });

  } catch (error: any) {
    console.error("SAVE WORK LOG ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}