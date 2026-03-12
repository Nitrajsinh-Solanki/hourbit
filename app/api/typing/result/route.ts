// app/api/typing/result/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { TypingResult, TypingStats } from "@/app/models/TypingModels";
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

// Helper: atomically upsert a stats document for a given (userId, timerDuration).
// Step 1 — increment counters (safe to run always, upsert creates doc if missing).
// Step 2 — conditionally update highest WPM (only if new value is higher).
// Step 3 — conditionally update highest accuracy (only if new value is higher).
// All three operations are targeted and idempotent. No read-then-write races.
async function upsertStats(
  userId: string,
  timerDuration: number,
  wpm: number,
  accuracy: number
) {
  // Step 1: increment counters + ensure doc exists
  await TypingStats.findOneAndUpdate(
    { userId, timerDuration },
    { $inc: { totalTests: 1, totalWpmSum: wpm } },
    {
      upsert: true,
      new: true,
      // Only set these fields when the document is first created (insert).
      // On subsequent updates they are ignored, so we never overwrite real bests.
      setDefaultsOnInsert: true,
    }
  );

  // Step 2: update highest WPM — only when the stored value is strictly less
  await TypingStats.updateOne(
    { userId, timerDuration, highestWpm: { $lt: wpm } },
    { $set: { highestWpm: wpm, accuracyAtHighestWpm: accuracy } }
  );

  // Step 3: update highest accuracy — only when the stored value is strictly less
  await TypingStats.updateOne(
    { userId, timerDuration, highestAccuracy: { $lt: accuracy } },
    { $set: { highestAccuracy: accuracy, wpmAtHighestAccuracy: wpm } }
  );
}

// POST /api/typing/result
export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { timerDuration, typingMode, wpm, accuracy, errors, charactersTyped } = body;

    if (timerDuration == null || !typingMode || wpm == null ||
        accuracy == null || errors == null || charactersTyped == null) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    await connectDB();

    // 1. Persist the raw result
    await TypingResult.create({ userId, timerDuration, typingMode, wpm, accuracy, errors, charactersTyped });

    // 2. Update per-timer stats (e.g. timerDuration = 30)
    await upsertStats(userId, timerDuration, wpm, accuracy);

    // 3. Update global stats (timerDuration = 0 is the "all timers" bucket)
    await upsertStats(userId, 0, wpm, accuracy);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TYPING RESULT ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}