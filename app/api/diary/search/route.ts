// app/api/diary/search/route.ts
// GET ?q=searchterm → returns top 3 matching diary entries with snippets

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch { return null; }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getSnippet(text: string, query: string, len = 120): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, len);
  const start = Math.max(0, idx - 40);
  const end   = Math.min(text.length, idx + 80);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  await connectDB();

  // MongoDB text search — needs text index on content field
  // Falls back to regex if no text index
  let entries: Array<{ entryDate: Date; content: string }> = [];
  try {
    entries = await DiaryEntry.find(
      { userId, $text: { $search: q } },
      { score: { $meta: "textScore" }, entryDate: 1, content: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(3)
      .lean();
  } catch {
    // Fallback: regex search (slower but works without text index)
    entries = await DiaryEntry.find({
      userId,
      content: { $regex: q, $options: "i" },
    })
      .sort({ entryDate: -1 })
      .limit(3)
      .select("entryDate content")
      .lean();
  }

  const results = entries.map((e) => {
    const d = new Date(e.entryDate);
    const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    const plain = stripHtml(e.content);
    return { date, snippet: getSnippet(plain, q) };
  });

  return NextResponse.json({ results });
}