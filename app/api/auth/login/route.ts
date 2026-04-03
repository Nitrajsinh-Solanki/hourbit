// hourbit/app/api/auth/login/route.ts
//
// HARDENED: Network-level rate limiting + Content-Type validation added.
// ─────────────────────────────────────────────────────────────────────────────
// DEFENSES ADDED IN THIS VERSION:
//   1. Content-Type check          — rejects non-JSON requests instantly
//   2. limitLogin()                — device + IP rate limit BEFORE DB/bcrypt
//      · 10 attempts / device / 15 min
//      · 20 attempts / IP    / 15 min
//   3. Existing DB-level lockout   — loginAttempts / isBlocked (unchanged)
//
// TWO-WALL STRATEGY:
//   Wall 1 (limitLogin)   — cheap MongoDB counter, stops floods fast
//   Wall 2 (loginAttempts)— per-account DB counter, stops targeted attacks
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { connectDB }    from "@/app/lib/mongodb";
import User             from "@/app/models/User";
import bcrypt           from "bcryptjs";
import jwt              from "jsonwebtoken";
import { cookies }      from "next/headers";
import { limitLogin }   from "@/app/lib/rateLimiter";

const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_TIME         = 30 * 60 * 1000; // 30 minutes in ms
const MAX_DEVICES        = 10;

export async function POST(req: NextRequest) {
  try {

    // ── 0. Content-Type guard ─────────────────────────────────────────────────
    // Rejects raw TCP floods and malformed bot requests instantly,
    // before any DB work happens.
    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { success: false, message: "Invalid content type." },
        { status: 415 }
      );
    }

    // ── 1. NETWORK-LEVEL RATE LIMIT ───────────────────────────────────────────
    // This runs BEFORE body parsing and BEFORE bcrypt — keeps it cheap.
    // bcrypt.compare() is intentionally slow (10 rounds) so without this,
    // an attacker could peg your CPU just by hammering /login.
    const limit = await limitLogin(req);
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
    let email: string, password: string, rememberMe: boolean;
    try {
      const body = await req.json();
      email      = typeof body.email      === "string"  ? body.email.trim().toLowerCase() : "";
      password   = typeof body.password   === "string"  ? body.password                  : "";
      rememberMe = typeof body.rememberMe === "boolean" ? body.rememberMe                : false;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required." },
        { status: 400 }
      );
    }

    // Basic length guards — prevents payload bombs
    if (email.length > 254 || password.length > 128) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 400 }
      );
    }

    // ── 3. DB lookup ──────────────────────────────────────────────────────────
    await connectDB();

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 400 }
      );
    }

    // ── 4. Account verification check ─────────────────────────────────────────
    if (!user.isVerified) {
      return NextResponse.json(
        { success: false, message: "Please verify your account before logging in." },
        { status: 400 }
      );
    }

    // ── 5. Admin-level permanent ban ──────────────────────────────────────────
    if (user.status === "banned") {
      return NextResponse.json(
        {
          success: false,
          message: user.banReason
            ? `Your account has been permanently banned. Reason: ${user.banReason}`
            : "Your account has been permanently banned. Please contact support.",
        },
        { status: 403 }
      );
    }

    // ── 6. Admin-level suspension ─────────────────────────────────────────────
    if (user.status === "suspended") {
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        const reason   = user.banReason ? ` Reason: ${user.banReason}` : "";
        const untilMsg = user.blockedUntil
          ? ` until ${new Date(user.blockedUntil).toLocaleString()}.`
          : ".";
        return NextResponse.json(
          {
            success: false,
            message: `Your account has been suspended${untilMsg}${reason}`,
          },
          { status: 403 }
        );
      }

      // Suspension expired — auto-restore
      user.status       = "active";
      user.banReason    = "";
      user.blockedUntil = null;
      await user.save();
    }

    // ── 7. DB-level brute-force lockout (per-account) ─────────────────────────
    // This is Wall 2 — catches targeted attacks against one specific account
    // even if the attacker rotates IPs/devices to dodge Wall 1.
    if (user.isBlocked && user.blockedUntil > new Date()) {
      const remaining = Math.ceil(
        (user.blockedUntil.getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        {
          success: false,
          message: `Account temporarily blocked. Try again in ${remaining} minute(s).`,
        },
        { status: 403 }
      );
    }

    // ── 8. Password comparison ────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.isBlocked     = true;
        user.blockedUntil  = new Date(Date.now() + BLOCK_TIME);
        user.loginAttempts = 0;
      }

      await user.save();

      const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;

      return NextResponse.json(
        {
          success: false,
          message: user.isBlocked
            ? "Too many failed attempts. Account blocked for 30 minutes."
            : `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        },
        { status: 400 }
      );
    }

    // ── 9. Successful login — reset brute-force counters ──────────────────────
    user.loginAttempts = 0;
    user.isBlocked     = false;
    user.blockedUntil  = null;
    user.lastLogin     = new Date();

    // ── 10. Stable Device Tracking via cookie UUID ────────────────────────────
    const cookieStore = await cookies();

    let deviceId      = cookieStore.get("deviceId")?.value;
    const isNewDevice = !deviceId;

    if (!deviceId) {
      deviceId = crypto.randomUUID();
    }

    const userAgent = req.headers.get("user-agent") || "unknown";
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const existingDevice = user.devices.find(
      (d: any) => d.deviceId === deviceId
    );

    if (existingDevice) {
      // Reject device-banned devices
      if (existingDevice.isBanned) {
        return NextResponse.json(
          {
            success: false,
            message: existingDevice.banReason
              ? `This device has been banned. Reason: ${existingDevice.banReason}`
              : "This device has been banned from accessing this account.",
          },
          { status: 403 }
        );
      }

      existingDevice.lastLogin = new Date();
      existingDevice.ipAddress = ipAddress;
      existingDevice.userAgent = userAgent;
    } else {
      if (user.devices.length >= MAX_DEVICES) {
        user.devices.sort(
          (a: any, b: any) =>
            new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime()
        );
        user.devices.shift();
      }

      user.devices.push({
        deviceId,
        ipAddress,
        userAgent,
        lastLogin: new Date(),
        isBanned:  false,
        bannedAt:  null,
        banReason: "",
      });
    }

    await user.save();

    // ── 11. JWT token ─────────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        userId:   user._id,
        email:    user.email,
        role:     user.role,
        deviceId: deviceId,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: rememberMe ? "90d" : "7d",
      }
    );

    const cookieExpiry = rememberMe
      ? 90 * 24 * 60 * 60
      :  7 * 24 * 60 * 60;

    // ── 12. Set cookies ───────────────────────────────────────────────────────
    cookieStore.set("token", token, {
      httpOnly: true,
      secure:   true,
      sameSite: "strict",
      maxAge:   cookieExpiry,
      path:     "/",
    });

    if (isNewDevice) {
      cookieStore.set("deviceId", deviceId, {
        httpOnly: true,
        secure:   true,
        sameSite: "strict",
        maxAge:   365 * 24 * 60 * 60,
        path:     "/",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Login successful.",
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}