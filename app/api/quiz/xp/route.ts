// app/api/quiz/xp/route.ts

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
        // Only count XP from levels that are completed OR exhausted
        $or: [{ isCompleted: true }, { isExhausted: true }],
      },
    },
    {
      $group: { _id: null, totalXp: { $sum: "$earnedXp" } },
    },
  ]);

  const totalXp = result[0]?.totalXp ?? 0;

  return NextResponse.json({ success: true, totalXp });
}