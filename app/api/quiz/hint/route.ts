// app/api/quiz/hint/route.ts
// POST — records hint usage server-side AND immediately deducts the XP from DB
//
// WHY DB DEDUCTION IS NEEDED HERE:
//   The navbar does an instant visual deduction via the "xp-deduct" CustomEvent.
//   But GET /api/quiz/xp reads UserLevelProgress.earnedXp from the DB.
//   If we don't deduct from the DB on hint click, then when the user navigates
//   away and comes back, the XP badge reloads from DB and shows the pre-hint
//   value — making it look like the deduction never happened.
//
//   The submit route recalculates earnedXp from scratch at submission time, so
//   there is NO double-deduction risk: submit overwrites earnedXp completely.
//   The DB deduction here is only for the XP badge to stay accurate between
//   hint click and quiz submission.
//
// DEDUCTION TARGET:
//   We deduct from UserLevelProgress.earnedXp for THIS level.
//   If no progress doc exists yet for this level (shouldn't happen because
//   attemptsUsed is incremented when the session starts), we skip DB deduction
//   — the submit route will write the correct final value anyway.

import { NextRequest, NextResponse }  from "next/server";
import { connectDB }                  from "@/app/lib/mongodb";
import { requireAuth }                from "@/app/lib/authGuard";
import { UserLevelSession, UserLevelProgress } from "@/app/models/brain";
import { Question }                   from "@/app/models/brain/Question";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { sessionId, questionId } = await req.json();

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

  // Fetch question — hintText and hintXpPenalty are safe to read here
  // (they are NOT sent in the session/questions payload — only returned here)
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

  // Idempotent — if already used, return cached data without deducting again
  if (existing) {
    return NextResponse.json({
      success:       true,
      alreadyUsed:   true,
      hintText:      (question as any).hintText    ?? "",
      hintXpPenalty: Number(existing),
    });
  }

  const penalty = (question as any).hintXpPenalty ?? 0;

  // 1. Persist hint key in session so submit route picks it up even after
  //    browser close or page refresh
  session.answers.set(hintKey, String(penalty));
  await session.save();

  // 2. Immediately deduct hint penalty from UserLevelProgress.earnedXp in DB
  //    so GET /api/quiz/xp returns the correct reduced value right away.
  //    Use $inc with a floor-at-zero guard via $max to avoid negative earnedXp.
  //    Only deduct if penalty > 0 to avoid a pointless DB write.
  if (penalty > 0) {
    // $inc + $max atomically: new earnedXp = max(0, current - penalty)
    // MongoDB doesn't support this in one operation directly, so we use
    // findOneAndUpdate with a pipeline update (MongoDB 4.2+):
    await UserLevelProgress.findOneAndUpdate(
      { userId, levelId: session.levelId },
      [
        {
          $set: {
            earnedXp: {
              $max: [0, { $subtract: ["$earnedXp", penalty] }],
            },
          },
        },
      ]
    );
  }

  return NextResponse.json({
    success:       true,
    alreadyUsed:   false,
    hintText:      (question as any).hintText ?? "",
    hintXpPenalty: penalty,
  });
}