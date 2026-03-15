// app/api/quiz/submit/route.ts

import { NextRequest, NextResponse }                   from "next/server";
import { connectDB }                                   from "@/app/lib/mongodb";
import { requireAuth }                                 from "@/app/lib/authGuard";
import { Level, UserLevelProgress, UserLevelSession }  from "@/app/models/brain";
import { Question }                                    from "@/app/models/brain/Question";
import { QuizAttemptResult }                           from "@/app/models/brain/QuizAttemptResult";

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
  const { Level: LevelModel, UserLevelProgress: ULP } = await import("@/app/models/brain");
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

  let outcome: "completed" | "abandoned" = "completed";
  if (level.timeLimitMinutes > 0) {
    const elapsedSecs = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    if (elapsedSecs > level.timeLimitMinutes * 60 + 30) {
      outcome = "abandoned";
    }
  }

  const questions = await Question.find({ levelId, status: "published" })
    .sort({ displayOrder: 1 })
    .lean();

  // ── FIX PROBLEM 1: Read hint usage from session.answers (server-persisted) ──
  // The hint route stored "hint:{questionId}" → penalty in the session map.
  // We combine this with what the client sends — whichever says hint=true wins.
  let correctCount         = 0;
  let totalHintXpDeduction = 0;

  const answerDetails = questions.map((q, idx) => {
    const submitted     = answers?.[String(q._id)] || {};
    const userAnswer    = (submitted.userAnswer ?? "").toString().trim();
    const timeTakenSecs = Number(submitted.timeTakenSecs ?? 0);

    // ── Hint: trust server-stored hint record first (survives browser close) ──
    const serverHintKey = `hint:${String(q._id)}`;
    const serverHint    = session.answers.get(serverHintKey);
    const hintUsed      = Boolean(serverHint !== undefined || submitted.hintUsed);
    const hintPenalty   = hintUsed
      ? (serverHint !== undefined ? Number(serverHint) : (q.hintXpPenalty ?? 0))
      : 0;

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

  const progress            = await UserLevelProgress.findOne({ userId, levelId });
  const wasExhaustionUnlock = progress?.unlockedViaExhaustion ?? false;

  const baseXp            = level.xpReward;
  const penaltyMultiplier = wasExhaustionUnlock ? level.penaltyXpMultiplier : 1.0;

  // ── FIX PROBLEM 4: Calculate earnedXp but DON'T assign it yet ──
  // XP is only awarded when level is truly completed (100%) or exhausted.
  // We calculate it here for display, but only write it to progress below
  // under the correct conditions.
  const calculatedXp = Math.max(
    0,
    Math.floor((baseXp - totalHintXpDeduction) * penaltyMultiplier)
  );

  // 100% required to pass
  const PASS_THRESHOLD = 100;
  const isPassing      = score >= PASS_THRESHOLD;

  // Check if this attempt will exhaust the level
  const attemptsAfterThis = (progress?.attemptsUsed ?? 1);
  const willBeExhausted   = attemptsAfterThis >= level.maxAttempts && !isPassing;

  // ── FIX PROBLEM 5: canReview = passed OR exhausted (either condition) ──
  const canReview = isPassing || willBeExhausted;

  // earnedXp to show in result — 0 if not completed and not exhausted yet
  const earnedXp = (isPassing || willBeExhausted) ? calculatedXp : 0;

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

  session.status      = "submitted";
  session.submittedAt = new Date();
  // Merge client answers back into session, preserving server-stored hint keys
  const merged = new Map(session.answers);
  for (const [qId, val] of Object.entries(answers || {})) {
    merged.set(qId, String((val as any).userAnswer ?? ""));
  }
  session.answers = merged;
  await session.save();

  if (progress) {
    if (isPassing && !progress.isCompleted) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      progress.bestScore   = Math.max(progress.bestScore, score);
      // ── FIX PROBLEM 4: Only write XP on completion ──
      progress.earnedXp    = earnedXp;
    } else {
      progress.bestScore = Math.max(progress.bestScore, score);
      // Do NOT update earnedXp for non-passing attempts
    }

    if (progress.attemptsUsed >= level.maxAttempts && !progress.isCompleted) {
      progress.isExhausted = true;
      // ── FIX PROBLEM 4: Write reduced XP on exhaustion ──
      progress.earnedXp    = earnedXp;
    }

    await progress.save();

    if (progress.isCompleted || progress.isExhausted) {
      await unlockNextLevel(
        userId,
        level,
        progress.isExhausted && !progress.isCompleted
      );
    }
  }

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