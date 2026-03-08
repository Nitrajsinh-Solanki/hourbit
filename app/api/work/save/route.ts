// app/api/work/save/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

function timeStrToDate(timeStr: string, refDate: Date): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(refDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function toMidnightUTC(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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

    // ── Holiday guard ──────────────────────────────────────────────
    // Reject saves if today is already marked as a holiday.
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
    // ──────────────────────────────────────────────────────────────

    const entryDate = entryTime ? timeStrToDate(entryTime, now) : null;
    const exitDate  = exitTime  ? timeStrToDate(exitTime,  now) : null;

    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s   = timeStrToDate(b.start, now);
        const e   = timeStrToDate(b.end,   now);
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