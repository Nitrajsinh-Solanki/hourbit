// app/api/todo/history/route.ts
// GET — returns the last N days of todo documents (excluding today)
// ?limit=30   (default: 30)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import { Todo } from "@/app/models/Todo";

async function getUser(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(90, Math.max(1, parseInt(searchParams.get("limit") || "30")));

  await connectDB();

  const today = todayISO();

  const docs = await Todo.find({ userId: user.userId, date: { $lt: today } })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    history: docs.map((d) => ({
      date:       d.date,
      tasks:      d.tasks,
      totalTasks: d.tasks.length,
      completed:  d.tasks.filter((t: any) => t.completed).length,
    })),
  });
}