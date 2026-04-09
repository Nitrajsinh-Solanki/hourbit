// app/api/diary/export/route.ts
// POST /api/diary/export
// Body: { date: "YYYY-MM-DD" }
// Returns: { allowed: boolean, exportsLeft: number, exportCount: number, entry: {...} }
// Max 3 exports per date per user. Does NOT actually generate PDF — client does that.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { DiaryEntry } from "@/app/models/DiaryEntry";
import { DiaryExportLog } from "@/app/models/DiaryEntry";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const MAX_EXPORTS = 3;

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch { return null; }
}

function toMidnightUTC(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

// GET — check how many exports are left for a date (no increment)
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  await connectDB();

  const log = await DiaryExportLog.findOne({
    userId,
    entryDate: toMidnightUTC(date),
  }).lean();

  const exportCount = (log as any)?.exportCount ?? 0;
  return NextResponse.json({
    exportCount,
    exportsLeft: MAX_EXPORTS - exportCount,
    allowed: exportCount < MAX_EXPORTS,
  });
}

// POST — increment export count and return entry data
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  await connectDB();

  // Check / create log
  let log = await DiaryExportLog.findOne({ userId, entryDate: toMidnightUTC(date) });

  if (log && log.exportCount >= MAX_EXPORTS) {
    return NextResponse.json(
      { error: `Export limit reached. Max ${MAX_EXPORTS} downloads per date.`, exportCount: log.exportCount, exportsLeft: 0 },
      { status: 403 }
    );
  }

  // Fetch entry
  const entry = await DiaryEntry.findOne({ userId, entryDate: toMidnightUTC(date) }).lean();
  if (!entry || !(entry as any).content?.trim()) {
    return NextResponse.json({ error: "No content to export" }, { status: 404 });
  }

  // Increment
  if (!log) {
    log = await DiaryExportLog.create({ userId, entryDate: toMidnightUTC(date), exportCount: 1 });
  } else {
    log.exportCount += 1;
    await log.save();
  }

  return NextResponse.json({
    entry,
    exportCount: log.exportCount,
    exportsLeft: MAX_EXPORTS - log.exportCount,
  });
}