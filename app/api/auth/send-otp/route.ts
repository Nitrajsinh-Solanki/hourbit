// app/api/auth/send-otp/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { sendOTPEmail } from "@/app/lib/mailer";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email });

    /* User not found */
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is not registered. Please register first.",
        },
        { status: 404 }
      );
    }

    /* User already verified */
    if (user.isVerified) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is already verified. Please login.",
        },
        { status: 400 }
      );
    }

    /* Generate new OTP */
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    /* Send Email */
    await sendOTPEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}