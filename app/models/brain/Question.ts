// app/models/brain/Question.ts
// ─────────────────────────────────────────────────────────────────────────────
// LEAF of the hierarchy:  Category → Subcategory → Level → Question
//
// FOREIGN KEY:  levelId → Level._id
//
// DENORMALIZED FKs:
//   subcategoryId and categoryId are stored directly on every Question so the
//   admin can filter "all questions in category X" without multi-hop lookups.
//   These are always set by the API layer when creating a question.
//
// TWO QUESTION TYPES:
//   "option" → 4 choices (A/B/C/D), one marked correct via correctOption
//   "text"   → one or more accepted text answers, matched case-insensitively
//
// HINT SYSTEM:
//   hintText       = the hint string (empty = no hint available)
//   hintXpPenalty  = XP deducted from level's xpReward when user reveals hint
//
// EXPLANATION:
//   Shown to the user after level completion OR after exhausting all attempts.
//
// STATUS:
//   "draft"     → not visible to users, admin can edit freely
//   "published" → live and visible inside the level
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document, Model } from "mongoose";

// ── TypeScript Interface ──────────────────────────────────────────────────────

export interface IQuestion extends Document {
  /* ── Hierarchy FKs ── */
  levelId:         mongoose.Types.ObjectId;
  subcategoryId:   mongoose.Types.ObjectId;
  categoryId:      mongoose.Types.ObjectId;

  /* ── Question type ── */
  questionType:    "option" | "text";

  /* ── Content ── */
  questionContent: string;

  /* ── Option-type fields ── */
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  correctOption:   "A" | "B" | "C" | "D" | "";

  /* ── Text-type fields ── */
  acceptedAnswers: string[];

  /* ── Hint ── */
  hintText:        string;
  hintXpPenalty:   number;

  /* ── Explanation ── */
  explanation:     string;

  /* ── Ordering & publishing ── */
  displayOrder:    number;
  status:          "draft" | "published";

  /* ── Timestamps ── */
  createdAt:       Date;
  updatedAt:       Date;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const QuestionSchema = new Schema<IQuestion>(
  {
    /* ── Hierarchy foreign keys ── */
    levelId: {
      type:     Schema.Types.ObjectId,
      ref:      "Level",
      required: true,
      index:    true,
    },

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

    /* ── Question type ── */
    questionType: {
      type:     String,
      enum:     ["option", "text"],
      required: true,
    },

    /* ── Content ── */
    questionContent: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 2000,
    },

    /* ── MCQ options (used only when questionType === "option") ── */
    optionA: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

    optionB: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

    optionC: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

    optionD: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

    // Which option (A/B/C/D) is correct — enforced in application layer
    correctOption: {
      type:    String,
      enum:    ["A", "B", "C", "D", ""],
      default: "",
    },

    /* ── Text answers (used only when questionType === "text") ── */
    // Stored lowercase — matched case-insensitively at runtime
    acceptedAnswers: {
      type:    [String],
      default: [],
    },

    /* ── Hint ── */
    hintText: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

    hintXpPenalty: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /* ── Explanation ── */
    explanation: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 2000,
    },

    /* ── Ordering ── */
    displayOrder: {
      type:    Number,
      default: 0,
    },

    /* ── Publishing status ── */
    status: {
      type:    String,
      enum:    ["draft", "published"],
      default: "draft",
      index:   true,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary query: all published questions for a level in order
QuestionSchema.index({ levelId: 1, status: 1, displayOrder: 1 });

// Admin filter: all questions under a subcategory / category
QuestionSchema.index({ subcategoryId: 1, status: 1 });
QuestionSchema.index({ categoryId: 1,    status: 1 });

// Analytics
QuestionSchema.index({ levelId: 1,    questionType: 1 });
QuestionSchema.index({ categoryId: 1, questionType: 1 });

// ── Pre-save: normalise data based on question type ───────────────────────────
// Pattern matches exactly how your codebase writes hooks:
//   SchemaName.pre("save", function () { const doc = this as any; ... })

QuestionSchema.pre("save", function () {
  const doc = this as any;

  if (doc.questionType === "text") {
    // Lowercase all accepted answers for case-insensitive matching
    if (doc.isModified("acceptedAnswers")) {
      doc.acceptedAnswers = doc.acceptedAnswers.map(
        (a: string) => a.toLowerCase().trim()
      );
    }
    // Clear MCQ fields to keep the document clean
    doc.optionA       = "";
    doc.optionB       = "";
    doc.optionC       = "";
    doc.optionD       = "";
    doc.correctOption = "";
  }

  if (doc.questionType === "option") {
    // Clear text-answer fields to keep the document clean
    doc.acceptedAnswers = [];
  }
});

// ── Prevent model overwrite on Next.js hot reload ─────────────────────────────

export const Question: Model<IQuestion> =
  (mongoose.models.Question as Model<IQuestion>) ||
  mongoose.model<IQuestion>("Question", QuestionSchema);

export default Question;