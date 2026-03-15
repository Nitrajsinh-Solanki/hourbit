// app/models/brain/QuizAttemptResult.ts
// ─────────────────────────────────────────────────────────────────────────────
// Stores the permanent record of a completed quiz attempt.
//
// RELATIONSHIP TO EXISTING SCHEMAS:
//   sessionId  → UserLevelSession._id  (the attempt that was started)
//   userId     → User._id
//   levelId    → Level._id
//   subcategoryId / categoryId — denormalized for fast analytics queries
//
// ONE DOCUMENT PER COMPLETED OR ABANDONED ATTEMPT.
// Draft/in-progress state is handled by UserLevelSession.answers (already exists).
// This document is only written at submit time or abandoned-auto-submit time.
//
// XP CALCULATION (stored final, calculated at submit time):
//   baseXp              = Level.xpReward
//   hintXpDeduction     = sum of all hintXpPenalty values for hints used
//   exhaustionMultiplier= Level.penaltyXpMultiplier if unlockedViaExhaustion
//   finalXp             = (baseXp - hintXpDeduction) * exhaustionMultiplier
//                         (floored at 0, never negative)
//
// SCORE CALCULATION:
//   score = (correctAnswers / totalQuestions) * 100  — stored as 0-100 integer
//
// WHY NOT STORE STATS SEPARATELY:
//   Per the requirements, Brain Stats are calculated dynamically from these
//   documents at query time — no pre-aggregated stats collection needed.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document, Model } from "mongoose";

// ── Per-question answer detail sub-document ───────────────────────────────────
// One of these is embedded per question in every attempt result.
// The acceptedAnswers / correctOption are NOT stored here to avoid data
// duplication — they are fetched from Question collection at review time.
// We only store what the user did and whether it was right.

export interface IQuizAnswerDetail {
  questionId:    mongoose.Types.ObjectId; // → Question._id
  questionIndex: number;                  // 0-based position in this attempt
  userAnswer:    string;                  // the answer the user submitted (option letter OR typed text)
  isCorrect:     boolean;                 // evaluated at submit time
  hintUsed:      boolean;                 // true if user clicked "Show Hint" for this question
  hintXpPenalty: number;                  // penalty applied (0 if hint not used)
  timeTakenSecs: number;                  // seconds spent on this specific question
}

// ── Main attempt result interface ─────────────────────────────────────────────

export interface IQuizAttemptResult extends Document {
  /* ── Foreign keys ── */
  sessionId:     mongoose.Types.ObjectId; // → UserLevelSession._id (the attempt)
  userId:        mongoose.Types.ObjectId; // → User._id
  levelId:       mongoose.Types.ObjectId; // → Level._id
  subcategoryId: mongoose.Types.ObjectId; // denormalized → Subcategory._id
  categoryId:    mongoose.Types.ObjectId; // denormalized → Category._id

  /* ── Attempt outcome ── */
  // "completed" = user clicked Submit or timer ran out with all questions answered
  // "abandoned" = timer ran out or browser closed — auto-submitted with partial answers
  outcome:      "completed" | "abandoned";

  /* ── Score ── */
  totalQuestions:  number; // how many questions were in this level attempt
  correctAnswers:  number; // how many the user got right
  wrongAnswers:    number; // totalQuestions - correctAnswers
  score:           number; // 0–100 integer = (correctAnswers / totalQuestions) * 100

  /* ── Timing ── */
  timeLimitSecs:   number; // Level.timeLimitMinutes * 60 (0 = no limit)
  timeTakenSecs:   number; // actual seconds from startedAt to submittedAt

  /* ── XP ── */
  baseXp:             number; // Level.xpReward at time of attempt
  hintXpDeduction:    number; // total XP lost to hints across all questions
  penaltyMultiplier:  number; // 1.0 normally, Level.penaltyXpMultiplier if exhaustion-unlocked
  earnedXp:           number; // final XP after all deductions and multipliers

  /* ── Context flags ── */
  // true if this level was unlocked because previous level was exhausted
  // (determines whether penaltyMultiplier < 1 applies)
  wasExhaustionUnlock: boolean;

  /* ── Per-question breakdown ── */
  answers: IQuizAnswerDetail[];

