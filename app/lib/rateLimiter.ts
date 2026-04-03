// app/lib/rateLimiter.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// 100% FREE, MongoDB-based defense system. No Redis. No paid services.
//
// HOW IT WORKS:
//   1. getClientIP()           — extracts real client IP from request headers
//   2. getDeviceFingerprint()  — SHA-256(IP + User-Agent) → stable device key
//   3. rateLimit()             — atomic MongoDB counter per (key, window)
//   4. checkOtpBruteForce()    — per-email OTP attempt counter with lockout
//
// CHANGES IN THIS VERSION:
//   - limitLogin() added        — device + IP rate limit for login endpoint
//   - LIMITS.login added        — 10 attempts/device/15min, 20/IP/15min
// ─────────────────────────────────────────────────────────────────────────────

import crypto                from "crypto";
import { NextRequest }       from "next/server";
import { connectDB }         from "@/app/lib/mongodb";
import { RateLimit }         from "@/app/models/RateLimit";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;   // requests left in this window
  resetIn:   number;   // seconds until window resets
}

// ── 1. IP Extraction ──────────────────────────────────────────────────────────

/**
 * Returns the real client IP from Vercel / Cloudflare / Nginx proxy headers.
 * Falls back to "unknown" if none are present.
 */
export function getClientIP(req: Request | NextRequest): string {
  const cfIp   = (req as NextRequest).headers?.get("cf-connecting-ip");
  const fwdIp  = (req as NextRequest).headers?.get("x-forwarded-for");
  const realIp = (req as NextRequest).headers?.get("x-real-ip");

  const raw = cfIp ?? fwdIp ?? realIp ?? "unknown";
  return raw.split(",")[0].trim();
}

// ── 2. Device Fingerprinting ──────────────────────────────────────────────────

/**
 * Creates a stable 32-char device fingerprint from IP + User-Agent.
 * Bots from the same device keep the same fingerprint → rate limit hits them.
 * Legit users on different devices get different fingerprints → not punished.
 */
