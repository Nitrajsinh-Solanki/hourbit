// app/api/auth/reset-password/route.ts
//
// CRITICAL BUG FIXED + HARDENED
// ─────────────────────────────────────────────────────────────────────────────
// THE ORIGINAL CRITICAL BUG:
//   The old code accepted { email, password } and changed the password
//   IMMEDIATELY — no OTP check whatsoever. Any attacker who knew your email
//   could call this endpoint and change your password in one request.
//
// THE FIX:
//   We now check `user.resetOtpVerified === true` and that
//   `user.resetOtpVerifiedAt` is within the last 15 minutes.
//   These fields are ONLY set by /verify-reset-otp after a valid OTP check.
//   They live in MongoDB — no client can forge them.
//
// ADDITIONAL DEFENSES:
//   1. Rate limit by device — 5 attempts / device / hour
//   2. Rate limit by IP     — 5 attempts / IP / hour
//   3. Password length validation
//   4. Re-check: OTP fields are cleared after successful reset (one-time use)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }        from "@/app/lib/mongodb";
import User                 from "@/app/models/User";
import { limitResetPassword } from "@/app/lib/rateLimiter";

// How long the verified state is valid after verify-reset-otp (in ms)
const VERIFIED_STATE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {

    // ── 1. RATE LIMIT ─────────────────────────────────────────────────────────
    const limit = await limitResetPassword(req);
    if (limit.blocked) {
      return NextResponse.json(
        { success: false, message: limit.message },
        {
          status: 429,
          headers: { "Retry-After": String(limit.resetIn) },
        }
      );
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let email: string, password: string;
    try {
      const body = await req.json();
      email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
      password = typeof body.password === "string" ? body.password                  : "";
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and new password are required." },
        { status: 400 }
      );
    }

    // ── 3. Password strength check ────────────────────────────────────────────
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { success: false, message: "Password must be 8–128 characters." },
        { status: 400 }
      );
    }

    // ── 4. DB lookup ──────────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email }).select(
      "password otp otpExpiry resetOtpVerified resetOtpVerifiedAt status"
    );

    if (!user) {
      // Generic response — don't reveal if email exists
      return NextResponse.json(
        { success: false, message: "Invalid request. Please restart the password reset flow." },
        { status: 400 }
      );
    }

    if (user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "This account is not accessible." },
        { status: 403 }
      );
    }

    // ── 5. CRITICAL SECURITY CHECK ────────────────────────────────────────────
    // This is the fix for the original critical bug.
    // We verify that:
    //   a) The OTP was actually verified server-side (resetOtpVerified === true)
    //   b) That verification happened within the last 15 minutes
    //      (prevents replay of old verified states)
    //
    // An attacker calling this endpoint directly (without going through
    // /verify-reset-otp) will NEVER have these fields set to valid values.

    if (!user.resetOtpVerified) {
      return NextResponse.json(
        {
          success: false,
          message: "OTP verification required. Please verify your OTP before resetting the password.",
        },
        { status: 403 }
      );
    }

    if (!user.resetOtpVerifiedAt) {
      return NextResponse.json(
        {
          success: false,
          message: "OTP verification state is invalid. Please restart the reset flow.",
        },
        { status: 403 }
      );
    }

    const verifiedAge = Date.now() - user.resetOtpVerifiedAt.getTime();
    if (verifiedAge > VERIFIED_STATE_EXPIRY_MS) {
      // Clear the stale verification state
      user.resetOtpVerified   = false;
      user.resetOtpVerifiedAt = null;
      user.otp                = null;
      user.otpExpiry          = null;
      await user.save();

      return NextResponse.json(
        {
          success: false,
          message: "OTP verification has expired. Please restart the password reset flow.",
        },
        { status: 403 }
      );
    }

    // ── 6. All checks passed — update password ────────────────────────────────
    // The pre-save bcrypt hook in User.ts will hash this automatically.
    user.password           = password;

    // Clear all OTP + verification state (one-time use)
    user.otp                = null;
    user.otpExpiry          = null;
    user.resetOtpVerified   = false;
    user.resetOtpVerifiedAt = null;

    // Also clear any brute-force login lockout — a successful reset
    // means the user is the real owner
    user.isBlocked     = false;
    user.loginAttempts = 0;
    user.blockedUntil  = null;

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}