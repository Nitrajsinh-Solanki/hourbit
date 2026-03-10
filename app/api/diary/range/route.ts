// app/api/diary/range/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { DiaryEntry } from "@/app/models/DiaryEntry";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    return decoded.userId;           // ← "userId", NOT "id"
  } catch {
    return null;
  }
}

function toMidnightUTC(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  if (!startDate || !endDate)
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });

  await connectDB();

  const entries = await DiaryEntry.find({
    userId,
    entryDate: {
      $gte: toMidnightUTC(startDate),
      $lte: toMidnightUTC(endDate),
    },
  })
    .select("entryDate content heading textColor mood editCount isLocked")
    .sort({ entryDate: 1 })
    .lean();

  return NextResponse.json({ entries });
}