// app/api/typing/analysis/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { TypingResult } from "@/app/models/TypingModels";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import mongoose from "mongoose";

async function getAuthUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
}

// GET /api/typing/analysis
// Query params:
//   timer — timerDuration filter (0 = all timers, default 0)
//
// Returns:
//   trendData      — last 100 test results (for WPM / accuracy line chart)
//   byMode         — average stats grouped by typingMode
//   byTimer        — average stats grouped by timerDuration (always all timers)
//   dailyAvg       — daily averages for the last 30 days
//   wpmDistribution— WPM bucket histogram
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const timerParam    = searchParams.get("timer");
    const timerDuration = timerParam ? parseInt(timerParam, 10) : 0;

    await connectDB();

    const userObjId = new mongoose.Types.ObjectId(userId);

    // Base match — filtered by timer when requested
    const matchQuery: Record<string, unknown> = { userId: userObjId };
    if (timerDuration > 0) matchQuery.timerDuration = timerDuration;

    // ── 1. Trend data (last 100, oldest → newest for chart ordering) ──────
    const trendRaw = await TypingResult.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(100)
      .select("wpm accuracy createdAt timerDuration typingMode errors")
      .lean();

    const trendData = trendRaw
      .reverse()
      .map((r, i) => ({
        index:    i + 1,
        wpm:      r.wpm,
        accuracy: r.accuracy,
        errors:   r.errors,
        date:     r.createdAt,
        mode:     r.typingMode,
        timer:    r.timerDuration,
      }));

    // ── 2. Stats by typing mode ───────────────────────────────────────────
    const byMode = await TypingResult.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:         "$typingMode",
          avgWpm:      { $avg: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          bestWpm:     { $max: "$wpm" },
          count:       { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // ── 3. Stats by timer duration (always across ALL timers) ─────────────
    const byTimer = await TypingResult.aggregate([
      { $match: { userId: userObjId } },
      {
        $group: {
          _id:         "$timerDuration",
          avgWpm:      { $avg: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          bestWpm:     { $max: "$wpm" },
          count:       { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── 4. Daily averages — last 30 days ──────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyRaw = await TypingResult.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year:  { $year:        "$createdAt" },
            month: { $month:       "$createdAt" },
            day:   { $dayOfMonth:  "$createdAt" },
          },
          avgWpm:      { $avg: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          bestWpm:     { $max: "$wpm" },
          count:       { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1, "_id.month": 1, "_id.day": 1,
        },
      },
    ]);

    const dailyAvg = dailyRaw.map((d) => ({
      date:        `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(d._id.day).padStart(2, "0")}`,
      avgWpm:      Math.round(d.avgWpm),
      avgAccuracy: Math.round(d.avgAccuracy),
      bestWpm:     d.bestWpm,
      count:       d.count,
    }));

    // ── 5. WPM distribution histogram ─────────────────────────────────────
    let wpmDistribution: { label: string; count: number }[] = [];
    try {
      const buckets = await TypingResult.aggregate([
        { $match: matchQuery },
        {
          $bucket: {
            groupBy:    "$wpm",
            boundaries: [0, 20, 40, 60, 80, 100, 120, 150, 200],
            default:    "200+",
            output:     { count: { $sum: 1 } },
          },
        },
      ]);

      const labels: Record<string | number, string> = {
        0:    "0–20",
        20:   "20–40",
        40:   "40–60",
        60:   "60–80",
        80:   "80–100",
        100:  "100–120",
        120:  "120–150",
        150:  "150–200",
        "200+": "200+",
      };

      wpmDistribution = buckets.map((b) => ({
        label: labels[b._id] ?? String(b._id),
        count: b.count,
      }));
    } catch {
      // $bucket may fail on very old MongoDB versions — degrade gracefully
    }

    // ── 6. Overall summary ────────────────────────────────────────────────
    const summaryAgg = await TypingResult.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id:         null,
          totalTests:  { $sum: 1 },
          avgWpm:      { $avg: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          bestWpm:     { $max: "$wpm" },
          bestAccuracy:{ $max: "$accuracy" },
        },
      },
    ]);

    const summary = summaryAgg[0]
      ? {
          totalTests:   summaryAgg[0].totalTests,
          avgWpm:       Math.round(summaryAgg[0].avgWpm),
          avgAccuracy:  Math.round(summaryAgg[0].avgAccuracy),
          bestWpm:      summaryAgg[0].bestWpm,
          bestAccuracy: summaryAgg[0].bestAccuracy,
        }
      : {
          totalTests: 0, avgWpm: 0,
          avgAccuracy: 0, bestWpm: 0, bestAccuracy: 0,
        };

    return NextResponse.json({
      success: true,
      trendData,
      byMode,
      byTimer,
      dailyAvg,
      wpmDistribution,
      summary,
    });
  } catch (error) {
    console.error("ANALYSIS GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}