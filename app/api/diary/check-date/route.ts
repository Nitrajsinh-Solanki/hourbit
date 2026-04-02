// app/api/diary/check-date/route.ts
//
// Lightweight endpoint used by the Today's Track page to determine
// whether the user has written a diary entry for a given calendar date.
// Called client-side AFTER a successful work-log save (entry + exit time present).
//
// GET /api/diary/check-date?date=YYYY-MM-DD
// Response: { exists: boolean }

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import { DiaryEntry }                from "@/app/models/DiaryEntry";
import { cookies }                   from "next/headers";
import jwt                           from "jsonwebtoken";

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token       = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    return decoded.userId;
  } catch {
    return null;
  }
}

function toMidnightUTC(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  await connectDB();

  // We only need to know if a non-empty entry exists.
  // An entry with empty content (after deletion) is treated as "not written".
  const entry = await DiaryEntry.findOne({
    userId,
    entryDate: toMidnightUTC(date),
  })
    .select("content")
    .lean();

  const exists = !!(
    entry &&
    typeof (entry as any).content === "string" &&
    (entry as any).content.trim().length > 0
  );

  return NextResponse.json({ exists });
}