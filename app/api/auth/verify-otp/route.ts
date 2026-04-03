// app/api/auth/verify-otp/route.ts
//
// HARDENED: OTP brute-force protection added.
// ─────────────────────────────────────────────────────────────────────────────
// DEFENSES ADDED:
//   1. Pre-check OTP lockout BEFORE doing any DB work
//      (stops bots from hammering even when the DB is down)
//   2. Track failed OTP attempts per email — 5 failures in 15 minutes = locked
//   3. Device-level rate limiting — 20 attempts / device / hour
//   4. On success, clear the per-email failure counter (so a real user who
//      mistyped once isn't punished on their next login)
//
// WHY PER-EMAIL AND NOT PER-DEVICE:
//   An attacker targeting one specific account email will use a single device
//   but hammer it thousands of times. The per-email counter catches this even
//   if the attacker rotates devices/IPs.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }           from "@/app/lib/mongodb";
import User                    from "@/app/models/User";
import { RateLimit }           from "@/app/models/RateLimit";
import {
  isOtpBlocked,
  recordOtpFailure,
  rateLimit,
  getDeviceFingerprint,
}                              from "@/app/lib/rateLimiter";

const ENDPOINT       = "verify-otp";
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

    // ── 2. Device rate limit (generous — real users do retry) ─────────────────
    const fp          = getDeviceFingerprint(req);
    const deviceLimit = await rateLimit(`verify-otp:dev:${fp}`, 20, 60 * 60);
    if (!deviceLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many verification attempts from this device. Try again in ${Math.ceil(deviceLimit.resetIn / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(deviceLimit.resetIn) } }
      );
    }

    // ── 3. Per-email OTP lockout check (NO DB query needed — uses RateLimit) ──
    const lockout = await isOtpBlocked(email, ENDPOINT, MAX_OTP_FAILS, OTP_WINDOW_SEC);
    if (lockout.blocked) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many incorrect OTP attempts. Account verification locked for ${Math.ceil(lockout.resetIn / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(lockout.resetIn) } }
      );
    }

    // ── 4. DB lookup ──────────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email }).select(
      "isVerified otp otpExpiry"
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    if (user.isVerified) {
      return NextResponse.json(
        { success: false, message: "Account is already verified. Please login." },
        { status: 400 }
      );
    }

    if (!user.otp) {
      return NextResponse.json(
        { success: false, message: "No OTP found. Please request a new one." },
        { status: 400 }
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
    if (user.otp !== otp) {
      // Record failure — increments the per-email counter
      const failure = await recordOtpFailure(email, ENDPOINT, MAX_OTP_FAILS, OTP_WINDOW_SEC);

      const baseMsg = "Invalid OTP. Please check and try again.";
      const extraMsg = failure.attemptsLeft > 0
        ? ` ${failure.attemptsLeft} attempt(s) remaining before lockout.`
        : " Account is now locked for 15 minutes.";

      return NextResponse.json(
        { success: false, message: baseMsg + extraMsg },
        { status: 400 }
      );
    }

    // ── 7. SUCCESS — verify account + clear OTP + clear failure counter ───────
    user.isVerified = true;
    user.otp        = null;
    user.otpExpiry  = null;
    await user.save();

    // Clear the failure counter so the user starts fresh next time
    const failKey = `otp-fail:${ENDPOINT}:${email}`;
    await RateLimit.deleteOne({ key: failKey });

    return NextResponse.json({
      success: true,
      message: "Account verified successfully! You can now log in.",
    });

  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}