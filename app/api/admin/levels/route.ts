// app/api/admin/levels/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }    from "@/app/lib/mongodb";
import { Level }        from "@/app/models/brain/Level";
import { Subcategory }  from "@/app/models/brain/Subcategory";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";

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

// ── GET /api/admin/levels ─────────────────────────────────────────────────────
// Query params:
//   ?subcategoryId=xxx   (required)
//   ?status=active|archived|deleted|all   (default: active+archived)
//   ?search=text         (matches levelNumber or difficulty)
//   ?page=1
//   ?limit=50

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const subcategoryId = searchParams.get("subcategoryId") || "";
  const statusParam   = searchParams.get("status")        || "all";
  const search        = searchParams.get("search")?.trim() || "";
  const page          = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit         = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  if (!subcategoryId) {
    return NextResponse.json({ success: false, message: "subcategoryId is required" }, { status: 400 });
  }

  // Build filter
  const filter: Record<string, unknown> = { subcategoryId };

  if (statusParam === "all") {
    filter.status = { $in: ["active", "archived"] };
  } else {
    filter.status = statusParam;
  }

  // Search by levelNumber or difficulty
  if (search) {
    const num = parseInt(search);
    if (!isNaN(num)) {
      filter.levelNumber = num;
    } else {
      filter.difficulty = { $regex: search, $options: "i" };
    }
  }

  const total  = await Level.countDocuments(filter);
  const levels = await Level.find(filter)
    .sort({ displayOrder: 1, levelNumber: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    levels,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

// ── POST /api/admin/levels ────────────────────────────────────────────────────
// Body: { subcategoryId, levelNumber, difficulty, xpReward, maxAttempts,
//         questionCount, timeLimitMinutes, displayOrder, status }

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  try {
    const body = await req.json();
    const {
      subcategoryId,
      levelNumber,
      difficulty      = "easy",
      xpReward        = 100,
      maxAttempts     = 3,
      questionCount   = 10,
      timeLimitMinutes = 0,
      displayOrder    = 0,
      status          = "active",
    } = body;

    // Validate required fields
    if (!subcategoryId) {
      return NextResponse.json({ success: false, message: "subcategoryId is required" }, { status: 400 });
    }
    if (!levelNumber || isNaN(Number(levelNumber)) || Number(levelNumber) < 1) {
      return NextResponse.json({ success: false, message: "Level number must be a positive integer" }, { status: 400 });
    }

    // Verify parent subcategory exists
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return NextResponse.json({ success: false, message: "Parent subcategory not found" }, { status: 404 });
    }

    // Validate difficulty enum
    const validDifficulties = ["easy", "medium", "hard", "expert"];
    if (!validDifficulties.includes(difficulty)) {
      return NextResponse.json({ success: false, message: "Invalid difficulty value" }, { status: 400 });
    }

    const level = await Level.create({
      subcategoryId,
      levelNumber:      Number(levelNumber),
      difficulty,
      xpReward:         Number(xpReward)         || 100,
      maxAttempts:      Number(maxAttempts)       || 3,
      questionCount:    Number(questionCount)     || 10,
      timeLimitMinutes: Number(timeLimitMinutes)  || 0,
      displayOrder:     Number(displayOrder)      || 0,
      status,
    });

    return NextResponse.json({ success: true, level }, { status: 201 });

  } catch (error: any) {
    // Duplicate (subcategoryId + levelNumber) unique index
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A level with this number already exists in the selected subcategory." },
        { status: 409 }
      );
    }
    console.error("CREATE LEVEL ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── PATCH /api/admin/levels — bulk reorder ────────────────────────────────────
// Body: { updates: [{ id, displayOrder }, ...] }

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ success: false, message: "updates array required" }, { status: 400 });
    }

    const ops = updates.map(({ id, displayOrder }: { id: string; displayOrder: number }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { displayOrder: Number(displayOrder) } },
      },
    }));

    await Level.bulkWrite(ops);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("REORDER LEVEL ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}