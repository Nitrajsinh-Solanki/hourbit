
// hourbit\app\api\auth\verify-otp\route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    /* Validate input */
    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: "Email and OTP are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email });

    /* Check if user exists */
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    /* Check if OTP exists */
    if (!user.otp) {
      return NextResponse.json(
        { success: false, message: "No OTP found. Please request a new OTP." },
        { status: 400 }
      );
    }

    /* Check OTP match */
    if (user.otp !== otp) {
      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }

    /* Check OTP expiry */
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "OTP expired. Please request a new one.",
        },
        { status: 400 }
      );
    }

    /* Mark account as verified */
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Account verified successfully",
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}