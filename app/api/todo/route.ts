// app/api/todo/route.ts
// UPDATED VERSION WITH DATE PARAMETER SUPPORT
// GET  → fetch todo document for a given date (default: today)
// POST → create / upsert todo document for specified date (default: today)
// PATCH → update task (edit text, toggle complete, mark-all) for specified date
// DELETE → delete a single task from specified date

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import { Todo } from "@/app/models/Todo";
import { v4 as uuidv4 } from "uuid";

const MAX_TASKS = 20;
const MAX_CHAR  = 150;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getUser(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// ── Local date helper ─────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── GET /api/todo?date=YYYY-MM-DD ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayISO();

  const todo = await Todo.findOne({ userId: user.userId, date }).lean();

  return NextResponse.json({
    success: true,
    date,
    tasks: todo?.tasks ?? [],
    allCompletedToastShown: todo?.allCompletedToastShown ?? false,
  });
}

// ── POST /api/todo — add a new task ──────────────────────────────────────────
// Now supports optional `date` field in body to add tasks for any date

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  let body: { text: string; date?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text)
    return NextResponse.json({ success: false, message: "Task text is required" }, { status: 400 });
  if (text.length > MAX_CHAR)
    return NextResponse.json({ success: false, message: `Max ${MAX_CHAR} characters` }, { status: 400 });

  await connectDB();

  // Support custom date or default to today
  const date = body.date || todayISO();
  const existing = await Todo.findOne({ userId: user.userId, date });

  if (existing && existing.tasks.length >= MAX_TASKS) {
    return NextResponse.json(
      { success: false, message: `You can add a maximum of ${MAX_TASKS} tasks per day.` },
      { status: 400 }
    );
  }

  const newTask = {
    id:          uuidv4(),
    text,
    completed:   false,
    createdAt:   new Date(),
    completedAt: null,
  };

  // ✅ KEY FIX: Do NOT reset allCompletedToastShown when adding new tasks.
  //    $setOnInsert only runs on brand-new documents, so existing docs keep
  //    their allCompletedToastShown value untouched.
  const todo = await Todo.findOneAndUpdate(
    { userId: user.userId, date },
    {
      $push: { tasks: newTask },
      $setOnInsert: { allCompletedToastShown: false },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, tasks: todo.tasks });
}

// ── PATCH /api/todo — edit, toggle, mark-all, mark-toast-shown ───────────────
// Now supports optional `date` field in body to modify tasks for any date

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  let body: {
    action: "toggle" | "edit" | "mark-all" | "toast-shown";
    taskId?: string;
    text?: string;
    date?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  await connectDB();

  // Support custom date or default to today
  const date = body.date || todayISO();
  const todo = await Todo.findOne({ userId: user.userId, date });

  if (!todo)
    return NextResponse.json({ success: false, message: "Todo not found" }, { status: 404 });

  if (body.action === "toggle") {
    const task = todo.tasks.find((t: any) => t.id === body.taskId);
    if (!task)
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });

    task.completed   = !task.completed;
    task.completedAt = task.completed ? new Date() : null;

    // ✅ KEY FIX: We NEVER reset allCompletedToastShown back to false.
    //    Once the toast has been shown for the day (allCompletedToastShown=true),
    //    it stays true regardless of toggling, adding new tasks, or mark-all.
    //    The toast is a one-time-per-day event — the user earned it already.

  } else if (body.action === "edit") {
    const text = (body.text || "").trim();
    if (!text)
      return NextResponse.json({ success: false, message: "Text required" }, { status: 400 });
    if (text.length > MAX_CHAR)
      return NextResponse.json({ success: false, message: `Max ${MAX_CHAR} characters` }, { status: 400 });
    const task = todo.tasks.find((t: any) => t.id === body.taskId);
    if (!task)
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    task.text = text;

  } else if (body.action === "mark-all") {
    const now = new Date();
    todo.tasks.forEach((t: any) => {
      t.completed   = true;
      t.completedAt = t.completedAt || now;
    });
    // ✅ No reset of allCompletedToastShown here either

  } else if (body.action === "toast-shown") {
    // Marks the toast as shown for today — this is permanent for the day
    todo.allCompletedToastShown = true;

  } else {
    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  }

  await todo.save();

  return NextResponse.json({
    success: true,
    tasks: todo.tasks,
    allCompletedToastShown: todo.allCompletedToastShown,
  });
}

// ── DELETE /api/todo?taskId=xxx&date=YYYY-MM-DD ───────────────────────────────
// Now properly supports date parameter to delete tasks from any date

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  const date   = searchParams.get("date") || todayISO();

  if (!taskId)
    return NextResponse.json({ success: false, message: "taskId required" }, { status: 400 });

  await connectDB();

  const todo = await Todo.findOneAndUpdate(
    { userId: user.userId, date },
    { $pull: { tasks: { id: taskId } } },
    { new: true }
  );

  if (!todo)
    return NextResponse.json({ success: false, message: "Todo not found" }, { status: 404 });

  return NextResponse.json({ success: true, tasks: todo.tasks });
}