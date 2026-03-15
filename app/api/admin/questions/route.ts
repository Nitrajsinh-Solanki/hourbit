// app/api/admin/questions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }  from "@/app/lib/mongodb";
import { Question }   from "@/app/models/brain/Question";
import { Level }      from "@/app/models/brain/Level";
import { cookies }    from "next/headers";
import jwt            from "jsonwebtoken";

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

// ── GET /api/admin/questions ──────────────────────────────────────────────────
// Query params:
//   ?levelId=xxx          (required)
//   ?status=draft|published|all   (default: all)
//   ?questionType=option|text
//   ?hasHint=true|false
//   ?search=text          (searches questionContent)
//   ?page=1
//   ?limit=50

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const levelId      = searchParams.get("levelId")      || "";
  const statusParam  = searchParams.get("status")       || "all";
  const questionType = searchParams.get("questionType") || "";
  const hasHint      = searchParams.get("hasHint")      || "";
  const search       = searchParams.get("search")?.trim() || "";
  const page         = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  if (!levelId) {
    return NextResponse.json({ success: false, message: "levelId is required" }, { status: 400 });
  }

  // Build filter
  const filter: Record<string, unknown> = { levelId };

  if (statusParam !== "all") filter.status = statusParam;
  if (questionType)          filter.questionType = questionType;
  if (hasHint === "true")    filter.hintText = { $ne: "" };
  if (hasHint === "false")   filter.hintText = "";

  if (search) {
    filter.questionContent = { $regex: search, $options: "i" };
  }

  const total     = await Question.countDocuments(filter);
  const questions = await Question.find(filter)
    .sort({ displayOrder: 1, createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    questions,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

// ── POST /api/admin/questions ─────────────────────────────────────────────────
// Body: {
//   levelId, subcategoryId, categoryId,
//   questionType, questionContent,
//   optionA, optionB, optionC, optionD, correctOption,
//   acceptedAnswers,
//   hintText, hintXpPenalty, explanation,
//   displayOrder, status
// }

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();

  try {
    const body = await req.json();
    const {
      levelId,
      subcategoryId,
      categoryId,
      questionType,
      questionContent,
      optionA        = "",
      optionB        = "",
      optionC        = "",
      optionD        = "",
      correctOption  = "",
      acceptedAnswers = [],
      hintText       = "",
      hintXpPenalty  = 0,
      explanation    = "",
      displayOrder   = 0,
      status         = "draft",
    } = body;

    // ── Required field checks ──
    if (!levelId) {
      return NextResponse.json({ success: false, message: "levelId is required" }, { status: 400 });
    }
    if (!subcategoryId || !categoryId) {
      return NextResponse.json({ success: false, message: "subcategoryId and categoryId are required" }, { status: 400 });
    }
    if (!questionType || !["option", "text"].includes(questionType)) {
      return NextResponse.json({ success: false, message: "questionType must be 'option' or 'text'" }, { status: 400 });
    }
    if (!questionContent || questionContent.trim().length === 0) {
      return NextResponse.json({ success: false, message: "Question content is required" }, { status: 400 });
    }
    if (questionContent.length > 2000) {
      return NextResponse.json({ success: false, message: "Question content max 2000 characters" }, { status: 400 });
    }

    // ── Type-specific validation ──
    if (questionType === "option") {
      if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
        return NextResponse.json({ success: false, message: "All four options are required for option-type questions" }, { status: 400 });
      }
      if (!["A", "B", "C", "D"].includes(correctOption)) {
        return NextResponse.json({ success: false, message: "correctOption must be A, B, C, or D" }, { status: 400 });
      }
    }
    if (questionType === "text") {
      if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) {
        return NextResponse.json({ success: false, message: "At least one accepted answer is required for text-type questions" }, { status: 400 });
      }
    }

    // ── Verify level exists ──
    const level = await Level.findById(levelId);
    if (!level) {
      return NextResponse.json({ success: false, message: "Parent level not found" }, { status: 404 });
    }

    const question = await Question.create({
      levelId,
      subcategoryId,
      categoryId,
      questionType,
      questionContent: questionContent.trim(),
      optionA:         questionType === "option" ? optionA.trim()  : "",
      optionB:         questionType === "option" ? optionB.trim()  : "",
      optionC:         questionType === "option" ? optionC.trim()  : "",
      optionD:         questionType === "option" ? optionD.trim()  : "",
      correctOption:   questionType === "option" ? correctOption   : "",
      acceptedAnswers: questionType === "text"
        ? acceptedAnswers.map((a: string) => a.toLowerCase().trim()).filter(Boolean)
        : [],
      hintText:        hintText.trim(),
      hintXpPenalty:   Math.max(0, Number(hintXpPenalty)),
      explanation:     explanation.trim(),
      displayOrder:    Number(displayOrder) || 0,
      status,
    });

    return NextResponse.json({ success: true, question }, { status: 201 });

  } catch (error: any) {
    console.error("CREATE QUESTION ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── PATCH /api/admin/questions — bulk reorder ─────────────────────────────────
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

    await Question.bulkWrite(ops);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("REORDER QUESTION ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}