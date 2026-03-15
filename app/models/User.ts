// hourbit\app\models\User.ts

import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

/* Device tracking schema */
const DeviceSchema = new Schema(
  {
    deviceId: {
      type: String,
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    lastLogin: {
      type: Date,
    },

    /* Per-device ban fields — NEW */
    isBanned: {
      type:    Boolean,
      default: false,
    },

    bannedAt: {
      type:    Date,
      default: null,
    },

    banReason: {
      type:    String,
      default: "",
    },
  },
  { _id: false }
);

/* User schema */
const UserSchema = new Schema(
  {
    fullName: {
      type: String,
      trim: true,
    },

    email: {
      type:      String,
      unique:    true,
      required:  true,
      lowercase: true,
      trim:      true,
    },

    password: {
      type:     String,
      required: true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    defaultWorkHours: {
      type:    Number,
      default: 8.5,
    },

    role: {
      type:    String,
      enum:    ["employee", "admin"],
      default: "employee",
    },

    /*
     * NEW: account-level status controlled by admin.
     *
     *  "active"    — normal, can log in
     *  "suspended" — temporarily blocked (blockedUntil stores the lift date)
     *  "banned"    — permanently banned, ALL JWT requests rejected, devices cleared
     *
     * NOTE: the old `isBlocked` / `blockedUntil` pair is KEPT for the
     * existing brute-force / failed-login lockout. They are separate concerns:
     *   isBlocked    = auto temp-lock after too many bad passwords
     *   status       = manual admin action
     */
    status: {
      type:    String,
      enum:    ["active", "suspended", "banned"],
      default: "active",
      index:   true,
    },

    /* Reason & timestamp stored when admin bans/suspends — NEW */
    banReason: {
      type:    String,
      default: "",
    },

    bannedAt: {
      type:    Date,
      default: null,
    },

    /* Account verification */
    isVerified: {
      type:    Boolean,
      default: false,
    },

    otp:       String,
    otpExpiry: Date,

    /* Login security — brute-force lockout (unchanged) */
    loginAttempts: {
      type:    Number,
      default: 0,
    },

    isBlocked: {
      type:    Boolean,
      default: false,
    },

    blockedUntil: Date,

    /* Login tracking */
    lastLogin: Date,

    /* Device tracking */
    devices: [DeviceSchema],
  },
  { timestamps: true }
);

/* Hash password before saving */
UserSchema.pre("save", async function () {
  const user = this as any;
  if (!user.isModified("password")) return;
  const salt    = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

/* Prevent model overwrite in Next.js hot reload */
const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

export default User;