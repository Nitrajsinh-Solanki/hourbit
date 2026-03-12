// app/api/typing/stats/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { TypingStats } from "@/app/models/TypingModels";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

async function getAuthUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

const EMPTY_TIMER_STATS = {
  highestWpm: 0,
  accuracyAtHighestWpm: 0,
  highestAccuracy: 0,
  wpmAtHighestAccuracy: 0,
  totalTests: 0,
  averageWpm: 0,
};

// GET /api/typing/stats?timer=30
// If timer param is omitted or "0", returns global (all-timer) stats.
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timerParam  = searchParams.get("timer");
    const timerDuration = timerParam ? parseInt(timerParam, 10) : 0;

    await connectDB();

    // Fetch the requested timer's stats
    const timerStats = await TypingStats.findOne({ userId, timerDuration }).lean();

    // Always also fetch global stats (timerDuration=0) for the "Tests Completed" card
    const globalStats = timerDuration !== 0
      ? await TypingStats.findOne({ userId, timerDuration: 0 }).lean()
      : timerStats;

    const buildStats = (doc: typeof timerStats) => {
      if (!doc) return EMPTY_TIMER_STATS;
      return {
        highestWpm:           doc.highestWpm,
        accuracyAtHighestWpm: doc.accuracyAtHighestWpm,
        highestAccuracy:      doc.highestAccuracy,
        wpmAtHighestAccuracy: doc.wpmAtHighestAccuracy,
        totalTests:           doc.totalTests,
        averageWpm:           doc.totalTests > 0
          ? Math.round(doc.totalWpmSum / doc.totalTests)
          : 0,
      };
    };

    return NextResponse.json({
      success: true,
      // Per-timer bests (Highest Speed, Highest Accuracy, Average WPM for this timer)
      stats: buildStats(timerStats),
      // Global totals — "Tests Completed" card always shows all-time count
      globalTotalTests: globalStats?.totalTests ?? 0,
    });
  } catch (error) {
    console.error("TYPING STATS ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}