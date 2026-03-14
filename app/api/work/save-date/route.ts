// app/api/work/save-date/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// ─────────────────────────────────────────────────────────────────
// Server-side access rules (mirror UI constants exactly)
//
// VIEW   → no restriction (handled client-side, this API is write-only)
// ADD    → new log allowed for dates up to 90 days ago
// EDIT   → updating existing log allowed only within 30 days
//          dates 31–90 days ago: only allowed if no log exists yet (one-time add)
// ─────────────────────────────────────────────────────────────────
const EDIT_WINDOW  = 30;
const ENTRY_WINDOW = 90;

function timeStrToUTC(timeStr: string, midnightUTC: Date): Date {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(
    midnightUTC.getUTCFullYear(),
    midnightUTC.getUTCMonth(),
    midnightUTC.getUTCDate(),
    h, m, 0, 0
  ));
}

function daysDiff(dateStr: string, todayStr: string): number {
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [fy, fm, fd] = dateStr.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// POST /api/work/save-date
// Body:
// {
//   date:              "YYYY-MM-DD"
//   entryTime:         "HH:MM" | null
//   exitTime:          "HH:MM" | null
//   breaks:            Array<{ start, end, type, label? }>
//   notes:             string
//   requiredWorkHours: number | null | undefined
//                        number    = set per-day override
//                        null      = clear override (use profile default)
//                        undefined = preserve existing override
// }
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    await connectDB();

    const user = await User.findById(decoded.userId).select("defaultWorkHours");
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      date, entryTime, exitTime, breaks, notes,
      requiredWorkHours: requiredWorkHoursFromBody,
    } = body;

    // ── Validate date format ───────────────────────────────────
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, message: "Invalid date. Use YYYY-MM-DD" }, { status: 400 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (date > todayStr) {
      return NextResponse.json({ success: false, message: "Cannot log work for a future date" }, { status: 400 });
    }

    const age = daysDiff(date, todayStr); // how many days ago

    // ── Enforce ENTRY_WINDOW ───────────────────────────────────
    // Dates older than 90 days: absolutely no writes
    if (age > ENTRY_WINDOW) {
      return NextResponse.json(
        { success: false, message: `Cannot log work more than ${ENTRY_WINDOW} days in the past` },
        { status: 400 }
      );
    }

    const [y, mo, d] = date.split("-").map(Number);
    const midnight   = new Date(Date.UTC(y, mo - 1, d));

    // ── Fetch existing record ──────────────────────────────────
    const existing = await WorkLog.findOne({
      userId: decoded.userId,
      date:   midnight,
    }).select("isHoliday requiredWorkHoursOverride").lean() as any;

    // ── Holiday guard ──────────────────────────────────────────
    if (existing?.isHoliday) {
      return NextResponse.json(
        { success: false, message: "This date is marked as a holiday. Remove the holiday first." },
        { status: 403 }
      );
    }

    // ── Enforce EDIT_WINDOW ────────────────────────────────────
    // Dates 31–90 days ago:
    //   • If a log already exists → REJECT (one-time add was already used, or it was added in edit window)
    //   • If no log exists → ALLOW (this is the one-time add)
    if (age > EDIT_WINDOW && existing) {
      return NextResponse.json(
        {
          success: false,
          message: `Logs older than ${EDIT_WINDOW} days cannot be edited. This log was already saved and is now locked.`,
        },
        { status: 403 }
      );
    }
    // age <= EDIT_WINDOW → full read/write as normal

    // ── Resolve per-day required hours override ────────────────
    let resolvedOverride: number | null;

    if (requiredWorkHoursFromBody === undefined) {
      resolvedOverride = existing?.requiredWorkHoursOverride ?? null;
    } else if (requiredWorkHoursFromBody === null) {
      resolvedOverride = null;
    } else {
      resolvedOverride = Number(requiredWorkHoursFromBody);
    }

    const effectiveHours: number =
      resolvedOverride != null ? resolvedOverride : (user.defaultWorkHours ?? 8.5);

    // ── Build Date objects ─────────────────────────────────────
    const entryDate = entryTime ? timeStrToUTC(entryTime, midnight) : null;
    const exitDate  = exitTime  ? timeStrToUTC(exitTime,  midnight) : null;

    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s   = timeStrToUTC(b.start, midnight);
        const e   = timeStrToUTC(b.end,   midnight);
        const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
        return { start: s, end: e, duration: dur, type: b.type || "custom", label: b.label || "" };
      });

    const totalBreakTime = parsedBreaks.reduce((a: number, b: any) => a + b.duration, 0);

    let totalOfficeTime = 0;
    let productiveTime  = 0;
    if (entryDate && exitDate && exitDate > entryDate) {
      totalOfficeTime = Math.floor((exitDate.getTime() - entryDate.getTime()) / 1000);
      productiveTime  = Math.max(0, totalOfficeTime - totalBreakTime);
    }

    const workLog = await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: midnight },
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
    console.error("SAVE DATE LOG ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}