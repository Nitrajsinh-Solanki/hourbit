// app/models/brain/Level.ts
// ─────────────────────────────────────────────────────────────────────────────
// THIRD level of the hierarchy:  Category → Subcategory → Level → Question
//
// FOREIGN KEY:  subcategoryId → Subcategory._id
//
// CASCADE DELETION:
//   Level's post-hook calls Question.deleteMany({ levelId }) — Questions are
//   the leaf node so no further cascade is needed.
//
// THREE SCHEMAS IN ONE FILE (tightly coupled):
//   1. Level              — the level definition
//   2. UserLevelProgress  — tracks each user's attempts, completion, XP earned
//   3. UserLevelSession   — anti-cheat: every started attempt is recorded;
//                           abandoned sessions count as a used attempt
//
// BUSINESS RULES encoded as schema fields:
//   xpReward             — full XP for a clean completion
//   penaltyXpMultiplier  — 0.30 by default; applied when user unlocked via exhaustion
//   maxAttempts          — once attemptsUsed >= maxAttempts, level is force-unlocked
//   timeLimitMinutes     — 0 = no time limit
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document, Model } from "mongoose";

// ══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════════════════════════════════════════

export interface ILevel extends Document {
  subcategoryId:       mongoose.Types.ObjectId;
  levelNumber:         number;
  name:                string;
  difficulty:          "easy" | "medium" | "hard" | "expert";
  xpReward:            number;
  penaltyXpMultiplier: number;
  maxAttempts:         number;
  questionCount:       number;
  timeLimitMinutes:    number;
  displayOrder:        number;
  status:              "active" | "archived" | "deleted";
  createdAt:           Date;
  updatedAt:           Date;
}

export interface IUserLevelProgress extends Document {
  userId:                mongoose.Types.ObjectId;
  levelId:               mongoose.Types.ObjectId;
  subcategoryId:         mongoose.Types.ObjectId;
  categoryId:            mongoose.Types.ObjectId;
  attemptsUsed:          number;
  isCompleted:           boolean;
  isExhausted:           boolean;
  unlockedViaExhaustion: boolean;
  bestScore:             number;
  earnedXp:              number;
  completedAt:           Date | null;
  createdAt:             Date;
  updatedAt:             Date;
}

export interface IUserLevelSession extends Document {
  userId:      mongoose.Types.ObjectId;
  levelId:     mongoose.Types.ObjectId;
  status:      "started" | "submitted" | "abandoned";
  startedAt:   Date;
  submittedAt: Date | null;
  abandonedAt: Date | null;
  answers:     Map<string, string>;
  createdAt:   Date;
  updatedAt:   Date;
}

// ══════════════════════════════════════════════════════════════════════════════
// LEVEL SCHEMA
// ══════════════════════════════════════════════════════════════════════════════

