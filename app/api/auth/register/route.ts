// hourbit\app\api\auth\register\route.ts


import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { sendOTPEmail } from "@/app/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      fullName,
      email,
      password,
      confirmPassword,
      companyName,
      defaultWorkHours,
    } = body;

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Missing fields" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "User already exists" },
        { status: 400 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      fullName,
      email,
      password,
      companyName,
      defaultWorkHours,
      otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOTPEmail(email, otp);

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please verify OTP.",
      email,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);   // ← ADD THIS LINE
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}