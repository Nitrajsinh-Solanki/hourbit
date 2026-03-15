// app/api/quiz/results/route.ts — complete updated file

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import { requireAuth }               from "@/app/lib/authGuard";
import { QuizAttemptResult }         from "@/app/models/brain/QuizAttemptResult";
import { Question }                  from "@/app/models/brain/Question";
import { UserLevelProgress }         from "@/app/models/brain";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const levelId = new URL(req.url).searchParams.get("levelId");
  if (!levelId) {
    return NextResponse.json(
      { success: false, message: "levelId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId = auth.payload.userId;

  const result = await QuizAttemptResult.findOne({ userId, levelId })
    .sort({ submittedAt: -1 })
    .lean();

  if (!result) {
    return NextResponse.json(
      { success: false, message: "No result found for this level." },
      { status: 404 }
    );
  }

  // Fetch progress to know exhaustion state for canReview
  const progress = await UserLevelProgress.findOne({ userId, levelId })
    .select("isExhausted isCompleted")
    .lean();

  const isPassing    = result.score === 100;
  const isExhausted  = progress?.isExhausted ?? false;
  // ── FIX PROBLEM 5: canReview if passed OR exhausted ──
  const canReview    = isPassing || isExhausted;

  const questionIds = (result.answers as any[]).map((a: any) => a.questionId);
  const questions   = await Question.find({ _id: { $in: questionIds } })
    .select("_id questionContent questionType correctOption acceptedAnswers optionA optionB optionC optionD explanation hintText")
    .lean();

  const qMap = new Map(questions.map(q => [String(q._id), q]));

  const reviewData = (result.answers as any[]).map((a: any) => {
    const q = qMap.get(String(a.questionId));
    return {
      questionId:      a.questionId,
      questionContent: q?.questionContent ?? "",
      questionType:    q?.questionType    ?? "option",
      correctOption:   q?.questionType === "option" ? q?.correctOption  : null,
      acceptedAnswers: q?.questionType === "text"   ? q?.acceptedAnswers : null,
      optionA:         q?.optionA ?? "",
      optionB:         q?.optionB ?? "",
      optionC:         q?.optionC ?? "",
      optionD:         q?.optionD ?? "",
      explanation:     q?.explanation ?? "",
      userAnswer:      a.userAnswer,
      isCorrect:       a.isCorrect,
      hintUsed:        a.hintUsed,
      hintText:        a.hintUsed ? (q?.hintText ?? null) : null,
    };
  });

  return NextResponse.json({
    success: true,
    result: {
      score:               result.score,
      totalQuestions:      result.totalQuestions,
      correctAnswers:      result.correctAnswers,
      wrongAnswers:        result.wrongAnswers,
      timeTakenSecs:       result.timeTakenSecs,
      earnedXp:            result.earnedXp,
      baseXp:              result.baseXp,
      hintXpDeduction:     result.hintXpDeduction,
      penaltyMultiplier:   result.penaltyMultiplier,
      wasExhaustionUnlock: result.wasExhaustionUnlock,
      isPassing,
      canReview,
      outcome:             result.outcome,
      submittedAt:         result.submittedAt,
    },
    review: reviewData,
  });
}