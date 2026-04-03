// app/api/auth/verify-reset-otp/route.ts
//
// HARDENED: OTP brute-force + sets server-side proof of verification.
// ─────────────────────────────────────────────────────────────────────────────
// DEFENSES ADDED:
//   1. Per-email OTP failure counter — 5 failures in 15 min = locked
//   2. Device rate limiting — 20 attempts / device / hour
//   3. Sets `resetOtpVerified = true` + `resetOtpVerifiedAt = now` in MongoDB
//      so that reset-password can verify OTP was ACTUALLY checked here.
//      Without this field, anyone who knows an email could change the password
//      by calling /reset-password directly (the original CRITICAL BUG).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }         from "@/app/lib/mongodb";
import User                  from "@/app/models/User";
import { RateLimit }         from "@/app/models/RateLimit";
import {
  isOtpBlocked,
  recordOtpFailure,
  rateLimit,
  getDeviceFingerprint,
}                            from "@/app/lib/rateLimiter";

const ENDPOINT       = "verify-reset-otp";
const MAX_OTP_FAILS  = 5;
const OTP_WINDOW_SEC = 15 * 60; // 15 minutes

export async function POST(req: NextRequest) {
  try {

    // ── 1. Parse body ─────────────────────────────────────────────────────────
    let email: string, otp: string;
    try {
      const body = await req.json();
      email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      otp   = typeof body.otp   === "string" ? body.otp.trim()                : "";
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email and OTP are required." },
        { status: 400 }
      );
    }

    // ── 2. Device rate limit ──────────────────────────────────────────────────
    const fp          = getDeviceFingerprint(req);
    const deviceLimit = await rateLimit(`verify-reset:dev:${fp}`, 20, 60 * 60);
    if (!deviceLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many attempts from this device. Try again in ${Math.ceil(deviceLimit.resetIn / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(deviceLimit.resetIn) } }
      );
    }

    // ── 3. Per-email OTP lockout check ────────────────────────────────────────
    const lockout = await isOtpBlocked(email, ENDPOINT, MAX_OTP_FAILS, OTP_WINDOW_SEC);
    if (lockout.blocked) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many incorrect OTP attempts. Locked for ${Math.ceil(lockout.resetIn / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(lockout.resetIn) } }
      );
    }

    // ── 4. DB lookup ──────────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email }).select(
      "otp otpExpiry status resetOtpVerified resetOtpVerifiedAt"
    );

    // Generic "invalid" response — don't reveal whether email exists
    if (!user) {
      await recordOtpFailure(email, ENDPOINT, MAX_OTP_FAILS, OTP_WINDOW_SEC);
      return NextResponse.json(
        { success: false, message: "Invalid OTP or email." },
        { status: 400 }
      );
    }

    // Banned users cannot reset password
    if (user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "This account is not accessible." },
        { status: 403 }
      );
    }

    // ── 5. OTP expiry check ───────────────────────────────────────────────────
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return NextResponse.json(
        { success: false, message: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // ── 6. OTP match check ────────────────────────────────────────────────────
    if (!user.otp || user.otp !== otp) {
      const failure = await recordOtpFailure(email, ENDPOINT, MAX_OTP_FAILS, OTP_WINDOW_SEC);

      const baseMsg  = "Invalid OTP.";
      const extraMsg = failure.attemptsLeft > 0
        ? ` ${failure.attemptsLeft} attempt(s) remaining.`
        : " OTP verification locked for 15 minutes.";

      return NextResponse.json(
        { success: false, message: baseMsg + extraMsg },
        { status: 400 }
      );
    }

    // ── 7. SUCCESS — set the server-side verification proof ───────────────────
    // This is the KEY security fix. reset-password MUST see these fields
    // in the DB before it will change the password. An attacker who calls
    // /reset-password directly (skipping this route) cannot set these fields.
    user.resetOtpVerified   = true;
    user.resetOtpVerifiedAt = new Date();
    // Do NOT clear user.otp yet — reset-password will do a final check there
    await user.save();

    // Clear failure counter
    const failKey = `otp-fail:${ENDPOINT}:${email}`;
    await RateLimit.deleteOne({ key: failKey });

    return NextResponse.json({
      success: true,
      message: "OTP verified. You may now reset your password.",
    });

  } catch (error) {
    console.error("VERIFY RESET OTP ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}