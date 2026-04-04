// app/api/typing/history/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { TypingResult } from "@/app/models/TypingModels";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

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

// GET /api/typing/history
// Query params:
//   timer  — timerDuration filter (0 = all timers, default 0)
//   mode   — typingMode filter   ("all" = all modes,  default "all")
//   page   — 1-based page number (default 1)
//   limit  — results per page    (default 20, max 50)
export async function GET(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const timerParam = searchParams.get("timer");
    const modeParam  = searchParams.get("mode")  || "all";
    const pageParam  = searchParams.get("page")  || "1";
    const limitParam = searchParams.get("limit") || "20";

    const timerDuration = timerParam ? parseInt(timerParam, 10) : 0;
    const page          = Math.max(1, parseInt(pageParam, 10));
    const limit         = Math.min(50, Math.max(1, parseInt(limitParam, 10)));
    const skip          = (page - 1) * limit;

    await connectDB();

    // Build match filter
    const query: Record<string, unknown> = { userId };
    if (timerDuration > 0)   query.timerDuration = timerDuration;
    if (modeParam !== "all") query.typingMode     = modeParam;

    const [results, total] = await Promise.all([
      TypingResult.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TypingResult.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      results,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    console.error("HISTORY GET ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}