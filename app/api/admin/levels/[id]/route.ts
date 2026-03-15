// app/api/admin/levels/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/app/lib/mongodb";
import { Level }       from "@/app/models/brain/Level";
import { cookies }     from "next/headers";
import jwt             from "jsonwebtoken";

// ── Admin auth guard ──────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role:   string;
    };
    if (decoded.role !== "admin") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// ── GET /api/admin/levels/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const level = await Level.findById(id).lean();
  if (!level) return NextResponse.json({ success: false, message: "Level not found" }, { status: 404 });

  return NextResponse.json({ success: true, level });
}

// ── PUT /api/admin/levels/[id] ────────────────────────────────────────────────
// Body: any subset of level fields (all optional except validation)

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();
    const {
      levelNumber,
      difficulty,
      xpReward,
      penaltyXpMultiplier,
      maxAttempts,
      questionCount,
      timeLimitMinutes,
      displayOrder,
      status,
      name,
    } = body;

    const level = await Level.findById(id);
    if (!level) return NextResponse.json({ success: false, message: "Level not found" }, { status: 404 });

    if (levelNumber !== undefined) {
      if (isNaN(Number(levelNumber)) || Number(levelNumber) < 1) {
        return NextResponse.json({ success: false, message: "Level number must be a positive integer" }, { status: 400 });
      }
      level.levelNumber = Number(levelNumber);
    }

    if (name !== undefined)        level.name = String(name).trim();

    if (difficulty !== undefined) {
      const valid = ["easy", "medium", "hard", "expert"];
      if (!valid.includes(difficulty)) {
        return NextResponse.json({ success: false, message: "Invalid difficulty value" }, { status: 400 });
      }
      level.difficulty = difficulty;
    }

    if (xpReward         !== undefined) level.xpReward         = Math.max(0, Number(xpReward));
    if (penaltyXpMultiplier !== undefined) {
      const v = Number(penaltyXpMultiplier);
      if (v < 0 || v > 1) {
        return NextResponse.json({ success: false, message: "Penalty multiplier must be between 0 and 1" }, { status: 400 });
      }
      level.penaltyXpMultiplier = v;
    }
    if (maxAttempts      !== undefined) level.maxAttempts      = Math.max(1, Number(maxAttempts));
    if (questionCount    !== undefined) level.questionCount    = Math.max(1, Number(questionCount));
    if (timeLimitMinutes !== undefined) level.timeLimitMinutes = Math.max(0, Number(timeLimitMinutes));
    if (displayOrder     !== undefined) level.displayOrder     = Number(displayOrder) || 0;

    if (status !== undefined) {
      const allowed = ["active", "archived", "deleted"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid status value" }, { status: 400 });
      }
      level.status = status;
    }

    await level.save();
    return NextResponse.json({ success: true, level });

  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A level with this number already exists in this subcategory." },
        { status: 409 }
      );
    }
    console.error("UPDATE LEVEL ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/levels/[id] ─────────────────────────────────────────────
// Uses findByIdAndDelete() → triggers Level post-hook
// → cascade deletes all Questions belonging to this level

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  try {
    // MUST use findByIdAndDelete — triggers the "findOneAndDelete" post-hook
    // in Level.ts → cascade deletes all Questions for this level
    const deleted = await Level.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, message: "Level not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Level and all related questions have been permanently deleted.",
    });

  } catch (error) {
    console.error("DELETE LEVEL ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}