const LevelSchema = new Schema<ILevel>(
  {
    /* ── Foreign key ── */
    subcategoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Subcategory",
      required: true,
      index:    true,
    },

    /* ── Identity ── */
    levelNumber: {
      type:     Number,
      required: true,
      min:      1,
    },

    name: {
      type:      String,
      trim:      true,
      default:   "",
      maxlength: 120,
    },

    /* ── Difficulty ── */
    difficulty: {
      type:    String,
      enum:    ["easy", "medium", "hard", "expert"],
      default: "easy",
    },

    /* ── XP rules ── */
    xpReward: {
      type:    Number,
      default: 100,
      min:     0,
    },

    // 0.30 = 30% — applied when user unlocks next level via exhaustion
    penaltyXpMultiplier: {
      type:    Number,
      default: 0.30,
      min:     0,
      max:     1,
    },

    /* ── Attempt rules ── */
    maxAttempts: {
      type:    Number,
      default: 3,
      min:     1,
    },

    /* ── Content config ── */
    questionCount: {
      type:    Number,
      default: 10,
      min:     1,
    },

    timeLimitMinutes: {
      type:    Number,
      default: 0,   // 0 = no limit
      min:     0,
    },

    /* ── Ordering & visibility ── */
    displayOrder: {
      type:    Number,
      default: 0,
    },

    status: {
      type:    String,
      enum:    ["active", "archived", "deleted"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Level number must be unique within a subcategory
LevelSchema.index({ subcategoryId: 1, levelNumber: 1 }, { unique: true });
LevelSchema.index({ subcategoryId: 1, displayOrder: 1 });
LevelSchema.index({ subcategoryId: 1, status: 1 });

// ── Post findOneAndDelete CASCADE → bulk-delete all Questions ─────────────────

LevelSchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  const { Question } = await import("./Question");
  await Question.deleteMany({ levelId: doc._id });
});

// ══════════════════════════════════════════════════════════════════════════════
// USER LEVEL PROGRESS SCHEMA
// One document per (userId × levelId) — never duplicated
// ══════════════════════════════════════════════════════════════════════════════

const UserLevelProgressSchema = new Schema<IUserLevelProgress>(
  {
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

    /* Denormalized for fast dashboard / analytics queries */
    subcategoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Subcategory",
      required: true,
    },

    categoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Category",
      required: true,
    },

    /* ── Attempt tracking ── */
    attemptsUsed: {
      type:    Number,
      default: 0,
      min:     0,
    },

    isCompleted: {
      type:    Boolean,
      default: false,
    },

    // true when attemptsUsed >= level.maxAttempts and level was not completed
    isExhausted: {
      type:    Boolean,
      default: false,
    },

    // true if THIS level was unlocked because the PREVIOUS level was exhausted
    // → earnedXp will be xpReward * penaltyXpMultiplier when completed
    unlockedViaExhaustion: {
      type:    Boolean,
      default: false,
    },

    /* ── Performance ── */
    bestScore: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },

    earnedXp: {
      type:    Number,
      default: 0,
      min:     0,
    },

    completedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One progress doc per user per level
UserLevelProgressSchema.index({ userId: 1, levelId: 1 },        { unique: true });
UserLevelProgressSchema.index({ userId: 1, subcategoryId: 1 });
UserLevelProgressSchema.index({ userId: 1, categoryId: 1 });
UserLevelProgressSchema.index({ levelId: 1 });

// ══════════════════════════════════════════════════════════════════════════════
// USER LEVEL SESSION SCHEMA  (anti-cheat)
// One document per attempt.  If status stays "started" after timeLimitMinutes
// has elapsed (checked on next visit), it is marked "abandoned" and the attempt
// is counted — preventing users from refreshing to reset attempts.
// ══════════════════════════════════════════════════════════════════════════════

const UserLevelSessionSchema = new Schema<IUserLevelSession>(
  {
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

    /* ── Session lifecycle ── */
    status: {
      type:    String,
      enum:    ["started", "submitted", "abandoned"],
      default: "started",
      index:   true,
    },

    startedAt: {
      type:    Date,
      default: Date.now,
    },

    submittedAt: {
      type:    Date,
      default: null,
    },

    abandonedAt: {
      type:    Date,
      default: null,
    },

    /* ── In-progress answer snapshot ── */
    // key = questionId string, value = selected option letter or typed answer
    answers: {
      type:    Map,
      of:      String,
      default: {},
    },
  },
  { timestamps: true }
);

UserLevelSessionSchema.index({ userId: 1, levelId: 1, status: 1 });

// TTL index: auto-expire documents from MongoDB 24 h after they were created.
// The application layer marks them "abandoned" before this fires — this is just
// a safety cleanup for truly orphaned sessions.
UserLevelSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: 86400 });

// ── Models ────────────────────────────────────────────────────────────────────

export const Level: Model<ILevel> =
  (mongoose.models.Level as Model<ILevel>) ||
  mongoose.model<ILevel>("Level", LevelSchema);

export const UserLevelProgress: Model<IUserLevelProgress> =
  (mongoose.models.UserLevelProgress as Model<IUserLevelProgress>) ||
  mongoose.model<IUserLevelProgress>("UserLevelProgress", UserLevelProgressSchema);

export const UserLevelSession: Model<IUserLevelSession> =
  (mongoose.models.UserLevelSession as Model<IUserLevelSession>) ||
  mongoose.model<IUserLevelSession>("UserLevelSession", UserLevelSessionSchema);

export default Level;