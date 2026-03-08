// app/api/work/holiday/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";

// POST /api/work/holiday
// Body: { date: "YYYY-MM-DD", isHoliday: boolean, reason?: string }
// Upserts a WorkLog record for that date with isHoliday set.
// When marking as holiday, all work-time fields are zeroed so
// the day is excluded from every average/analytics query.
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

    const body = await req.json();
    const { date, isHoliday, reason } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Block future dates
    const todayStr = new Date().toISOString().slice(0, 10);
    if (date > todayStr) {
      return NextResponse.json(
        { success: false, message: "Cannot mark a future date as holiday" },
        { status: 400 }
      );
    }

    const [y, m, d] = date.split("-").map(Number);
    const midnight  = new Date(Date.UTC(y, m - 1, d));

    await connectDB();

    // When marking AS holiday: zero all work fields so averages ignore this day
    const setPayload: Record<string, unknown> = {
      isHoliday: !!isHoliday,
      notes:     reason ?? "",
    };
    if (isHoliday) {
      setPayload.entryTime       = null;
      setPayload.exitTime        = null;
      setPayload.breaks          = [];
      setPayload.totalBreakTime  = 0;
      setPayload.totalOfficeTime = 0;
      setPayload.productiveTime  = 0;
    }

    await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: midnight },
      { $set: setPayload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: isHoliday
        ? "Day marked as holiday"
        : "Holiday removed — day restored as a work day",
    });

  } catch (error: any) {
    console.error("HOLIDAY TOGGLE ERROR:", error);
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