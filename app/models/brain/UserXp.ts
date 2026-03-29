// app/models/brain/UserXp.ts
//
// Single source of truth for a user's XP balance.
// Every hint deduction and every XP award writes atomically to this document.
// The /api/quiz/xp GET route reads ONLY from here — no aggregation needed.

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserXp extends Document {
  userId:    mongoose.Types.ObjectId;
  totalXp:   number;
  updatedAt: Date;
}

const UserXpSchema = new Schema<IUserXp>(
  {
    userId:  { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalXp: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);


export const UserXp: Model<IUserXp> =
  mongoose.models.UserXp ||
  mongoose.model<IUserXp>("UserXp", UserXpSchema);