// hourbit\app\api\auth\login\route.ts

import { NextResponse } from "next/server";
import { connectDB }    from "@/app/lib/mongodb";
import User             from "@/app/models/User";
import bcrypt           from "bcryptjs";
import jwt              from "jsonwebtoken";
import { cookies }      from "next/headers";

const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_TIME         = 30 * 60 * 1000; // 30 minutes in ms
const MAX_DEVICES        = 10;

export async function POST(req: Request) {
  try {
    const { email, password, rememberMe } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 400 }
      );
    }

    /* ── Check account verification ── */
    if (!user.isVerified) {
      return NextResponse.json(
        { success: false, message: "Please verify your account before logging in." },
        { status: 400 }
      );
    }

    /* ── NEW: Check admin-level permanent ban ── */
    if (user.status === "banned") {
      return NextResponse.json(
        {
          success: false,
          message:  user.banReason
            ? `Your account has been permanently banned. Reason: ${user.banReason}`
            : "Your account has been permanently banned. Please contact support.",
        },
        { status: 403 }
      );
    }

    /* ── NEW: Check admin-level suspension ── */
    if (user.status === "suspended") {
      // If no lift date is set, the suspension is indefinite
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        const reason    = user.banReason ? ` Reason: ${user.banReason}` : "";
        const untilMsg  = user.blockedUntil
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

      // Suspension has expired — auto-restore to active
      user.status       = "active";
      user.banReason    = "";
      user.blockedUntil = null;
      await user.save();
    }

    /* ── Existing brute-force lockout check (unchanged) ── */
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

    /* ── Compare password ── */
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.isBlocked    = true;
        user.blockedUntil = new Date(Date.now() + BLOCK_TIME);
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

    /* ── Successful login — reset brute-force counters ── */
    user.loginAttempts = 0;
    user.isBlocked     = false;
    user.blockedUntil  = null;
    user.lastLogin     = new Date();

    /* ── Stable Device Tracking via cookie UUID ── */
    const cookieStore = await cookies();

    // Re-use existing deviceId cookie or generate a fresh stable UUID
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
      /* ── NEW: Reject login from a device-banned device ── */
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

      // Known, non-banned device — just refresh its metadata
      existingDevice.lastLogin  = new Date();
      existingDevice.ipAddress  = ipAddress;
      existingDevice.userAgent  = userAgent;
    } else {
      // New device — enforce max device limit (drop oldest first)
      if (user.devices.length >= MAX_DEVICES) {
        user.devices.sort(
          (a: any, b: any) =>
            new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime()
        );
        user.devices.shift(); // remove least recently used device
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

    /* ── JWT token — NOW INCLUDES deviceId ── */
    const token = jwt.sign(
      {
        userId:   user._id,
        email:    user.email,
        role:     user.role,
        deviceId: deviceId,   // ← embedded so every request carries the device identity
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: rememberMe ? "90d" : "7d",
      }
    );

    const cookieExpiry = rememberMe
      ? 90 * 24 * 60 * 60
      :  7 * 24 * 60 * 60;

    /* ── Set auth token cookie ── */
    cookieStore.set("token", token, {
      httpOnly: true,
      secure:   true,
      sameSite: "strict",
      maxAge:   cookieExpiry,
      path:     "/",
    });

    /* ── Set stable deviceId cookie (1 year) — only on first-seen device ── */
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
      message: "Login successful",
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}