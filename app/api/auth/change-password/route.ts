// app/api/auth/change-password/route.ts
//
// Three operations, one route:
//
//  POST  { action: "send-otp" }
//        → verifies current password, then sends a 6-digit OTP to the
//          user's registered email. Reuses the existing otp/otpExpiry
//          fields on the User document — no schema change needed.
//
//  POST  { action: "verify-otp", otp: string }
//        → checks the OTP is valid and not expired, returns
//          { success: true, otpVerified: true }. Does NOT clear the OTP
//          yet so the final step can still validate it.
//
//  POST  { action: "change-password", otp: string, newPassword: string }
//        → re-validates the OTP (prevents replay if user skips step 2),
//          applies the new bcrypt-hashed password, and clears otp/otpExpiry.
// app/api/auth/change-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { sendOTPEmail } from "@/app/lib/mailer";

type DecodedToken = {
  userId: string;
  email: string;
  role: string;
  deviceId?: string;
};

async function getAuthedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return { error: "Not authenticated", status: 401 };
  }

  let decoded: DecodedToken;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
  } catch {
    return { error: "Invalid or expired token", status: 401 };
  }

  await connectDB();

  const user = await User.findById(decoded.userId).select(
    "email password otp otpExpiry status banReason blockedUntil devices"
  );

  if (!user) {
    return { error: "User not found", status: 404 };
  }

  if (user.status === "banned") {
    return { error: "Account permanently banned", status: 403 };
  }

  if (user.status === "suspended") {
    if (!user.blockedUntil || user.blockedUntil > new Date()) {
      return { error: "Account suspended", status: 403 };
    }

    user.status = "active";
    user.banReason = "";
    user.blockedUntil = null;
    await user.save();
  }

  if (decoded.deviceId) {
    const device = user.devices?.find((d: any) => d.deviceId === decoded.deviceId);
    if (device?.isBanned) {
      return {
        error: device.banReason || "This device has been banned",
        status: 403,
      };
    }
  }

  return { user };
}

function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, message, ...(extra || {}) },
    { status }
  );
}

export async function POST(req: NextRequest) {
  const result = await getAuthedUser();
  if ("error" in result) {
    return fail(result.error, result.status);
  }

  const { user } = result;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const action = body.action as string | undefined;

  // ─────────────────────────────────────────────
  // 1) SEND OTP
  // ─────────────────────────────────────────────
  if (action === "send-otp") {
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";

    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword) {
      return fail("Current password is required.");
    }

    if (!newPassword) {
      return fail("New password is required.");
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return fail("New password must be between 8 and 128 characters.");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return fail("Current password is incorrect.");
    }

    // 🔥 Prevent same password BEFORE sending OTP
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return fail("New password must be different from the current password.");
    }

    if (user.otpExpiry) {
      const issuedAt = user.otpExpiry.getTime() - 10 * 60 * 1000;
      const elapsedSec = Math.floor((Date.now() - issuedAt) / 1000);
      const COOLDOWN = 60;

      if (elapsedSec < COOLDOWN) {
        return fail(
          "Please wait before requesting a new OTP.",
          429,
          { cooldownRemaining: COOLDOWN - elapsedSec }
        );
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(user.email, otp);

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${user.email}. Valid for 10 minutes.`,
    });
  }

  // ─────────────────────────────────────────────
  // 2) VERIFY OTP
  // ─────────────────────────────────────────────
  if (action === "verify-otp") {
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!otp) {
      return fail("OTP is required.");
    }

    if (!user.otp) {
      return fail("No OTP found. Please request a new one.");
    }

    if (user.otp !== otp) {
      return fail("Invalid OTP. Please check and try again.");
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return fail("OTP has expired. Please request a new one.");
    }

    return NextResponse.json({
      success: true,
      otpVerified: true,
      message: "OTP verified. You may now set your new password.",
    });
  }

  // ─────────────────────────────────────────────
  // 3) CHANGE PASSWORD
  // ─────────────────────────────────────────────
  if (action === "change-password") {
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!otp) {
      return fail("OTP is required.");
    }

    if (!newPassword) {
      return fail("New password is required.");
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return fail("New password must be between 8 and 128 characters.");
    }

    if (!user.otp) {
      return fail("No OTP found. Please request a new one.");
    }

    if (user.otp !== otp) {
      return fail("Invalid OTP.");
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return fail("OTP has expired. Please request a new one.");
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return fail("New password must be different from the current password.");
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  }

  return fail("Unknown action. Expected: send-otp | verify-otp | change-password");
}