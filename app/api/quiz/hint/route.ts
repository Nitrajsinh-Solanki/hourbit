// app/api/quiz/hint/route.ts
// POST — records hint usage server-side AND immediately deducts XP from DB
//
// BUG FIX:
//   The previous `findOneAndUpdate` used `userId` (string from JWT payload) as
//   the filter directly. MongoDB stores userId as ObjectId in UserLevelProgress,
//   so the string never matched → the update silently found 0 documents →
//   XP was never deducted from the DB.
//
//   Fix: wrap userId in `new mongoose.Types.ObjectId(userId)` for BOTH the
//   sufficiency-check aggregation AND the findOneAndUpdate filter.
//   Also wrapped session.levelId in ObjectId for the update filter to be safe.
// app/api/quiz/hint/route.ts
//
// POST — records hint usage server-side AND immediately deducts XP from the
//        UserXp balance document.
//
// ARCHITECTURE:
//   XP is stored in TWO places:
//     1. UserXp.totalXp  — the running wallet balance (what the navbar shows).
//                          This is the ONLY place hint deductions write to.
//     2. UserLevelProgress.earnedXp — the XP credited to a level on completion.
//                          The submit route writes here; hints never touch it.
//
//   This separation means:
//     • Hints are deducted from the wallet INSTANTLY and PERMANENTLY.
//     • Quiz submit ADDS the earned amount to the wallet — it never recalculates
//       from scratch, so hint deductions are never "undone".
//
// BUGS FIXED vs original:
//   BUG 1 (XP coming back after submit):
//     Original code deducted from UserLevelProgress.earnedXp, which the submit
//     route then OVERWROTE with its own calculation → deduction lost.
//     Fix: deduct from UserXp.totalXp (wallet). Submit route only ADDS to it.
//
//   BUG 2 (ObjectId type mismatch):
//     Original filter used userId as plain string → 0 documents matched.
//     Fix: always cast to ObjectId.

import { NextRequest, NextResponse }            from "next/server";
import { connectDB }                            from "@/app/lib/mongodb";
import { requireAuth }                          from "@/app/lib/authGuard";
import { UserLevelSession }                     from "@/app/models/brain";
import { Question }                             from "@/app/models/brain/Question";
import { UserXp }                               from "@/app/models/brain/UserXp";
import mongoose                                 from "mongoose";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const body = await req.json();
  const { sessionId, questionId } = body;

  if (!sessionId || !questionId) {
    return NextResponse.json(
      { success: false, message: "sessionId and questionId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userObjId = new mongoose.Types.ObjectId(auth.payload.userId);

  // Verify session belongs to this user and is still active
  const session = await UserLevelSession.findOne({
    _id:    sessionId,
    userId: userObjId,
    status: "started",
  });

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Active session not found" },
      { status: 404 }
    );
  }

  // Fetch question for hint data
  const question = await Question.findById(questionId)
    .select("hintXpPenalty hintText")
    .lean();

  if (!question) {
    return NextResponse.json(
      { success: false, message: "Question not found" },
      { status: 404 }
    );
  }

  const hintKey  = `hint:${questionId}`;
  const existing = session.answers.get(hintKey);

  // Idempotent — hint already used for this question
  if (existing) {
    return NextResponse.json({
      success:       true,
      alreadyUsed:   true,
      hintText:      (question as any).hintText    ?? "",
      hintXpPenalty: Number(existing),
    });
  }

  const penalty = Number((question as any).hintXpPenalty ?? 0);

  // ── XP sufficiency check ─────────────────────────────────────────────────
  // Read from UserXp wallet — the real-time balance.
  if (penalty > 0) {
    const xpDoc = await UserXp.findOne({ userId: userObjId }).lean();
    const currentTotalXp = xpDoc?.totalXp ?? 0;

    if (currentTotalXp < penalty) {
      return NextResponse.json(
        {
          success:    false,
          message:    `Not enough XP. You need ${penalty} XP but have ${currentTotalXp} XP.`,
          notEnoughXp: true,
        },
        { status: 400 }
      );
    }
  }

  // ── Persist hint usage in session ────────────────────────────────────────
  session.answers.set(hintKey, String(penalty));
  await session.save();

  // ── IMMEDIATELY deduct hint penalty from wallet ───────────────────────────
  // Uses findOneAndUpdate with $inc for atomicity.
  // upsert:true ensures the wallet doc is created if somehow missing.
  // The $max guard prevents the balance going below 0.
  //
  // NOTE: We do NOT touch UserLevelProgress here.
  //       The submit route will credit the NET earned XP to the wallet.
  //       Touching UserLevelProgress from hint would cause double-counting.
  if (penalty > 0) {
    // Atomic: subtract penalty, floor at 0
    // MongoDB doesn't have a built-in $max on $inc, so we use an aggregation
    // pipeline update to clamp at 0.
    await UserXp.findOneAndUpdate(
  { userId: userObjId },
  [
    {
      $set: {
        totalXp: {
          $max: [0, { $subtract: ["$totalXp", penalty] }],
        },
      },
    },
  ],
  { upsert: true, returnDocument: "after", updatePipeline: true }  // ← add this
);
  }

  return NextResponse.json({
    success:       true,
    alreadyUsed:   false,
    hintText:      (question as any).hintText ?? "",
    hintXpPenalty: penalty,
  });
}