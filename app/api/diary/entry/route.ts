// app/api/diary/entry/route.ts
// KEY FIX #3: PATCH only increments editCount when body.incrementEdit === true
// Auto-save passes incrementEdit: false → content saved, editCount unchanged
// Manual Save button passes incrementEdit: true → editCount +1
//
// NEW: DELETE handler — clears content/heading/mood/editCount/isLocked for a date
//      but keeps the doc alive to preserve deleteCount.
//      deleteCount is per-date and permanent: max 3 deletes per date ever.

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
      userId: string; email: string; role: string;
    };
    return decoded.userId;
  } catch { return null; }
}

function toMidnightUTC(s: string): Date { return new Date(s + "T00:00:00.000Z"); }
function isFutureDate(s: string): boolean {
  const t = new Date(); t.setUTCHours(0,0,0,0); return toMidnightUTC(s) > t;
}
function isWithin90Days(s: string): boolean {
  const t = new Date(); t.setUTCHours(0,0,0,0);
  const l = new Date(t); l.setDate(l.getDate()-90);
  return toMidnightUTC(s) >= l;
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error:"date required" }, { status:400 });
  if (isFutureDate(date)) return NextResponse.json({ error:"Future not allowed" }, { status:403 });
  await connectDB();
  const entry = await DiaryEntry.findOne({ userId, entryDate: toMidnightUTC(date) }).lean();
  return NextResponse.json({ entry: entry ?? null });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const body = await req.json();
  const { date, content="", heading="", textColor="black", mood=null } = body;
  if (!date) return NextResponse.json({ error:"date required" }, { status:400 });
  if (isFutureDate(date)) return NextResponse.json({ error:"Future not allowed" }, { status:403 });
  if (!isWithin90Days(date)) return NextResponse.json({ error:"Outside 90-day window" }, { status:403 });
  if (content.length > 1500) return NextResponse.json({ error:"Too long" }, { status:400 });
  await connectDB();

  // Check if a "ghost" doc exists (after a delete) — if so, use it instead of creating a new one
  const existing = await DiaryEntry.findOne({ userId, entryDate: toMidnightUTC(date) });
  if (existing) {
    // Doc exists — this is a re-write after delete. Treat as a PATCH with no editCount increment.
    existing.content   = content;
    existing.heading   = heading;
    existing.textColor = textColor as "black"|"blue"|"red"|"darkgreen";
    existing.mood      = mood;
    // Do NOT reset deleteCount — it is permanent
    // Do NOT reset editCount or isLocked — they carry over
    await existing.save();
    return NextResponse.json({ entry: existing }, { status:200 });
  }

  const entry = await DiaryEntry.create({
    userId, entryDate: toMidnightUTC(date),
    content, heading, textColor, mood, editCount: 0, deleteCount: 0,
  });
  return NextResponse.json({ entry }, { status:201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  const body = await req.json();
  const { date, content, heading, textColor, mood, incrementEdit } = body;
  if (!date) return NextResponse.json({ error:"date required" }, { status:400 });
  if (isFutureDate(date)) return NextResponse.json({ error:"Future not allowed" }, { status:403 });
  await connectDB();
  const entry = await DiaryEntry.findOne({ userId, entryDate: toMidnightUTC(date) });
  if (!entry) return NextResponse.json({ error:"Not found" }, { status:404 });

  // Only block manual saves when locked — auto-saves (incrementEdit=false) still write content
  if (incrementEdit === true && entry.isLocked) {
    return NextResponse.json({ error:"Entry locked (5 manual saves reached)" }, { status:403 });
  }

  if (content   !== undefined) {
    if (content.length > 1500) return NextResponse.json({ error:"Too long" }, { status:400 });
    entry.content = content;
  }
  if (heading   !== undefined) entry.heading   = heading;
  if (textColor !== undefined) entry.textColor = textColor;
  if (mood      !== undefined) entry.mood      = mood;

  // Only increment editCount on manual Save button click
  if (incrementEdit === true) {
    entry.editCount = (entry.editCount ?? 0) + 1;
    if (entry.editCount >= 5) entry.isLocked = true;
  }

  await entry.save();
  return NextResponse.json({ entry });
}

// ── DELETE: wipe content but keep doc alive to track deleteCount ──
// Body: { date: "YYYY-MM-DD" }
// Rules:
//   • Max 3 deletes per date (permanent, date-wise)
//   • Clears: content, heading, mood, editCount → 0, isLocked → false
//   • Preserves: deleteCount (incremented), entryDate, userId
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error:"Unauthorized" }, { status:401 });

  const body = await req.json();
  const { date } = body;
  if (!date) return NextResponse.json({ error:"date required" }, { status:400 });
  if (isFutureDate(date)) return NextResponse.json({ error:"Future not allowed" }, { status:403 });

  await connectDB();

  const MAX_DELETES = 3;
  const entry = await DiaryEntry.findOne({ userId, entryDate: toMidnightUTC(date) });

  if (!entry) {
    return NextResponse.json({ error:"No entry found for this date" }, { status:404 });
  }

  const currentDeleteCount = entry.deleteCount ?? 0;

  if (currentDeleteCount >= MAX_DELETES) {
    return NextResponse.json(
      {
        error: `Delete limit reached. You can only delete content ${MAX_DELETES} times per page.`,
        deleteCount: currentDeleteCount,
        maxDeletes: MAX_DELETES,
      },
      { status: 403 }
    );
  }

  // Wipe content — reset to blank slate, but preserve deleteCount history
  entry.content    = "";
  entry.heading    = "";
  entry.mood       = null;
  entry.editCount  = 0;
  entry.isLocked   = false;
  entry.deleteCount = currentDeleteCount + 1;

  await entry.save();

  return NextResponse.json({
    entry,
    deleteCount: entry.deleteCount,
    deletesLeft: MAX_DELETES - entry.deleteCount,
    message: `Page content deleted. ${MAX_DELETES - entry.deleteCount} delete${MAX_DELETES - entry.deleteCount !== 1 ? "s" : ""} remaining for this date.`,
  });
}