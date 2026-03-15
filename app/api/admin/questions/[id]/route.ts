// app/api/admin/questions/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { Question }  from "@/app/models/brain/Question";
import { cookies }   from "next/headers";
import jwt           from "jsonwebtoken";

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

// ── GET /api/admin/questions/[id] ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const question = await Question.findById(id).lean();
  if (!question) return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 });

  return NextResponse.json({ success: true, question });
}

// ── PUT /api/admin/questions/[id] ─────────────────────────────────────────────
// Accepts any subset of question fields

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
      questionType,
      questionContent,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      acceptedAnswers,
      hintText,
      hintXpPenalty,
      explanation,
      displayOrder,
      status,
    } = body;

    const question = await Question.findById(id);
    if (!question) return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 });

    // ── questionType change ──
    if (questionType !== undefined) {
      if (!["option", "text"].includes(questionType)) {
        return NextResponse.json({ success: false, message: "questionType must be 'option' or 'text'" }, { status: 400 });
      }
      question.questionType = questionType;
    }

    const effectiveType = question.questionType;

    // ── questionContent ──
    if (questionContent !== undefined) {
      if (!questionContent.trim()) {
        return NextResponse.json({ success: false, message: "Question content cannot be empty" }, { status: 400 });
      }
      if (questionContent.length > 2000) {
        return NextResponse.json({ success: false, message: "Question content max 2000 characters" }, { status: 400 });
      }
      question.questionContent = questionContent.trim();
    }

    // ── Option fields ──
    if (effectiveType === "option") {
      if (optionA         !== undefined) question.optionA       = optionA.trim();
      if (optionB         !== undefined) question.optionB       = optionB.trim();
      if (optionC         !== undefined) question.optionC       = optionC.trim();
      if (optionD         !== undefined) question.optionD       = optionD.trim();
      if (correctOption   !== undefined) {
        if (!["A", "B", "C", "D"].includes(correctOption)) {
          return NextResponse.json({ success: false, message: "correctOption must be A, B, C, or D" }, { status: 400 });
        }
        question.correctOption = correctOption;
      }
      // Clear text fields
      question.acceptedAnswers = [];
    }

    // ── Text answer fields ──
    if (effectiveType === "text") {
      if (acceptedAnswers !== undefined) {
        if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) {
          return NextResponse.json({ success: false, message: "At least one accepted answer is required" }, { status: 400 });
        }
        question.acceptedAnswers = acceptedAnswers
          .map((a: string) => a.toLowerCase().trim())
          .filter(Boolean);
      }
      // Clear option fields
      question.optionA       = "";
      question.optionB       = "";
      question.optionC       = "";
      question.optionD       = "";
      question.correctOption = "";
    }

    // ── Hint & Explanation ──
    if (hintText       !== undefined) question.hintText       = hintText.trim();
    if (hintXpPenalty  !== undefined) question.hintXpPenalty  = Math.max(0, Number(hintXpPenalty));
    if (explanation    !== undefined) question.explanation    = explanation.trim();

    // ── Display & Status ──
    if (displayOrder !== undefined) question.displayOrder = Number(displayOrder) || 0;
    if (status       !== undefined) {
      if (!["draft", "published"].includes(status)) {
        return NextResponse.json({ success: false, message: "status must be 'draft' or 'published'" }, { status: 400 });
      }
      question.status = status;
    }

    await question.save();
    return NextResponse.json({ success: true, question });

  } catch (error: any) {
    console.error("UPDATE QUESTION ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/questions/[id] ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  try {
    const deleted = await Question.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Question deleted successfully." });
  } catch (error) {
    console.error("DELETE QUESTION ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}