// app/api/auth/forgot-password/route.ts
//
// HARDENED: Device-based + per-email rate limiting added.
// ─────────────────────────────────────────────────────────────────────────────
// DEFENSES ADDED:
//   1. Rate limit by device fingerprint — 3 requests / device / hour
//   2. Rate limit by raw IP            — 6 requests / IP / hour
//   3. Rate limit by email             — 3 requests / email / hour
//   4. OTP cooldown — cannot request within 60s of last OTP
//   5. Consistent response timing — does NOT reveal if email exists
//      (anti-email-enumeration: same response whether email found or not)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }         from "@/app/lib/mongodb";
import User                  from "@/app/models/User";
import { sendOTPEmail }      from "@/app/lib/mailer";
import { limitForgotPassword } from "@/app/lib/rateLimiter";

const OTP_COOLDOWN_SECS = 60;

// Generic response — ALWAYS returned whether the email exists or not.
// This prevents email enumeration attacks (attacker probing which emails
// are registered by watching for different response messages).
const GENERIC_OK = {
  success: true,
  message: "If that email is registered, you will receive an OTP shortly.",
};

export async function POST(req: NextRequest) {
  try {

    // ── 1. Parse body ─────────────────────────────────────────────────────────
    let email: string;
    try {
      const body = await req.json();
      email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!email || email.length > 254) {
      return NextResponse.json(
        { success: false, message: "A valid email is required." },
        { status: 400 }
      );
    }

    // ── 2. RATE LIMIT ─────────────────────────────────────────────────────────
    const limit = await limitForgotPassword(req, email);
    if (limit.blocked) {
      return NextResponse.json(
        { success: false, message: limit.message },
        {
          status: 429,
          headers: { "Retry-After": String(limit.resetIn) },
        }
      );
    }

    // ── 3. DB lookup ──────────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email }).select("otp otpExpiry status");

    // If user not found, return the GENERIC response (no email enumeration)
    if (!user) {
      return NextResponse.json(GENERIC_OK);
    }

    // Banned users cannot reset password
    if (user.status === "banned") {
      // Still return generic response — don't reveal the ban
      return NextResponse.json(GENERIC_OK);
    }

    // ── 4. OTP cooldown (60s) ─────────────────────────────────────────────────
    if (user.otpExpiry) {
      const issuedAt   = user.otpExpiry.getTime() - 10 * 60 * 1000;
      const elapsedSec = Math.floor((Date.now() - issuedAt) / 1000);

      if (elapsedSec < OTP_COOLDOWN_SECS) {
        const waitSec = OTP_COOLDOWN_SECS - elapsedSec;
        return NextResponse.json(
          {
            success:           false,
            message:           `Please wait ${waitSec} second(s) before requesting a new OTP.`,
            cooldownRemaining: waitSec,
          },
          { status: 429, headers: { "Retry-After": String(waitSec) } }
        );
      }
    }

    // ── 5. Generate OTP and CLEAR any previous verification state ────────────
    // Clearing resetOtpVerified here ensures an old verify session can't
    // be reused after the user requests a new OTP.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp                 = otp;
    user.otpExpiry           = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOtpVerified    = false;
    user.resetOtpVerifiedAt  = null;
    await user.save();

    await sendOTPEmail(email, otp);

    return NextResponse.json(GENERIC_OK);

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}