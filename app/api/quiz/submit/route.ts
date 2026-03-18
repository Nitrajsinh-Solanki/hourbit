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

import { NextRequest, NextResponse }                   from "next/server";
import { connectDB }                                   from "@/app/lib/mongodb";
import { requireAuth }                                 from "@/app/lib/authGuard";
import { Level, UserLevelProgress, UserLevelSession }  from "@/app/models/brain";
import { Question }                                    from "@/app/models/brain/Question";
import { QuizAttemptResult }                           from "@/app/models/brain/QuizAttemptResult";

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

  const userId = auth.payload.userId;

  // Verify session
  const session = await UserLevelSession.findOne({
    _id:    sessionId,
    userId,
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

  // Fetch all published questions for this level (server-authoritative grading)
  const questions = await Question.find({ levelId, status: "published" })
    .sort({ displayOrder: 1 })
    .lean();

  // ── Grade answers ────────────────────────────────────────────────────────
  let correctCount         = 0;
  let totalHintXpDeduction = 0;

  const answerDetails = questions.map((q, idx) => {
    const submitted     = answers?.[String(q._id)] || {};
    const userAnswer    = (submitted.userAnswer ?? "").toString().trim();
    const timeTakenSecs = Number(submitted.timeTakenSecs ?? 0);

    // Server-stored hint record wins (survives browser close)
    const serverHintKey = `hint:${String(q._id)}`;
    const serverHint    = session.answers.get(serverHintKey);
    const hintUsed      = Boolean(serverHint !== undefined || submitted.hintUsed);
    const hintPenalty   = hintUsed
      ? serverHint !== undefined
        ? Number(serverHint)
        : (q.hintXpPenalty ?? 0)
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

  // ── XP CALCULATION ───────────────────────────────────────────────────────
  //
  // attemptsUsed was already incremented when the session was created, so it
  // reflects the count INCLUDING this attempt.
  const attemptsUsedNow = progress?.attemptsUsed ?? 1;

  // PASS: score === 100%
  const isPassing = score === 100;

  // EXHAUSTED: all attempts used up on this submission and level not passed
  const willBeExhausted = attemptsUsedNow >= level.maxAttempts && !isPassing;

  // canReview: the user gets to see correct answers only after passing OR exhaustion
  const canReview = isPassing || willBeExhausted;

  // ── Three XP cases ────────────────────────────────────────────────────────
  //
  // CASE 1 — PASS
  //   Full XP minus hint penalties, then apply exhaustion-unlock multiplier
  //   if THIS level was unlocked via exhaustion of the PREVIOUS level.
  //   (wasExhaustionUnlock describes how this level was UNLOCKED, not how it ENDED)
  //
  // CASE 2 — LAST ATTEMPT FAIL (exhaustion)
  //   30% of base XP, NO hint deduction.
  //   The admin sets penaltyXpMultiplier (default 0.30) — this is what's used.
  //
  // CASE 3 — NON-LAST ATTEMPT FAIL
  //   0 XP. User must try again.

  const wasExhaustionUnlock  = progress?.unlockedViaExhaustion ?? false;
  const baseXp               = level.xpReward;
  // penaltyXpMultiplier from admin (e.g. 0.30 = 30%)
  const exhaustionXpRate     = level.penaltyXpMultiplier ?? 0.30;

  let earnedXp:          number;
  let penaltyMultiplier: number;

  if (isPassing) {
    // CASE 1: Pass
    // Apply exhaustion-unlock penalty ONLY if this level was unlocked via
    // exhaustion of the previous level (admin's "you cheated your way in" tax)
    penaltyMultiplier = wasExhaustionUnlock ? exhaustionXpRate : 1.0;
    earnedXp = Math.max(
      0,
      Math.floor((baseXp - totalHintXpDeduction) * penaltyMultiplier)
    );
  } else if (willBeExhausted) {
    // CASE 2: Last attempt failed — award 30% of base XP, no hint deduction
    penaltyMultiplier = exhaustionXpRate; // e.g. 0.30
    earnedXp = Math.max(0, Math.floor(baseXp * exhaustionXpRate));
  } else {
    // CASE 3: Non-last attempt fail — no XP
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
      // Level passed — mark complete, write full XP
      progress.isCompleted = true;
      progress.completedAt = new Date();
      progress.bestScore   = Math.max(progress.bestScore, score);
      progress.earnedXp    = earnedXp;
    } else {
      // Non-passing attempt — update best score only
      progress.bestScore = Math.max(progress.bestScore, score);
      // earnedXp stays 0 until completion or exhaustion
    }

    if (attemptsUsedNow >= level.maxAttempts && !progress.isCompleted) {
      // All attempts exhausted — award 30% XP
      progress.isExhausted = true;
      progress.earnedXp    = earnedXp; // already = floor(baseXp * 0.30)
    }

    await progress.save();

    // Unlock next level immediately on pass or exhaustion
    if (progress.isCompleted || progress.isExhausted) {
      await unlockNextLevel(
        userId,
        level,
        // viaExhaustion flag for the NEXT level's unlock context
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