// app/api/work/date/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";

// GET /api/work/date?date=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date"); // "YYYY-MM-DD"

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const midnight  = new Date(Date.UTC(y, m - 1, d));

    await connectDB();

    const log = await WorkLog.findOne({
      userId: decoded.userId,
      date:   midnight,
    }).lean();

    if (!log) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        entryTime: log.entryTime ? (log.entryTime as Date).toISOString() : null,
        exitTime:  log.exitTime  ? (log.exitTime  as Date).toISOString() : null,
        breaks: (log.breaks as any[]).map((b) => ({
          start:    (b.start as Date).toISOString(),
          end:      (b.end   as Date).toISOString(),
          duration: b.duration,
          type:     b.type,
        })),
        totalBreakTime:    log.totalBreakTime,
        totalOfficeTime:   log.totalOfficeTime,
        productiveTime:    log.productiveTime,
        requiredWorkHours: log.requiredWorkHours,
        notes:             log.notes,
        isHoliday:         log.isHoliday,
      },
    });
  } catch (error: any) {
    console.error("GET DATE LOG ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}