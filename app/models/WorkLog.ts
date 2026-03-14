// app/models/WorkLog.ts

import mongoose, { Schema, Document, Model } from "mongoose";

// ── Break sub-document ─────────────────────────────────────────
export interface IBreak {
  start:    Date;
  end:      Date;
  duration: number; // seconds
  type:     "lunch" | "tea" | "custom";
  label?:   string;
}

// ── WorkLog document ───────────────────────────────────────────
export interface IWorkLog extends Document {
  userId:            mongoose.Types.ObjectId;
  date:              Date;          // midnight UTC of the log day
  entryTime:         Date | null;
  exitTime:          Date | null;
  breaks:            IBreak[];
  totalBreakTime:    number;        // seconds
  totalOfficeTime:   number;        // seconds
  productiveTime:    number;        // seconds

  // ── Per-day required hours ──────────────────────────────────
  // requiredWorkHoursOverride: value the user explicitly set for THIS day only.
  //   null   = not set → fall back to user.defaultWorkHours at query time
  //   number = override for this date only; other days are unaffected
  requiredWorkHoursOverride: number | null;

  // requiredWorkHours: the EFFECTIVE value stored on save.
  //   = requiredWorkHoursOverride ?? user.defaultWorkHours
  //   Kept for backwards-compat with existing analytics queries.
  requiredWorkHours: number;

  isHoliday: boolean;
  notes:     string;
  createdAt: Date;
  updatedAt: Date;
}

const BreakSchema = new Schema<IBreak>(
  {
    start:    { type: Date,   required: true },
    end:      { type: Date,   required: true },
    duration: { type: Number, required: true, min: 0 },
    type: {
      type:    String,
      enum:    ["lunch", "tea", "custom"],
      default: "custom",
    },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const WorkLogSchema = new Schema<IWorkLog>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },

    // Stored as midnight UTC — used for unique index + date-wise queries
    date: {
      type:     Date,
      required: true,
    },

    entryTime: { type: Date, default: null },
    exitTime:  { type: Date, default: null },

    breaks: { type: [BreakSchema], default: [] },

    totalBreakTime:  { type: Number, default: 0 }, // seconds
    totalOfficeTime: { type: Number, default: 0 }, // seconds
    productiveTime:  { type: Number, default: 0 }, // seconds

    // Per-day override — null means "use user profile default"
    requiredWorkHoursOverride: { type: Number, default: null },

    // Effective required hours for this day (override ?? profile default)
    // Always written on save so analytics can read it directly.
    requiredWorkHours: { type: Number, default: 8.5 },

    isHoliday: { type: Boolean, default: false },
    notes:     { type: String,  default: "", trim: true },
  },
  { timestamps: true }
);

// One record per user per day
WorkLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Prevent model overwrite on Next.js hot-reload
const WorkLog: Model<IWorkLog> =
  (mongoose.models.WorkLog as Model<IWorkLog>) ||
  mongoose.model<IWorkLog>("WorkLog", WorkLogSchema);

export default WorkLog;