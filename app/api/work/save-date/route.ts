// app/api/work/save-date/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// Converts "HH:MM" + a reference Date into a full Date object
// The reference date provides the year/month/day; we only overwrite hours+mins.
function timeStrToDate(timeStr: string, refDate: Date): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(refDate);
  d.setHours(h, m, 0, 0);
  return d;
}

// POST /api/work/save-date
// Body: { date: "YYYY-MM-DD", entryTime: "HH:MM", exitTime: "HH:MM" | null, breaks: [...], notes: string }
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
    const { date, entryTime, exitTime, breaks, notes } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Reject future dates
    const todayStr = new Date().toISOString().slice(0, 10);
    if (date > todayStr) {
      return NextResponse.json(
        { success: false, message: "Cannot log work for a future date" },
        { status: 400 }
      );
    }

    const [y, mo, d] = date.split("-").map(Number);

    // Reference Date at noon local time for safe time math (avoids DST edge cases)
    const refDate  = new Date(y, mo - 1, d, 12, 0, 0);
    // Midnight UTC — used as the unique date key in DB
    const midnight = new Date(Date.UTC(y, mo - 1, d));

    const entryDate = entryTime ? timeStrToDate(entryTime, refDate) : null;
    const exitDate  = exitTime  ? timeStrToDate(exitTime,  refDate) : null;

    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s   = timeStrToDate(b.start, refDate);
        const e   = timeStrToDate(b.end,   refDate);
        const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
        return { start: s, end: e, duration: dur, type: b.type || "custom" };
      });

    const totalBreakTime = parsedBreaks.reduce(
      (acc: number, b: any) => acc + b.duration, 0
    );

    let totalOfficeTime = 0;
    let productiveTime  = 0;

    if (entryDate && exitDate && exitDate > entryDate) {
      totalOfficeTime = Math.floor(
        (exitDate.getTime() - entryDate.getTime()) / 1000
      );
      productiveTime = Math.max(0, totalOfficeTime - totalBreakTime);
    }

    const requiredWorkHours = user.defaultWorkHours ?? 8.5;

    const workLog = await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: midnight },
      {
        $set: {
          entryTime:      entryDate,
          exitTime:       exitDate,
          breaks:         parsedBreaks,
          totalBreakTime,
          totalOfficeTime,
          productiveTime,
          requiredWorkHours,
          notes:          notes || "",
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
    console.error("SAVE DATE LOG ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}