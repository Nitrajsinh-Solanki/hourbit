// app/models/DiaryEntry.ts
// NEW schema — does NOT modify existing User or WorkLog schemas

import mongoose, { Schema, Document, Model } from "mongoose";

// ── DiaryHeading sub-document ──────────────────────────────────
export interface IDiaryHeading {
  text: string; // max 50 chars
  isDefault: boolean;
}

// ── DiarySettings embedded in User profile (separate collection) ─
export interface IDiarySettings extends Document {
  userId: mongoose.Types.ObjectId;
  headings: IDiaryHeading[]; // global headings for all diary pages
  createdAt: Date;
  updatedAt: Date;
}

// ── DiaryEntry document ────────────────────────────────────────
export interface IDiaryEntry extends Document {
  userId: mongoose.Types.ObjectId;
  entryDate: Date;      // midnight UTC — unique per user per date
  content: string;      // max 1500 characters
  heading: string;      // max 50 characters
  textColor: "black" | "blue" | "red" | "darkgreen";
  mood: string | null;  // emoji key e.g. "happy", "sad" etc.
  editCount: number;    // max 5 edits
  isLocked: boolean;    // true when editCount >= 5
  createdAt: Date;
  updatedAt: Date;
}

// ── DiarySettings schema ───────────────────────────────────────
const DiaryHeadingSchema = new Schema<IDiaryHeading>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const DiarySettingsSchema = new Schema<IDiarySettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,   // one settings doc per user
      index: true,
    },
    headings: {
      type: [DiaryHeadingSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ── DiaryEntry schema ──────────────────────────────────────────
const DiaryEntrySchema = new Schema<IDiaryEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Stored as midnight UTC — fast range queries and unique constraint
    entryDate: {
      type: Date,
      required: true,
    },

    content: {
      type: String,
      default: "",
      maxlength: 1500,
    },

    heading: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },

    textColor: {
      type: String,
      enum: ["black", "blue", "red", "darkgreen"],
      default: "black",
    },

    mood: {
      type: String,
      default: null,
    },

    editCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    isLocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ── Compound index: one entry per user per date (unique) ───────
DiaryEntrySchema.index({ userId: 1, entryDate: 1 }, { unique: true });
// Fast prev/next navigation
DiaryEntrySchema.index({ userId: 1, entryDate: -1 });

// ── Auto-lock when editCount reaches 5 ────────────────────────
DiaryEntrySchema.pre("save", function () {
  if (this.editCount >= 5) {
    this.isLocked = true;
  }
});

// ── Prevent model overwrite on Next.js hot-reload ─────────────
export const DiaryEntry: Model<IDiaryEntry> =
  (mongoose.models.DiaryEntry as Model<IDiaryEntry>) ||
  mongoose.model<IDiaryEntry>("DiaryEntry", DiaryEntrySchema);

export const DiarySettings: Model<IDiarySettings> =
  (mongoose.models.DiarySettings as Model<IDiarySettings>) ||
  mongoose.model<IDiarySettings>("DiarySettings", DiarySettingsSchema);

export default DiaryEntry;