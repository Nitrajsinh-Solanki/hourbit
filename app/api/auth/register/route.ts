// app/api/auth/register/route.ts
//
// HARDENED v2: Honeypot + crypto OTP + Content-Type check added.
// ─────────────────────────────────────────────────────────────────────────────
// ALL DEFENSES:
//   1. Content-Type check          — rejects non-JSON bots instantly
//   2. Honeypot field check        — bots fill hidden "website" field → fake success
//   3. Rate limit by device (IP+UA)— 5 registrations / device / hour
//   4. Rate limit by raw IP        — 8 registrations / IP / hour
//   5. Input length caps           — prevents payload bombs
//   6. crypto.randomInt OTP        — cryptographically secure (replaces Math.random)
//   7. Unverified account cleanup  — re-registration deletes zombie unverified docs
// ─────────────────────────────────────────────────────────────────────────────

import crypto              from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB }       from "@/app/lib/mongodb";
import User                from "@/app/models/User";
import { sendOTPEmail }    from "@/app/lib/mailer";
import { limitRegister }   from "@/app/lib/rateLimiter";

// ── Input limits ──────────────────────────────────────────────────────────────
const MAX_EMAIL    = 254;   // RFC 5321
const MAX_NAME     = 100;
const MAX_COMPANY  = 100;
const MAX_PASSWORD = 128;

export async function POST(req: NextRequest) {
  try {

    // ── 0. Content-Type guard ─────────────────────────────────────────────────
    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { success: false, message: "Invalid content type." },
        { status: 415 }
      );
    }

    // ── 1. RATE LIMIT (device + IP) — before body parsing ─────────────────────
    // We rate-limit before parsing because the limit check only needs headers
    // (IP + User-Agent), not the body. This is cheaper under flood conditions.
    const limit = await limitRegister(req);
    if (limit.blocked) {
      return NextResponse.json(
        { success: false, message: limit.message },
        {
          status:  429,
          headers: { "Retry-After": String(limit.resetIn) },
        }
      );
    }

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    // ── 3. HONEYPOT CHECK ─────────────────────────────────────────────────────
    // The frontend renders a hidden "website" field that real users never see
    // or fill. Automated bots that scrape and fill forms WILL fill it.
    // On detection: return a FAKE success so the bot thinks it worked and stops.
    // Never return an error here — an error teaches the bot to skip the field.
    const honeypot = typeof body.website === "string" ? body.website : "";
    if (honeypot !== "") {
      // Fake success — bot thinks registration worked, stops retrying.
      // We do NOT create any user or send any email.
      return NextResponse.json({
        success: true,
        message: "Registration successful. Please check your email for the OTP.",
        email:   typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
      });
    }

    // ── 4. Extract & validate fields ──────────────────────────────────────────
    const fullName         = typeof body.fullName         === "string" ? body.fullName.trim()            : "";
    const email            = typeof body.email            === "string" ? body.email.trim().toLowerCase() : "";
    const password         = typeof body.password         === "string" ? body.password                   : "";
    const confirmPassword  = typeof body.confirmPassword  === "string" ? body.confirmPassword            : "";
    const companyName      = typeof body.companyName      === "string" ? body.companyName.trim()         : "";
    const defaultWorkHours = typeof body.defaultWorkHours === "number" ? body.defaultWorkHours           : 8.5;

    // Required fields
    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Email, password, and confirm password are required." },
        { status: 400 }
      );
    }

    // Length guards
    if (email.length > MAX_EMAIL) {
      return NextResponse.json(
        { success: false, message: "Invalid email address." },
        { status: 400 }
      );
    }
    if (fullName.length > MAX_NAME) {
      return NextResponse.json(
        { success: false, message: "Full name is too long." },
        { status: 400 }
      );
    }
    if (companyName.length > MAX_COMPANY) {
      return NextResponse.json(
        { success: false, message: "Company name is too long." },
        { status: 400 }
      );
    }
    if (password.length < 8 || password.length > MAX_PASSWORD) {
      return NextResponse.json(
        { success: false, message: "Password must be 8–128 characters." },
        { status: 400 }
      );
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Password match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 }
      );
    }

    // ── 5. DB checks ──────────────────────────────────────────────────────────
    await connectDB();

    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.isVerified) {
        return NextResponse.json(
          { success: false, message: "An account with this email already exists." },
          { status: 400 }
        );
      }

      // Unverified zombie account — delete and allow clean re-registration.
      // This also handles the case where a real user forgot they signed up.
      await User.deleteOne({ _id: existing._id });
    }

    // ── 6. Generate OTP — cryptographically secure ────────────────────────────
    // crypto.randomInt is cryptographically secure (CSPRNG).
    // Math.random() is NOT — it uses a seeded PRNG that can be predicted.
    const otp = crypto.randomInt(100000, 1000000).toString();

    // ── 7. Create user + send OTP ─────────────────────────────────────────────
    await User.create({
      fullName,
      email,
      password,
      companyName,
      defaultWorkHours,
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await sendOTPEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please check your email for the OTP.",
      email,
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}