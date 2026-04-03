// app/models/User.ts
// UPDATED: Added `resetOtpVerified` + `resetOtpVerifiedAt` fields to fix
// the CRITICAL BUG in reset-password (password was changeable without OTP).

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

    /* Per-device ban fields */
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
     * Account-level status controlled by admin:
     *  "active"    — normal, can log in
     *  "suspended" — temporarily blocked (blockedUntil stores the lift date)
     *  "banned"    — permanently banned
     */
    status: {
      type:    String,
      enum:    ["active", "suspended", "banned"],
      default: "active",
      index:   true,
    },

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

    // ─────────────────────────────────────────────────────────────────────
    // CRITICAL BUG FIX: reset-password used to change the password without
    // verifying the OTP first. These two fields create a server-side
    // "proof of OTP verification" that reset-password MUST check before
    // changing the password. No amount of client-side tampering can bypass
    // this because it lives in the database.
    //
    // Flow:
    //   1. /forgot-password  → sends OTP, sets otp + otpExpiry
    //   2. /verify-reset-otp → checks OTP, sets resetOtpVerified=true +
    //                          resetOtpVerifiedAt=now, does NOT clear otp yet
    //   3. /reset-password   → checks resetOtpVerified===true AND
    //                          resetOtpVerifiedAt is < 15 minutes ago,
    //                          THEN changes password + clears all OTP fields
    //
    // resetOtpVerifiedAt is an extra safety net: even if someone somehow
    // sets resetOtpVerified=true, it expires in 15 minutes.
    // ─────────────────────────────────────────────────────────────────────
    resetOtpVerified: {
      type:    Boolean,
      default: false,
    },

    resetOtpVerifiedAt: {
      type:    Date,
      default: null,
    },

    /* Login security — brute-force lockout */
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