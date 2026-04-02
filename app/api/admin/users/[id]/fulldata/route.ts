// app/api/admin/users/[id]/fulldata/route.ts
// Super-admin endpoint: fetch ALL data for a specific user
// Work logs, diary entries, typing stats — everything

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/app/lib/mongodb";
import User            from "@/app/models/User";
import WorkLog from "@/app/models/WorkLog";
import { DiaryEntry }  from "@/app/models/DiaryEntry";
import { TypingResult, TypingStats } from "@/app/models/TypingModels";
import { requireAdmin } from "@/app/lib/authGuard";
import mongoose from "mongoose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  await connectDB();

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: "Invalid user ID" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit     = Math.min(50, parseInt(searchParams.get("limit") || "30"));
  const dateFrom  = searchParams.get("from");  // YYYY-MM-DD
  const dateTo    = searchParams.get("to");    // YYYY-MM-DD
  const section   = searchParams.get("section") || "overview"; // overview | work | diary | typing

  // ── Fetch user profile ────────────────────────────────────────────────────
  const user = await User.findById(id)
    .select("-password -otp -otpExpiry")
    .lean();

  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const userId = new mongoose.Types.ObjectId(id);

  // ── Build date filter if provided ─────────────────────────────────────────
  const dateFilter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    dateFilter.date = {};
    if (dateFrom) (dateFilter.date as Record<string, unknown>).$gte = new Date(dateFrom + "T00:00:00.000Z");
    if (dateTo)   (dateFilter.date as Record<string, unknown>).$lte = new Date(dateTo   + "T23:59:59.999Z");
  }

  // ── OVERVIEW: summary counts + recent records ─────────────────────────────
  if (section === "overview") {
    const [
      totalWorkLogs,
      totalDiaryEntries,
      totalTypingTests,
      recentWorkLogs,
      typingStatsAll,
    ] = await Promise.all([
      WorkLog.countDocuments({ userId }),
      DiaryEntry.countDocuments({ userId }),
      TypingResult.countDocuments({ userId }),
      WorkLog.find({ userId })
        .sort({ date: -1 })
        .limit(7)
        .lean(),
      TypingStats.findOne({ userId, timerDuration: 0 }).lean(),
    ]);

    // Compute aggregate work stats
    const workAgg = await WorkLog.aggregate([
      { $match: { userId, isHoliday: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalProductiveSecs: { $sum: "$productiveTime" },
          totalBreakSecs:      { $sum: "$totalBreakTime" },
          totalOfficeSecs:     { $sum: "$totalOfficeTime" },
          avgProductiveSecs:   { $avg: "$productiveTime" },
        },
      },
    ]);

    const aggData = workAgg[0] || {
      totalProductiveSecs: 0,
      totalBreakSecs: 0,
      totalOfficeSecs: 0,
      avgProductiveSecs: 0,
    };

    return NextResponse.json({
      success: true,
      user,
      overview: {
        totalWorkLogs,
        totalDiaryEntries,
        totalTypingTests,
        totalProductiveHours: Math.round((aggData.totalProductiveSecs / 3600) * 100) / 100,
        totalBreakHours:      Math.round((aggData.totalBreakSecs      / 3600) * 100) / 100,
        avgProductiveHoursPerDay: Math.round((aggData.avgProductiveSecs / 3600) * 100) / 100,
        typingHighestWpm:     (typingStatsAll as any)?.highestWpm   ?? 0,
        typingAvgWpm:         (typingStatsAll as any)?.totalTests > 0
          ? Math.round(((typingStatsAll as any).totalWpmSum / (typingStatsAll as any).totalTests))
          : 0,
        typingTotalTests:     (typingStatsAll as any)?.totalTests ?? 0,
      },
      recentWorkLogs,
    });
  }

  // ── WORK LOGS: paginated full work history ────────────────────────────────
  if (section === "work") {
    const filter: Record<string, unknown> = { userId, ...dateFilter };

    const [total, workLogs] = await Promise.all([
      WorkLog.countDocuments(filter),
      WorkLog.find(filter)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      workLogs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  }

  // ── DIARY: paginated diary entries ────────────────────────────────────────
  if (section === "diary") {
    const diaryFilter: Record<string, unknown> = { userId };
    if (dateFrom || dateTo) {
      diaryFilter.entryDate = {};
      if (dateFrom) (diaryFilter.entryDate as Record<string, unknown>).$gte = new Date(dateFrom + "T00:00:00.000Z");
      if (dateTo)   (diaryFilter.entryDate as Record<string, unknown>).$lte = new Date(dateTo   + "T23:59:59.999Z");
    }

    const [total, diaryEntries] = await Promise.all([
      DiaryEntry.countDocuments(diaryFilter),
      DiaryEntry.find(diaryFilter)
        .sort({ entryDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      diaryEntries,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  }

  // ── TYPING: paginated typing results + stats per timer ───────────────────
  if (section === "typing") {
    const typingFilter: Record<string, unknown> = { userId };
    if (dateFrom || dateTo) {
      typingFilter.createdAt = {};
      if (dateFrom) (typingFilter.createdAt as Record<string, unknown>).$gte = new Date(dateFrom + "T00:00:00.000Z");
      if (dateTo)   (typingFilter.createdAt as Record<string, unknown>).$lte = new Date(dateTo   + "T23:59:59.999Z");
    }

    const [total, typingResults, allTimerStats] = await Promise.all([
      TypingResult.countDocuments(typingFilter),
      TypingResult.find(typingFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TypingStats.find({ userId }).sort({ timerDuration: 1 }).lean(),
    ]);

    return NextResponse.json({
      success: true,
      typingResults,
      timerStats: allTimerStats,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  }

  return NextResponse.json({ success: false, message: "Invalid section" }, { status: 400 });
}