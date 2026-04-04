// app/api/work/date/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";

const DELETE_WINDOW = 90; // days

function parseMidnight(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

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

    const midnight = parseMidnight(dateStr!);
    if (!midnight) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

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
        totalBreakTime:              log.totalBreakTime,
        totalOfficeTime:             log.totalOfficeTime,
        productiveTime:              log.productiveTime,
        requiredWorkHours:           log.requiredWorkHours,
        requiredWorkHoursOverride:   (log as any).requiredWorkHoursOverride ?? null,
        notes:                       log.notes,
        isHoliday:                   log.isHoliday,
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

// DELETE /api/work/date?date=YYYY-MM-DD
// Permanently removes a WorkLog entry from the DB.
// Allowed only within the last 90 days. Future dates and entries older than
// 90 days are rejected.
export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    const midnight = parseMidnight(dateStr!);
    if (!midnight) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // ── Date range guard ──────────────────────────────────────
    const nowUTC   = new Date();
    const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()));

    // Block future dates
    if (midnight > todayUTC) {
      return NextResponse.json(
        { success: false, message: "Cannot delete a future date's entry" },
        { status: 400 }
      );
    }

    // Block entries older than DELETE_WINDOW days
    const diffDays = Math.round((todayUTC.getTime() - midnight.getTime()) / 86_400_000);
    if (diffDays > DELETE_WINDOW) {
      return NextResponse.json(
        { success: false, message: `Entries older than ${DELETE_WINDOW} days cannot be deleted` },
        { status: 403 }
      );
    }

    // ── Delete ────────────────────────────────────────────────
    await connectDB();

    const result = await WorkLog.deleteOne({
      userId: decoded.userId,
      date:   midnight,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: "No entry found for this date" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Entry deleted successfully",
    });

  } catch (error: any) {
    console.error("DELETE DATE LOG ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}