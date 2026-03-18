// app/api/quiz/hint/route.ts
// POST — records hint usage server-side AND immediately deducts XP from DB
//
// FIXES:
//   1. MongooseError "Cannot pass an array to query updates unless updatePipeline
//      option is set" — fixed by adding { updatePipeline: true } to the options.
//   2. The deprecated `new` option replaced with `returnDocument: "after"`.
//   3. XP sufficiency check: if the user's current total XP is less than the
//      hint penalty, we reject the hint request so the user cannot go negative.
//      The current totalXp is computed server-side from UserLevelProgress so
//      the client cannot spoof it.
//   4. Returns hintText in the response (needed by the quiz page to display it).
//   5. XP deduction rate is read from the level's admin-configured value —
//      never hardcoded on the server.

import { NextRequest, NextResponse }            from "next/server";
import { connectDB }                            from "@/app/lib/mongodb";
import { requireAuth }                          from "@/app/lib/authGuard";
import { UserLevelSession, UserLevelProgress }  from "@/app/models/brain";
import { Question }                             from "@/app/models/brain/Question";
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

  const userId = auth.payload.userId;

  // Verify session belongs to this user and is still active
  const session = await UserLevelSession.findOne({
    _id:    sessionId,
    userId,
    status: "started",
  });

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Active session not found" },
      { status: 404 }
    );
  }

  // Fetch question to get hintText and hintXpPenalty
  // These are intentionally NOT sent in the session/questions payload —
  // only returned here after the penalty is committed to DB.
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

  // Idempotent — if already used for this question, return cached data
  if (existing) {
    return NextResponse.json({
      success:       true,
      alreadyUsed:   true,
      hintText:      (question as any).hintText    ?? "",
      hintXpPenalty: Number(existing),
    });
  }

  const penalty = Number((question as any).hintXpPenalty ?? 0);

  // ── XP sufficiency check ────────────────────────────────────────────────
  // Compute user's current total XP from DB (cannot be spoofed by client).
  // If the user doesn't have enough XP to afford the penalty, reject.
  if (penalty > 0) {
    const uid = new mongoose.Types.ObjectId(userId);
    const xpResult = await UserLevelProgress.aggregate([
      {
        $match: {
          userId: uid,
          $or: [{ isCompleted: true }, { isExhausted: true }],
        },
      },
      { $group: { _id: null, totalXp: { $sum: "$earnedXp" } } },
    ]);
    const currentTotalXp = xpResult[0]?.totalXp ?? 0;

    if (currentTotalXp < penalty) {
      return NextResponse.json(
        {
          success: false,
          message: `Not enough XP. You need ${penalty} XP but have ${currentTotalXp} XP.`,
          notEnoughXp: true,
        },
        { status: 400 }
      );
    }
  }

  // ── Persist hint in session ─────────────────────────────────────────────
  // Key "hint:{questionId}" → penalty as string.
  // Submit route reads this map to calculate hint deductions even after
  // browser close or page refresh.
  session.answers.set(hintKey, String(penalty));
  await session.save();

  // ── Deduct hint penalty from UserLevelProgress.earnedXp in DB ──────────
  // This keeps GET /api/quiz/xp accurate between hint click and submission.
  // Submit route recalculates earnedXp from scratch, so no double-deduction.
  //
  // FIX: Mongoose requires { updatePipeline: true } when passing an array as
  // the update argument (MongoDB aggregation pipeline updates, requires 4.2+).
  // Without this option Mongoose throws:
  //   "Cannot pass an array to query updates unless the updatePipeline option is set"
  if (penalty > 0) {
    await UserLevelProgress.findOneAndUpdate(
      { userId, levelId: session.levelId },
      [
        {
          $set: {
            // Deduct penalty but never go below 0
            earnedXp: { $max: [0, { $subtract: ["$earnedXp", penalty] }] },
          },
        },
      ],
      {
        updatePipeline:  true,         // ← required for array (pipeline) updates
        returnDocument:  "after",      // replaces deprecated `new: true`
      }
    );
  }

  return NextResponse.json({
    success:       true,
    alreadyUsed:   false,
    hintText:      (question as any).hintText ?? "",
    hintXpPenalty: penalty,
  });
}