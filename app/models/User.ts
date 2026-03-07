


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
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    defaultWorkHours: {
      type: Number,
      default: 8.5,
    },

    role: {
      type: String,
      enum: ["employee", "admin"],
      default: "employee",
    },

    /* Account verification */
    isVerified: {
      type: Boolean,
      default: false,
    },

    otp: String,
    otpExpiry: Date,

    /* Login security */
    loginAttempts: {
      type: Number,
      default: 0,
    },

    isBlocked: {
      type: Boolean,
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

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

/* Prevent model overwrite in Next.js hot reload */
const User =
  mongoose.models.User || mongoose.model("User", UserSchema);

export default User;