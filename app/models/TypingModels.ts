// app/models/TypingModels.ts

import mongoose, { Schema, Document, Model } from "mongoose";

// ── TypingResult ───────────────────────────────────────────────
// Mongoose's Document has a built-in `errors: ValidationError` property.
// We use Omit<Document, "errors"> so our numeric `errors` field is safe.
export interface ITypingResult extends Omit<Document, "errors"> {
  userId: mongoose.Types.ObjectId;
  timerDuration: number;
  typingMode: string;
  wpm: number;
  accuracy: number;
  errors: number;
  charactersTyped: number;
  createdAt: Date;
  updatedAt: Date;
}

const TypingResultSchema = new Schema<ITypingResult>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    timerDuration:   { type: Number, required: true },
    typingMode:      { type: String, required: true },
    wpm:             { type: Number, required: true, min: 0 },
    accuracy:        { type: Number, required: true, min: 0, max: 100 },
    errors:          { type: Number, required: true, min: 0 },
    charactersTyped: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);
TypingResultSchema.index({ userId: 1, createdAt: -1 });
TypingResultSchema.index({ userId: 1, timerDuration: 1 });

// ── TypingCustomTimer ──────────────────────────────────────────
export interface ITypingCustomTimer extends Document {
  userId: mongoose.Types.ObjectId;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

const TypingCustomTimerSchema = new Schema<ITypingCustomTimer>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    duration: { type: Number, required: true, min: 1, max: 3600 },
  },
  { timestamps: true }
);
TypingCustomTimerSchema.index({ userId: 1, duration: 1 }, { unique: true });

// ── TypingStats ────────────────────────────────────────────────
// One document per (userId + timerDuration) pair.
// This lets us show separate best-speed / best-accuracy cards for each timer.
// A special timerDuration of 0 is reserved for the global "all timers" aggregate.
export interface ITypingStats extends Document {
  userId: mongoose.Types.ObjectId;
  timerDuration: number;          // e.g. 15, 30, 60, 120 or 0 = global
  highestWpm: number;
  accuracyAtHighestWpm: number;
  highestAccuracy: number;
  wpmAtHighestAccuracy: number;
  totalTests: number;
  totalWpmSum: number;
  updatedAt: Date;
}

const TypingStatsSchema = new Schema<ITypingStats>(
  {
    userId:               { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    timerDuration:        { type: Number, required: true, default: 0 },
    highestWpm:           { type: Number, default: 0 },
    accuracyAtHighestWpm: { type: Number, default: 0 },
    highestAccuracy:      { type: Number, default: 0 },
    wpmAtHighestAccuracy: { type: Number, default: 0 },
    totalTests:           { type: Number, default: 0 },
    totalWpmSum:          { type: Number, default: 0 },
  },
  { timestamps: true }
);
// Unique per user + timerDuration
TypingStatsSchema.index({ userId: 1, timerDuration: 1 }, { unique: true });

// ── Prevent model overwrite on Next.js hot-reload ──────────────
export const TypingResult: Model<ITypingResult> =
  (mongoose.models.TypingResult as Model<ITypingResult>) ||
  mongoose.model<ITypingResult>("TypingResult", TypingResultSchema);

export const TypingCustomTimer: Model<ITypingCustomTimer> =
  (mongoose.models.TypingCustomTimer as Model<ITypingCustomTimer>) ||
  mongoose.model<ITypingCustomTimer>("TypingCustomTimer", TypingCustomTimerSchema);

export const TypingStats: Model<ITypingStats> =
  (mongoose.models.TypingStats as Model<ITypingStats>) ||
  mongoose.model<ITypingStats>("TypingStats", TypingStatsSchema);