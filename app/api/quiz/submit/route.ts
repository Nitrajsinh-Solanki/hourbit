// app/api/quiz/submit/route.ts
//
// XP RULES (enforced server-side, cannot be spoofed by client):
//
//   PASS (score === 100%):
//     earnedXp = floor((baseXp - hintDeduction) * exhaustionUnlockMultiplier)
//     exhaustionUnlockMultiplier = level.penaltyXpMultiplier if THIS level was
//     unlocked because the PREVIOUS level was exhausted, otherwise 1.0.
//
//   FAIL on non-final attempt (attemptsUsed < maxAttempts):
//     earnedXp = 0   ← NO XP for failed non-last attempts
//
//   FAIL on LAST attempt (attemptsUsed >= maxAttempts, level exhausted):
//     earnedXp = floor(baseXp * level.penaltyXpMultiplier)
//     i.e. 30% of the base XP set by admin, NO hint deduction applied
//     (hint penalty only makes sense when the user was trying to pass)
//
//   HINT XP deduction:
//     Deducted from earnedXp ONLY on a PASSING attempt.
//     On an exhaustion award the base 30% is given as-is — hints are a sunk cost.
// app/api/quiz/submit/route.ts
//
// XP RULES (server-side authoritative):
//
//   PASS (score === 100%):
//     earnedXp = floor((baseXp - hintDeduction) * exhaustionUnlockMultiplier)
//     This amount is ADDED to UserXp.totalXp wallet.
//
//   FAIL on non-final attempt:
//     earnedXp = 0 — no wallet change.
//
//   FAIL on LAST attempt (exhaustion):
//     earnedXp = floor(baseXp * penaltyXpMultiplier)
//     This amount is ADDED to UserXp.totalXp wallet.
//
// CRITICAL ARCHITECTURAL FIX vs original:
//   The original submit route recalculated earnedXp and wrote it to
//   UserLevelProgress, then the XP route re-aggregated everything.
//   This caused hint deductions to "come back" because the aggregation
//   summed UserLevelProgress.earnedXp which was set by submit (without
//   knowing about already-deducted hints in the UserXp wallet).
//
//   NEW APPROACH:
//     • Hints deduct from UserXp.totalXp immediately (hint route).
//     • Submit only ADDS the net earned XP to UserXp.totalXp ($inc).
//     • UserXp.totalXp is the single authoritative balance.
//     • /api/quiz/xp just reads UserXp.totalXp — no aggregation needed.

import { NextRequest, NextResponse }                   from "next/server";
import { connectDB }                                   from "@/app/lib/mongodb";
import { requireAuth }                                 from "@/app/lib/authGuard";
import { Level, UserLevelProgress, UserLevelSession }  from "@/app/models/brain";
import { Question }                                    from "@/app/models/brain/Question";
import { QuizAttemptResult }                           from "@/app/models/brain/QuizAttemptResult";
import { UserXp }                                      from "@/app/models/brain/UserXp";
import mongoose                                        from "mongoose";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveCategoryId(subcategoryId: any): Promise<any> {
  const { Subcategory } = await import("@/app/models/brain/Subcategory");
  const sub = await Subcategory.findById(subcategoryId).select("categoryId").lean();
  return (sub as any)?.categoryId;
}