export function getDeviceFingerprint(req: Request | NextRequest): string {
  const ip = getClientIP(req);
  const ua = (req as NextRequest).headers?.get("user-agent") ?? "unknown";

  return crypto
    .createHash("sha256")
    .update(`${ip}:${ua}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Returns just the raw IP (used for IP-only rate limit keys).
 */
export function getIPKey(req: Request | NextRequest): string {
  return getClientIP(req);
}

// ── 3. Core Rate Limiter ──────────────────────────────────────────────────────

/**
 * Atomically increments a per-key counter within a fixed time window.
 *
 * HOW THE ATOMIC UPSERT WORKS:
 *   Step 1 — Try to increment an EXISTING document whose window is still active.
 *   Step 2 — If no active window exists, upsert a new document (count = 1).
 *   This two-step avoids duplicate-key races and is safe under concurrent load.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSecs: number
): Promise<RateLimitResult> {
  await connectDB();

  const now          = new Date();
  const windowMs     = windowSecs * 1000;
  const windowCutoff = new Date(now.getTime() - windowMs);
  const expiresAt    = new Date(now.getTime() + windowMs);

  // Step 1: Try to increment within an active window
  const existing = await RateLimit.findOneAndUpdate(
    {
      key,
      windowStart: { $gte: windowCutoff },
    },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (existing) {
    const resetIn   = Math.max(
      0,
      Math.ceil((existing.windowStart.getTime() + windowMs - now.getTime()) / 1000)
    );
    const remaining = Math.max(0, max - existing.count);
    return {
      allowed:   existing.count <= max,
      remaining,
      resetIn,
    };
  }

  // Step 2: No active window — create / reset
  await RateLimit.findOneAndUpdate(
    { key },
    {
      $set: {
        count:       1,
        windowStart: now,
        expiresAt,
      },
    },
    { upsert: true }
  );

  return {
    allowed:   true,
    remaining: Math.max(0, max - 1),
    resetIn:   windowSecs,
  };
}

// ── 4. OTP Brute-Force Protection ─────────────────────────────────────────────

/**
 * Tracks failed OTP attempts per email.
 * After `maxFails` failures, subsequent calls return { blocked: true }.
 * Called ONLY on failure — do NOT call on success.
 */
export async function recordOtpFailure(
  email:      string,
  endpoint:   string,
  maxFails:   number,
  windowSecs: number
): Promise<{ blocked: boolean; attemptsLeft: number }> {
  const key    = `otp-fail:${endpoint}:${email.toLowerCase()}`;
  const result = await rateLimit(key, maxFails, windowSecs);

  return {
    blocked:      !result.allowed,
    attemptsLeft: result.remaining,
  };
}

/**
 * Checks if an email is currently OTP-locked WITHOUT incrementing the counter.
 * Call this at the start of verify-otp before doing any DB lookups.
 */
export async function isOtpBlocked(
  email:      string,
  endpoint:   string,
  maxFails:   number,
  windowSecs: number
): Promise<{ blocked: boolean; resetIn: number }> {
  await connectDB();

  const key          = `otp-fail:${endpoint}:${email.toLowerCase()}`;
  const windowCutoff = new Date(Date.now() - windowSecs * 1000);

  const doc = await RateLimit.findOne({
    key,
    windowStart: { $gte: windowCutoff },
  });

  if (!doc || doc.count < maxFails) {
    return { blocked: false, resetIn: 0 };
  }

  const resetIn = Math.max(
    0,
    Math.ceil((doc.windowStart.getTime() + windowSecs * 1000 - Date.now()) / 1000)
  );

  return { blocked: true, resetIn };
}

// ── 5. Per-endpoint limit settings ───────────────────────────────────────────

const LIMITS = {
  register: {
    deviceMax:    5,
    deviceWindow: 60 * 60,   // 1 hour
    ipMax:        8,
    ipWindow:     60 * 60,
  },
  login: {
    deviceMax:    10,
    deviceWindow: 15 * 60,   // 15 minutes
    ipMax:        20,
    ipWindow:     15 * 60,
  },
  sendOtp: {
    deviceMax:    5,
    deviceWindow: 60 * 60,
    ipMax:        10,
    ipWindow:     60 * 60,
    emailMax:     3,
    emailWindow:  60 * 60,
  },
  forgotPassword: {
    deviceMax:    3,
    deviceWindow: 60 * 60,
    ipMax:        6,
    ipWindow:     60 * 60,
    emailMax:     3,
    emailWindow:  60 * 60,
  },
  verifyOtp: {
    otpMaxFails:  5,
    otpWindow:    15 * 60,
    deviceMax:    20,
    deviceWindow: 60 * 60,
  },
  resetPassword: {
    deviceMax:    5,
    deviceWindow: 60 * 60,
  },
} as const;

// ── 6. Exported per-endpoint helpers ─────────────────────────────────────────

export async function limitRegister(req: Request | NextRequest): Promise<{
  blocked: boolean;
  message: string;
  resetIn: number;
}> {
  const fp = getDeviceFingerprint(req);
  const ip = getIPKey(req);

  const [byDevice, byIP] = await Promise.all([
    rateLimit(`register:dev:${fp}`, LIMITS.register.deviceMax, LIMITS.register.deviceWindow),
    rateLimit(`register:ip:${ip}`,  LIMITS.register.ipMax,     LIMITS.register.ipWindow),
  ]);

  if (!byDevice.allowed) {
    return {
      blocked: true,
      message: `Too many registration attempts from this device. Try again in ${Math.ceil(byDevice.resetIn / 60)} minute(s).`,
      resetIn: byDevice.resetIn,
    };
  }
  if (!byIP.allowed) {
    return {
      blocked: true,
      message: `Too many registration attempts from this network. Try again in ${Math.ceil(byIP.resetIn / 60)} minute(s).`,
      resetIn: byIP.resetIn,
    };
  }

  return { blocked: false, message: "", resetIn: 0 };
}

// ── NEW: Login rate limiter ───────────────────────────────────────────────────
/**
 * Network-level login rate limit (runs BEFORE DB lookup).
 * This is a fast first wall — it stops floods before bcrypt even runs.
 * The existing DB-level loginAttempts/isBlocked is a second wall for
 * targeted per-account attacks.
 */
export async function limitLogin(req: Request | NextRequest): Promise<{
  blocked: boolean;
  message: string;
  resetIn: number;
}> {
  const fp = getDeviceFingerprint(req);
  const ip = getIPKey(req);

  const [byDevice, byIP] = await Promise.all([
    rateLimit(`login:dev:${fp}`, LIMITS.login.deviceMax, LIMITS.login.deviceWindow),
    rateLimit(`login:ip:${ip}`,  LIMITS.login.ipMax,     LIMITS.login.ipWindow),
  ]);

  if (!byDevice.allowed) {
    return {
      blocked: true,
      message: `Too many login attempts from this device. Try again in ${Math.ceil(byDevice.resetIn / 60)} minute(s).`,
      resetIn: byDevice.resetIn,
    };
  }
  if (!byIP.allowed) {
    return {
      blocked: true,
      message: `Too many login attempts from this network. Try again in ${Math.ceil(byIP.resetIn / 60)} minute(s).`,
      resetIn: byIP.resetIn,
    };
  }

  return { blocked: false, message: "", resetIn: 0 };
}

export async function limitSendOtp(
  req:   Request | NextRequest,
  email: string
): Promise<{ blocked: boolean; message: string; resetIn: number }> {
  const fp = getDeviceFingerprint(req);
  const ip = getIPKey(req);

  const [byDevice, byIP, byEmail] = await Promise.all([
    rateLimit(`send-otp:dev:${fp}`,                    LIMITS.sendOtp.deviceMax,  LIMITS.sendOtp.deviceWindow),
    rateLimit(`send-otp:ip:${ip}`,                     LIMITS.sendOtp.ipMax,      LIMITS.sendOtp.ipWindow),
    rateLimit(`send-otp:email:${email.toLowerCase()}`, LIMITS.sendOtp.emailMax,   LIMITS.sendOtp.emailWindow),
  ]);

  if (!byDevice.allowed) {
    return {
      blocked: true,
      message: `Too many OTP requests from this device. Try again in ${Math.ceil(byDevice.resetIn / 60)} minute(s).`,
      resetIn: byDevice.resetIn,
    };
  }
  if (!byIP.allowed) {
    return {
      blocked: true,
      message: `Too many OTP requests from this network. Try again in ${Math.ceil(byIP.resetIn / 60)} minute(s).`,
      resetIn: byIP.resetIn,
    };
  }
  if (!byEmail.allowed) {
    return {
      blocked: true,
      message: `Too many OTP requests for this email. Try again in ${Math.ceil(byEmail.resetIn / 60)} minute(s).`,
      resetIn: byEmail.resetIn,
    };
  }

  return { blocked: false, message: "", resetIn: 0 };
}

export async function limitForgotPassword(
  req:   Request | NextRequest,
  email: string
): Promise<{ blocked: boolean; message: string; resetIn: number }> {
  const fp = getDeviceFingerprint(req);
  const ip = getIPKey(req);

  const [byDevice, byIP, byEmail] = await Promise.all([
    rateLimit(`forgot:dev:${fp}`,                    LIMITS.forgotPassword.deviceMax,  LIMITS.forgotPassword.deviceWindow),
    rateLimit(`forgot:ip:${ip}`,                     LIMITS.forgotPassword.ipMax,      LIMITS.forgotPassword.ipWindow),
    rateLimit(`forgot:email:${email.toLowerCase()}`, LIMITS.forgotPassword.emailMax,   LIMITS.forgotPassword.emailWindow),
  ]);

  if (!byDevice.allowed) {
    return {
      blocked: true,
      message: `Too many password reset requests from this device. Try again in ${Math.ceil(byDevice.resetIn / 60)} minute(s).`,
      resetIn: byDevice.resetIn,
    };
  }
  if (!byIP.allowed) {
    return {
      blocked: true,
      message: `Too many password reset requests from this network. Try again in ${Math.ceil(byIP.resetIn / 60)} minute(s).`,
      resetIn: byIP.resetIn,
    };
  }
  if (!byEmail.allowed) {
    return {
      blocked: true,
      message: `Too many password reset requests for this email. Try again in ${Math.ceil(byEmail.resetIn / 60)} minute(s).`,
      resetIn: byEmail.resetIn,
    };
  }

  return { blocked: false, message: "", resetIn: 0 };
}

export async function limitResetPassword(req: Request | NextRequest): Promise<{
  blocked: boolean;
  message: string;
  resetIn: number;
}> {
  const fp = getDeviceFingerprint(req);
  const ip = getIPKey(req);

  const [byDevice, byIP] = await Promise.all([
    rateLimit(`reset-pw:dev:${fp}`, LIMITS.resetPassword.deviceMax, LIMITS.resetPassword.deviceWindow),
    rateLimit(`reset-pw:ip:${ip}`,  LIMITS.resetPassword.deviceMax, LIMITS.resetPassword.deviceWindow),
  ]);

  if (!byDevice.allowed) {
    return {
      blocked: true,
      message: `Too many password reset attempts. Try again in ${Math.ceil(byDevice.resetIn / 60)} minute(s).`,
      resetIn: byDevice.resetIn,
    };
  }
  if (!byIP.allowed) {
    return {
      blocked: true,
      message: `Too many password reset attempts from this network. Try again in ${Math.ceil(byIP.resetIn / 60)} minute(s).`,
      resetIn: byIP.resetIn,
    };
  }

  return { blocked: false, message: "", resetIn: 0 };
}