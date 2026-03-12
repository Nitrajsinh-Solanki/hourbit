// app/api/typing/timers/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { TypingCustomTimer, TypingResult } from "@/app/models/TypingModels";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const MAX_CUSTOM_TIMERS = 3;
const MAX_DURATION = 3600;

async function getAuthUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
}

// GET /api/typing/timers — list custom timers
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    await connectDB();

    const timers = await TypingCustomTimer.find({ userId })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ success: true, timers });
  } catch (error) {
    console.error("GET TIMERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// POST /api/typing/timers — add a custom timer
export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { duration } = await req.json();

    if (!duration || typeof duration !== "number" || duration < 1) {
      return NextResponse.json(
        { success: false, message: "Invalid duration" },
        { status: 400 }
      );
    }

    if (duration > MAX_DURATION) {
      return NextResponse.json(
        {
          success: false,
          message: "Maximum allowed duration is 3600 seconds (1 hour)",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const count = await TypingCustomTimer.countDocuments({ userId });
    if (count >= MAX_CUSTOM_TIMERS) {
      return NextResponse.json(
        {
          success: false,
          message: "You can only have up to 3 custom timers",
        },
        { status: 400 }
      );
    }

    const timer = await TypingCustomTimer.create({ userId, duration });

    return NextResponse.json({
      success: true,
      timer: { _id: timer._id, duration: timer.duration },
    });
  } catch (error: unknown) {
    // Duplicate duration
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { success: false, message: "You already have a timer with this duration" },
        { status: 400 }
      );
    }
    console.error("ADD TIMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/typing/timers — delete a custom timer + all its results
export async function DELETE(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { timerId, duration } = await req.json();

    if (!timerId) {
      return NextResponse.json(
        { success: false, message: "Missing timerId" },
        { status: 400 }
      );
    }

    await connectDB();

    const timer = await TypingCustomTimer.findOne({ _id: timerId, userId });
    if (!timer) {
      return NextResponse.json(
        { success: false, message: "Timer not found" },
        { status: 404 }
      );
    }

    // Delete all results with this duration for this user
    await TypingResult.deleteMany({ userId, timerDuration: duration });

    // Delete the timer
    await TypingCustomTimer.deleteOne({ _id: timerId, userId });

    return NextResponse.json({
      success: true,
      message: "Timer and all associated results deleted",
    });
  } catch (error) {
    console.error("DELETE TIMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}