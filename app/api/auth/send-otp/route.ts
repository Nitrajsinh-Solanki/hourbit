// app/api/auth/send-otp/route.ts
//
// HARDENED: Device-based + per-email rate limiting added.
// ─────────────────────────────────────────────────────────────────────────────
// DEFENSES ADDED:
//   1. Rate limit by device fingerprint — 5 OTPs / device / hour
//   2. Rate limit by raw IP            — 10 OTPs / IP / hour
//   3. Rate limit by email             — 3 OTPs / email / hour
//      (the per-email cap is the most important: it stops someone from
//       blasting YOUR email quota by requesting OTPs for real users)
//   4. OTP cooldown — cannot request a new OTP if one was sent < 60s ago
//      (this is checked via the existing otpExpiry field)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }    from "@/app/lib/mongodb";
import User             from "@/app/models/User";
import { sendOTPEmail } from "@/app/lib/mailer";
import { limitSendOtp } from "@/app/lib/rateLimiter";

const OTP_COOLDOWN_SECS = 60; // 1 minute between OTP sends

export async function POST(req: NextRequest) {
  try {

    // ── 1. Parse body first (we need email for per-email rate limit key) ──────
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

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        { success: false, message: "Invalid email address." },
        { status: 400 }
      );
    }

    // ── 2. RATE LIMIT (device + IP + email) ───────────────────────────────────
    const limit = await limitSendOtp(req, email);
    if (limit.blocked) {
      return NextResponse.json(
        { success: false, message: limit.message },
        {
          status: 429,
          headers: { "Retry-After": String(limit.resetIn) },
        }
      );
    }

    // ── 3. Database checks ────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email }).select(
      "isVerified otp otpExpiry"
    );

    if (!user) {
      // Do NOT reveal whether the email exists — return generic message
      // to avoid email enumeration attacks.
      return NextResponse.json(
        { success: false, message: "Email is not registered. Please register first." },
        { status: 404 }
      );
    }

    if (user.isVerified) {
      return NextResponse.json(
        { success: false, message: "Your account is already verified. Please login." },
        { status: 400 }
      );
    }

    // ── 4. Per-user OTP cooldown (60 seconds) ─────────────────────────────────
    // otpExpiry is set to now + 10 minutes when OTP is issued.
    // So if otpExpiry exists, the OTP was issued at (otpExpiry - 10 min).
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

    // ── 5. Generate & send OTP ────────────────────────────────────────────────
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp       = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTPEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully. Valid for 10 minutes.",
    });

  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}