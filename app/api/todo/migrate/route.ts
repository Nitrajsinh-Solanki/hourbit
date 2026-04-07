// app/api/todo/migrate/route.ts
// POST — called on client mount.
// Finds yesterday's todo, moves any incomplete tasks to today.
// Safe to call multiple times (idempotent via task IDs).

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import { Todo } from "@/app/models/Todo";
import { v4 as uuidv4 } from "uuid";

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

function dateISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const yesterday = dateISO(-1);
  const today     = dateISO(0);

  const yesterdayDoc = await Todo.findOne({ userId: user.userId, date: yesterday });
  if (!yesterdayDoc) {
    return NextResponse.json({ success: true, migrated: 0 });
  }

  const incompleteTasks = yesterdayDoc.tasks.filter((t: any) => !t.completed);
  if (incompleteTasks.length === 0) {
    return NextResponse.json({ success: true, migrated: 0 });
  }

  // Fetch today's doc to check existing task IDs (avoid duplicate migration)
  const todayDoc = await Todo.findOne({ userId: user.userId, date: today });
  const existingTexts = new Set((todayDoc?.tasks ?? []).map((t: any) => t.text));

  // Only migrate tasks not already present today (matched by text)
  const tasksToMigrate = incompleteTasks
    .filter((t: any) => !existingTexts.has(t.text))
    .map((t: any) => ({
      id:          uuidv4(),
      text:        t.text,
      completed:   false,
      createdAt:   new Date(),
      completedAt: null,
    }));

  if (tasksToMigrate.length === 0) {
    return NextResponse.json({ success: true, migrated: 0 });
  }

  const MAX_TASKS = 20;
  const currentCount = todayDoc?.tasks?.length ?? 0;
  const canAdd = MAX_TASKS - currentCount;
  const sliced = tasksToMigrate.slice(0, canAdd);

  await Todo.findOneAndUpdate(
    { userId: user.userId, date: today },
    {
      $push: { tasks: { $each: sliced } },
      $setOnInsert: { allCompletedToastShown: false },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, migrated: sliced.length });
}