// app/api/diary/meta/route.ts

import { NextResponse } from "next/server";
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

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const entries = await DiaryEntry.find({ userId })
    .select("entryDate")
    .sort({ entryDate: 1 })
    .lean();

  const dates = entries.map((e) => {
    const d = new Date(e.entryDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  });

  return NextResponse.json({ totalPages: dates.length, dates });
}