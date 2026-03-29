// app/api/quiz/xp/route.ts
// GET — returns total XP earned by authenticated user
// Only counts COMPLETED or EXHAUSTED levels — never partial attempts
//
// FIXES:
//  - Added Cache-Control header so repeated navigations are instant
//  - Single aggregation pipeline (already correct) — no N+1 queries
// app/api/quiz/xp/route.ts
//
// GET — returns total XP for the authenticated user.
//
// ARCHITECTURE CHANGE:
//   OLD: Aggregated UserLevelProgress.earnedXp across completed/exhausted levels.
//        Problem: this never reflected hint deductions because hints deducted
//        from earnedXp on an IN-PROGRESS level, not a completed one.
//        After submit, earnedXp was overwritten → hint deductions vanished.
//
//   NEW: Reads UserXp.totalXp — a single wallet document per user.
//        • Hint route decrements it immediately ($inc with negative delta).
//        • Submit route increments it with the net earned XP ($inc positive).
//        • This document is the ONE truth. No aggregation needed.
//
// MIGRATION NOTE:
//   If you have existing users with XP already accumulated via the old
//   UserLevelProgress aggregation, run a one-time migration to seed UserXp:
//
//     const docs = await UserLevelProgress.aggregate([
//       { $match: { $or: [{ isCompleted: true }, { isExhausted: true }] } },
//       { $group: { _id: "$userId", total: { $sum: "$earnedXp" } } },
//     ]);
//     for (const d of docs) {
//       await UserXp.findOneAndUpdate(
//         { userId: d._id },
//         { $set: { totalXp: d.total } },
//         { upsert: true }
//       );
//     }

import { NextResponse }  from "next/server";
import { connectDB }     from "@/app/lib/mongodb";
import { requireAuth }   from "@/app/lib/authGuard";
import { UserXp }        from "@/app/models/brain/UserXp";
import mongoose          from "mongoose";

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

  // Single document read — O(1), no aggregation
  const xpDoc  = await UserXp.findOne({ userId }).lean();
  const totalXp = xpDoc?.totalXp ?? 0;

  return NextResponse.json(
    { success: true, totalXp },
    {
      headers: {
        // Short cache — stale-while-revalidate means instant response on repeat
        // visits while a fresh fetch happens in the background.
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    }
  );
}