// app/api/work/save/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// ─────────────────────────────────────────────────────────────────
// THE FIX
// ─────────────────────────────────────────────────────────────────
// OLD (BROKEN):
//   d.setHours(h, m, 0, 0)
//   → setHours uses LOCAL server time.
//   → e.g. server in IST (+5:30): "8:40" → 8:40 IST → stored as 3:10 UTC
//   → toISOString() returns "03:10Z" → frontend getHours() shows "3:10" ❌
//
// NEW (CORRECT):
//   Date.UTC(y, mo, d, h, m, 0, 0)
//   → stores exactly h:m as UTC, no offset applied
//   → "8:40" → stored as 8:40 UTC → toISOString() returns "08:40Z"
//   → frontend getUTCHours() returns 8 → shows "8:40" ✅
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
    const { entryTime, exitTime, breaks, notes } = body;

    const now           = new Date();
    const todayMidnight = toMidnightUTC(now);

    // ── Holiday guard ──────────────────────────────────────────
    const existing = await WorkLog.findOne({
      userId: decoded.userId,
      date:   todayMidnight,
    }).select("isHoliday").lean();

    if (existing?.isHoliday) {
      return NextResponse.json(
        {
          success: false,
          message: "Today is marked as a holiday. Remove the holiday first before logging work.",
        },
        { status: 403 }
      );
    }
    // ──────────────────────────────────────────────────────────

    const entryDate = entryTime ? timeStrToUTC(entryTime, todayMidnight) : null;
    const exitDate  = exitTime  ? timeStrToUTC(exitTime,  todayMidnight) : null;

    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s   = timeStrToUTC(b.start, todayMidnight);
        const e   = timeStrToUTC(b.end,   todayMidnight);
        const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
        return { start: s, end: e, duration: dur, type: b.type || "custom" };
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

    const requiredWorkHours = user.defaultWorkHours ?? 8.5;

    const workLog = await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: todayMidnight },
      {
        $set: {
          entryTime:         entryDate,
          exitTime:          exitDate,
          breaks:            parsedBreaks,
          totalBreakTime,
          totalOfficeTime,
          productiveTime,
          requiredWorkHours,
          notes:             notes || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Work log saved successfully",
      data:    workLog,
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