async function unlockNextLevel(
  userId:        string,
  currentLevel:  any,
  viaExhaustion: boolean
): Promise<void> {
  const { Level: LevelModel, UserLevelProgress: ULP } =
    await import("@/app/models/brain");

  const nextLevel = await LevelModel.findOne({
    subcategoryId: currentLevel.subcategoryId,
    levelNumber:   currentLevel.levelNumber + 1,
    status:        "active",
  }).lean();

  if (!nextLevel) return;

  const exists = await ULP.findOne({ userId, levelId: nextLevel._id });
  if (!exists) {
    await ULP.create({
      userId,
      levelId:               nextLevel._id,
      subcategoryId:         nextLevel.subcategoryId,
      categoryId:            await resolveCategoryId(nextLevel.subcategoryId),
      attemptsUsed:          0,
      isCompleted:           false,
      isExhausted:           false,
      unlockedViaExhaustion: viaExhaustion,
    });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const body = await req.json();
  const { sessionId, answers } = body;

  if (!sessionId) {
    return NextResponse.json(
      { success: false, message: "sessionId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId    = auth.payload.userId;
  const userObjId = new mongoose.Types.ObjectId(userId);

  // Verify session
  const session = await UserLevelSession.findOne({
    _id:    sessionId,
    userId: userObjId,
    status: "started",
  });

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Session not found or already submitted." },
      { status: 404 }
    );
  }

  const levelId = session.levelId;
  const level   = await Level.findById(levelId).lean();
  if (!level) {
    return NextResponse.json(
      { success: false, message: "Level not found" },
      { status: 404 }
    );
  }

  // Determine outcome (completed vs abandoned by timer)
  let outcome: "completed" | "abandoned" = "completed";
  if (level.timeLimitMinutes > 0) {
    const elapsedSecs =
      (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    if (elapsedSecs > level.timeLimitMinutes * 60 + 30) {
      outcome = "abandoned";
    }
  }

  // Fetch all published questions (server-authoritative grading)
  const questions = await Question.find({ levelId, status: "published" })
    .sort({ displayOrder: 1 })
    .lean();

  // ── Grade answers ─────────────────────────────────────────────────────────
  let correctCount         = 0;
  let totalHintXpDeduction = 0;

  const answerDetails = questions.map((q, idx) => {
    const submitted     = answers?.[String(q._id)] || {};
    const userAnswer    = (submitted.userAnswer ?? "").toString().trim();
    const timeTakenSecs = Number(submitted.timeTakenSecs ?? 0);

    // Server-stored hint record wins (survives browser close)
    const serverHintKey = `hint:${String(q._id)}`;
    const serverHint    = session.answers.get(serverHintKey);
    const hintUsed      = serverHint !== undefined || Boolean(submitted.hintUsed);
    const hintPenalty   = serverHint !== undefined
      ? Number(serverHint)
      : hintUsed
      ? (q.hintXpPenalty ?? 0)
      : 0;

    // Grade
    let isCorrect = false;
    if (q.questionType === "option") {
      isCorrect = userAnswer.toUpperCase() === q.correctOption;
    } else {
      const normalized = userAnswer.toLowerCase().trim();
      isCorrect = q.acceptedAnswers.some(
        (a: string) => a.toLowerCase().trim() === normalized
      );
    }

    if (isCorrect) correctCount++;
    totalHintXpDeduction += hintPenalty;

    return {
      questionId:    q._id,
      questionIndex: idx,
      userAnswer,
      isCorrect,
      hintUsed,
      hintXpPenalty: hintPenalty,
      timeTakenSecs,
    };
  });

  const totalQuestions = questions.length;
  const wrongCount     = totalQuestions - correctCount;
  const score          = totalQuestions > 0
    ? Math.round((correctCount / totalQuestions) * 100)
    : 0;

  const timeTakenSecs = Math.round(
    (Date.now() - new Date(session.startedAt).getTime()) / 1000
  );

  const progress = await UserLevelProgress.findOne({ userId, levelId });

  // ── XP CALCULATION ────────────────────────────────────────────────────────
  const attemptsUsedNow = progress?.attemptsUsed ?? 1;
  const isPassing       = score === 100;
  const willBeExhausted = attemptsUsedNow >= level.maxAttempts && !isPassing;
  const canReview       = isPassing || willBeExhausted;

  const wasExhaustionUnlock = progress?.unlockedViaExhaustion ?? false;
  const baseXp              = level.xpReward;
  const exhaustionXpRate    = level.penaltyXpMultiplier ?? 0.30;

  let earnedXp:          number;
  let penaltyMultiplier: number;

  if (isPassing) {
    penaltyMultiplier = wasExhaustionUnlock ? exhaustionXpRate : 1.0;
    earnedXp = Math.max(
      0,
      Math.floor((baseXp - totalHintXpDeduction) * penaltyMultiplier)
    );
  } else if (willBeExhausted) {
    penaltyMultiplier = exhaustionXpRate;
    earnedXp = Math.max(0, Math.floor(baseXp * exhaustionXpRate));
  } else {
    penaltyMultiplier = 1.0;
    earnedXp = 0;
  }

  // ── Write QuizAttemptResult ───────────────────────────────────────────────
  await QuizAttemptResult.create({
    sessionId:       session._id,
    userId,
    levelId,
    subcategoryId:   (level as any).subcategoryId,
    categoryId:      await resolveCategoryId((level as any).subcategoryId),
    outcome,
    totalQuestions,
    correctAnswers:  correctCount,
    wrongAnswers:    wrongCount,
    score,
    timeLimitSecs:   level.timeLimitMinutes * 60,
    timeTakenSecs,
    baseXp,
    hintXpDeduction: totalHintXpDeduction,
    penaltyMultiplier,
    earnedXp,
    wasExhaustionUnlock,
    answers:         answerDetails,
    submittedAt:     new Date(),
  });

  // ── Close session ─────────────────────────────────────────────────────────
  session.status      = "submitted";
  session.submittedAt = new Date();
  const merged = new Map(session.answers);
  for (const [qId, val] of Object.entries(answers || {})) {
    merged.set(qId, String((val as any).userAnswer ?? ""));
  }
  session.answers = merged;
  await session.save();

  // ── Update UserLevelProgress ──────────────────────────────────────────────
  if (progress) {
    if (isPassing && !progress.isCompleted) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      progress.bestScore   = Math.max(progress.bestScore, score);
      progress.earnedXp    = earnedXp; // stored for records / review display
    } else {
      progress.bestScore = Math.max(progress.bestScore, score);
    }

    if (attemptsUsedNow >= level.maxAttempts && !progress.isCompleted) {
      progress.isExhausted = true;
      progress.earnedXp    = earnedXp;
    }

    await progress.save();

    // ── ADD earned XP to the wallet ──────────────────────────────────────────
    // CRITICAL: We only ADD here. We never set or recalculate the total.
    // Hint deductions already happened in the hint route.
    // This means: wallet = (previous balance after hint deductions) + earnedXp
    // Which is correct — hints are a permanent cost, earnedXp is the reward.
    if (earnedXp > 0 && (progress.isCompleted || progress.isExhausted)) {
      await UserXp.findOneAndUpdate(
        { userId: userObjId },
        { $inc: { totalXp: earnedXp } },
        { upsert: true }
      );
    }

    // Unlock next level on pass or exhaustion
    if (progress.isCompleted || progress.isExhausted) {
      await unlockNextLevel(
        userId,
        level,
        progress.isExhausted && !progress.isCompleted
      );
    }
  }

  // ── Build review payload ──────────────────────────────────────────────────
  const reviewData = questions.map((q, idx) => {
    const detail = answerDetails[idx];
    return {
      questionId:      q._id,
      questionContent: q.questionContent,
      questionType:    q.questionType,
      correctOption:   q.questionType === "option" ? q.correctOption  : null,
      acceptedAnswers: q.questionType === "text"   ? q.acceptedAnswers : null,
      optionA:         q.optionA,
      optionB:         q.optionB,
      optionC:         q.optionC,
      optionD:         q.optionD,
      explanation:     q.explanation,
      userAnswer:      detail.userAnswer,
      isCorrect:       detail.isCorrect,
      hintUsed:        detail.hintUsed,
      hintText:        detail.hintUsed ? q.hintText : null,
    };
  });

  return NextResponse.json({
    success: true,
    result: {
      score,
      totalQuestions,
      correctAnswers:     correctCount,
      wrongAnswers:       wrongCount,
      timeTakenSecs,
      earnedXp,
      baseXp,
      hintXpDeduction:    totalHintXpDeduction,
      penaltyMultiplier,
      wasExhaustionUnlock,
      isPassing,
      canReview,
      outcome,
    },
    review: reviewData,
    progress: {
      isCompleted:       progress?.isCompleted ?? false,
      isExhausted:       progress?.isExhausted ?? false,
      attemptsUsed:      progress?.attemptsUsed ?? 0,
      attemptsRemaining: Math.max(
        0,
        level.maxAttempts - (progress?.attemptsUsed ?? 0)
      ),
    },
  });
}