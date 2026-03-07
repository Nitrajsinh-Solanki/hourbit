// hourbit\app\api\auth\login\route.ts


import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_TIME = 30 * 60 * 1000; // 30 minutes

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

    /* Check verification */
    if (!user.isVerified) {
      return NextResponse.json(
        {
          success: false,
          message: "Please verify your account before logging in.",
        },
        { status: 400 }
      );
    }

    /* Check block status */
    if (user.isBlocked && user.blockedUntil > new Date()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account temporarily blocked due to multiple failed login attempts.",
        },
        { status: 403 }
      );
    }

    /* Compare password */
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.isBlocked = true;
        user.blockedUntil = new Date(Date.now() + BLOCK_TIME);
      }

      await user.save();

      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 400 }
      );
    }

    /* Successful login */

    user.loginAttempts = 0;
    user.isBlocked = false;
    user.blockedUntil = null;
    user.lastLogin = new Date();

    /* Device tracking */
    const userAgent = req.headers.get("user-agent") || "unknown";
    const ipAddress =
      req.headers.get("x-forwarded-for") || "unknown";

    const deviceId = `${ipAddress}-${userAgent}`;

    const existingDevice = user.devices.find(
      (d: any) => d.deviceId === deviceId
    );

    if (existingDevice) {
      existingDevice.lastLogin = new Date();
    } else {
      user.devices.push({
        deviceId,
        ipAddress,
        userAgent,
        lastLogin: new Date(),
      });
    }

    await user.save();

    /* JWT token */
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: rememberMe ? "90d" : "7d",
      }
    );

    /* Cookie duration */
    const cookieExpiry = rememberMe
      ? 90 * 24 * 60 * 60
      : 7 * 24 * 60 * 60;

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: cookieExpiry,
      path: "/",
    });

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