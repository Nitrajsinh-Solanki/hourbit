// app/models/RateLimit.ts
//
// Pure MongoDB rate-limit store. No Redis. No paid services.
//
// Each document represents ONE sliding counter for one (key) pair.
// The TTL index on `expiresAt` makes MongoDB auto-delete expired records —
// zero manual cleanup needed.
//
// Schema is intentionally minimal for speed. Every write is a single
// findOneAndUpdate call — no multi-document transactions required.

import mongoose, { Schema, Model, Document } from "mongoose";

export interface IRateLimit extends Document {
  key:         string;  // e.g. "register:192.168.1.1"
  count:       number;
  windowStart: Date;
  expiresAt:   Date;    // TTL field — MongoDB deletes the doc after this time
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    count: {
      type:    Number,
      default: 0,
    },
    windowStart: {
      type:     Date,
      required: true,
    },
    // MongoDB TTL index — auto-deletes the document after this timestamp.
    // expireAfterSeconds: 0 means "delete exactly at the expiresAt date".
    expiresAt: {
      type:     Date,
      required: true,
    },
  },
  {
    // No createdAt/updatedAt overhead — this is a hot-path collection
    timestamps: false,
    versionKey: false,
  }
);

// ── TTL index ─────────────────────────────────────────────────────────────────
// This is the magic: MongoDB's background reaper will auto-delete expired
// rate-limit windows so the collection never bloats.
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  (mongoose.models.RateLimit as Model<IRateLimit>) ||
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);

export default RateLimit;