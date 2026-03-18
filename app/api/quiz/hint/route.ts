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

  const userId    = auth.payload.userId;
  // ── FIX: convert to ObjectId for all DB queries ──────────────────────────
  const userObjId = new mongoose.Types.ObjectId(userId);

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

  // Fetch question to get hintText and hintXpPenalty.
  // hintText is intentionally NOT sent in the session/questions payload —
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

  // Idempotent — if hint already used for this question, return cached data
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
  // Uses ObjectId — previously used string which caused 0-match silently.
  if (penalty > 0) {
    const xpResult = await UserLevelProgress.aggregate([
      {
        $match: {
          userId: userObjId,          // ← ObjectId, not string
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

  // ── Persist hint usage in session ──────────────────────────────────────
  // Key "hint:{questionId}" → penalty as string.
  // Submit route reads this map to calculate hint deductions even after
  // browser close or page refresh.
  session.answers.set(hintKey, String(penalty));
  await session.save();

  // ── Deduct hint penalty from UserLevelProgress.earnedXp in DB ──────────
  // FIX: both `userId` and `levelId` are cast to ObjectId so the filter
  // actually matches the document.  Previously `userId` was a plain string
  // and MongoDB's strict type comparison meant 0 documents were ever matched,
  // so the XP field was never updated.
  if (penalty > 0) {
    const levelObjId = new mongoose.Types.ObjectId(String(session.levelId));

    const updateResult = await UserLevelProgress.findOneAndUpdate(
      {
        userId:  userObjId,    // ← ObjectId (was string — the bug)
        levelId: levelObjId,   // ← ObjectId (extra safety)
      },
      [
        {
          $set: {
            // Deduct penalty but never let earnedXp go below 0
            earnedXp: { $max: [0, { $subtract: ["$earnedXp", penalty] }] },
          },
        },
      ],
      {
        updatePipeline: true,        // required for array (aggregation pipeline) updates
        returnDocument: "after",
      }
    );

    // Safety: if no progress doc found (edge case — should not happen after
    // session creation creates the doc), log a warning but don't crash.
    if (!updateResult) {
      console.warn(
        `[hint] UserLevelProgress not found for userId=${userId} levelId=${session.levelId}. XP deduction skipped.`
      );
    }
  }

  return NextResponse.json({
    success:       true,
    alreadyUsed:   false,
    hintText:      (question as any).hintText ?? "",
    hintXpPenalty: penalty,
  });
}