  /* ── Timestamps ── */
  submittedAt: Date;
  createdAt:   Date;
  updatedAt:   Date;
}

// ── Sub-document schema ───────────────────────────────────────────────────────

const QuizAnswerDetailSchema = new Schema<IQuizAnswerDetail>(
  {
    questionId: {
      type:     Schema.Types.ObjectId,
      ref:      "Question",
      required: true,
    },

    // 0-based index of this question in the attempt (preserves order for review)
    questionIndex: {
      type:     Number,
      required: true,
      min:      0,
    },

    // For option-type: "A" | "B" | "C" | "D" | "" (empty = skipped/abandoned)
    // For text-type:   the raw string the user typed (empty = skipped/abandoned)
    userAnswer: {
      type:    String,
      default: "",
    },

    isCorrect: {
      type:    Boolean,
      default: false,
    },

    hintUsed: {
      type:    Boolean,
      default: false,
    },

    // Stored explicitly so the result screen can show exact XP deduction per question
    hintXpPenalty: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // How many seconds the user spent on this question before moving on
    // Tracked client-side and submitted with the final payload
    timeTakenSecs: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  { _id: false } // sub-document — no separate _id needed
);

// ── Main schema ───────────────────────────────────────────────────────────────

const QuizAttemptResultSchema = new Schema<IQuizAttemptResult>(
  {
    /* ── Foreign keys ── */
    sessionId: {
      type:     Schema.Types.ObjectId,
      ref:      "UserLevelSession",
      required: true,
      unique:   true,  // one result per session — prevents double-submit
      index:    true,
    },

    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    levelId: {
      type:     Schema.Types.ObjectId,
      ref:      "Level",
      required: true,
      index:    true,
    },

    // Denormalized for fast "all results in this subcategory/category" queries
    subcategoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Subcategory",
      required: true,
      index:    true,
    },

    categoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Category",
      required: true,
      index:    true,
    },

    /* ── Attempt outcome ── */
    outcome: {
      type:    String,
      enum:    ["completed", "abandoned"],
      default: "completed",
      index:   true,
    },

    /* ── Score ── */
    totalQuestions: {
      type:    Number,
      required: true,
      min:     1,
    },

    correctAnswers: {
      type:    Number,
      default: 0,
      min:     0,
    },

    wrongAnswers: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // 0–100 integer
    score: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },

    /* ── Timing ── */
    timeLimitSecs: {
      type:    Number,
      default: 0,  // 0 = no limit
      min:     0,
    },

    timeTakenSecs: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /* ── XP breakdown ── */
    baseXp: {
      type:    Number,
      default: 0,
      min:     0,
    },

    hintXpDeduction: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // 1.0 = no penalty, < 1.0 = penalty multiplier (e.g. 0.30)
    penaltyMultiplier: {
      type:    Number,
      default: 1.0,
      min:     0,
      max:     1,
    },

    earnedXp: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /* ── Context ── */
    wasExhaustionUnlock: {
      type:    Boolean,
      default: false,
    },

    /* ── Per-question breakdown ── */
    answers: {
      type:    [QuizAnswerDetailSchema],
      default: [],
    },

    /* ── Submission timestamp ── */
    submittedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary lookup: all results for a user on a specific level (history view)
QuizAttemptResultSchema.index({ userId: 1, levelId: 1 });

// Dashboard: all results for a user in a subcategory / category
QuizAttemptResultSchema.index({ userId: 1, subcategoryId: 1 });
QuizAttemptResultSchema.index({ userId: 1, categoryId: 1 });

// Analytics: all results for a level (admin view, leaderboard)
QuizAttemptResultSchema.index({ levelId: 1, score: -1 });

// Dynamic stats calculation: sort by date for time-series analysis
QuizAttemptResultSchema.index({ userId: 1, createdAt: -1 });

// ── Model ─────────────────────────────────────────────────────────────────────

export const QuizAttemptResult: Model<IQuizAttemptResult> =
  (mongoose.models.QuizAttemptResult as Model<IQuizAttemptResult>) ||
  mongoose.model<IQuizAttemptResult>("QuizAttemptResult", QuizAttemptResultSchema);

export default QuizAttemptResult;