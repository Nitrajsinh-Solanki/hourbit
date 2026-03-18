// app/api/quiz/xp/route.ts
// GET — returns total XP earned by authenticated user
// Only counts COMPLETED or EXHAUSTED levels — never partial attempts
//
// FIXES:
//  - Added Cache-Control header so repeated navigations are instant
//  - Single aggregation pipeline (already correct) — no N+1 queries

import { NextResponse }      from "next/server";
import { connectDB }         from "@/app/lib/mongodb";
import { requireAuth }       from "@/app/lib/authGuard";
import { UserLevelProgress } from "@/app/models/brain";
import mongoose              from "mongoose";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  await connectDB();

  const userId = new mongoose.Types.ObjectId(auth.payload.userId);

  const result = await UserLevelProgress.aggregate([
    {
      $match: {
        userId,
        $or: [{ isCompleted: true }, { isExhausted: true }],
      },
    },
    {
      $group: {
        _id:     null,
        totalXp: { $sum: "$earnedXp" },
      },
    },
  ]);

  const totalXp = result[0]?.totalXp ?? 0;

  return NextResponse.json(
    { success: true, totalXp },
    {
      headers: {
        // Cache on the client for 30 s — stale-while-revalidate means the
        // browser serves the cached value instantly while fetching a fresh one.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}