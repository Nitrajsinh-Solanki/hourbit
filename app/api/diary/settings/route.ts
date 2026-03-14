// app/api/diary/settings/route.ts
// CHANGE: Added MAX_HEADINGS = 5 server-side enforcement
// All other behaviour identical to original.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { DiarySettings } from "@/app/models/DiaryEntry";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const MAX_HEADINGS = 5;

async function getUserId(): Promise<string | null> {
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

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const settings = await DiarySettings.findOne({ userId }).lean();
  return NextResponse.json({ settings: settings ?? { headings: [] } });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { headings } = body;

  if (!Array.isArray(headings))
    return NextResponse.json({ error: "headings array required" }, { status: 400 });

  // FIX #1: enforce max headings limit server-side
  if (headings.length > MAX_HEADINGS)
    return NextResponse.json(
      { error: `Maximum ${MAX_HEADINGS} headings allowed.` },
      { status: 400 }
    );

  for (const h of headings) {
    if (!h.text || typeof h.text !== "string")
      return NextResponse.json({ error: "Each heading must have a text field" }, { status: 400 });
    if (h.text.length > 50)
      return NextResponse.json({ error: "Heading text max 50 characters" }, { status: 400 });
  }

  await connectDB();

  const settings = await DiarySettings.findOneAndUpdate(
    { userId },
    { $set: { headings } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ settings });
}