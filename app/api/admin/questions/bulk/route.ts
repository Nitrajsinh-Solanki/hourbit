// app/api/admin/questions/bulk/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { Question }  from "@/app/models/brain/Question";
import { Level }     from "@/app/models/brain/Level";
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

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE VALIDATION
// Must match the frontend validateRow() function exactly.
// ─────────────────────────────────────────────────────────────────────────────

function validateQuestion(
  q: Record<string, unknown>,
  row: number
): { row: number; field: string; message: string }[] {
  const errs: { row: number; field: string; message: string }[] = [];

  const str = (v: unknown) => String(v ?? "").trim();

  // ── question_content ──
  const qc = str(q.questionContent);
  if (!qc) {
    errs.push({ row, field: "questionContent", message: "Question content is required" });
  } else if (qc.length < 10) {
    errs.push({ row, field: "questionContent", message: "Too short — must be at least 10 characters" });
  } else if (qc.length > 2000) {
    errs.push({ row, field: "questionContent", message: "Too long — max 2000 characters" });
  } else if (/^\d+(\.\d+)?$/.test(qc)) {
    errs.push({ row, field: "questionContent", message: "This looks like a number, not a question" });
  } else if (/^[a-zA-Z]{1,3}$/.test(qc)) {
    errs.push({ row, field: "questionContent", message: "Question is too short to be meaningful" });
  }

  // ── options ──
  const optA = str(q.optionA);
  const optB = str(q.optionB);
  const optC = str(q.optionC);
  const optD = str(q.optionD);

  if (!optA) errs.push({ row, field: "optionA", message: "Option A is required" });
  else if (optA.length > 500) errs.push({ row, field: "optionA", message: "Max 500 chars" });

  if (!optB) errs.push({ row, field: "optionB", message: "Option B is required" });
  else if (optB.length > 500) errs.push({ row, field: "optionB", message: "Max 500 chars" });

  if (!optC) errs.push({ row, field: "optionC", message: "Option C is required" });
  else if (optC.length > 500) errs.push({ row, field: "optionC", message: "Max 500 chars" });

  if (!optD) errs.push({ row, field: "optionD", message: "Option D is required" });
  else if (optD.length > 500) errs.push({ row, field: "optionD", message: "Max 500 chars" });

  // Duplicate option check
  const opts = [optA, optB, optC, optD].filter(Boolean);
  const unique = new Set(opts.map(o => o.toLowerCase()));
  if (unique.size < opts.length) {
    errs.push({ row, field: "optionA", message: "Duplicate options detected" });
  }

  // ── correct option ──
  const co = str(q.correctOption).toUpperCase();
  if (!co) {
    errs.push({ row, field: "correctOption", message: "Required" });
  } else if (!["A","B","C","D"].includes(co)) {
    errs.push({ row, field: "correctOption", message: "Must be A, B, C, or D" });
  } else {
    const map: Record<string, string> = { A: optA, B: optB, C: optC, D: optD };
    if (!map[co]) {
      errs.push({ row, field: "correctOption", message: `Option ${co} is empty` });
    }
  }

  // ── numeric fields ──
  if (q.hintXpPenalty !== undefined && String(q.hintXpPenalty).trim() !== "") {
    const v = Number(q.hintXpPenalty);
    if (isNaN(v)) errs.push({ row, field: "hintXpPenalty", message: "Must be a number" });
    else if (v < 0) errs.push({ row, field: "hintXpPenalty", message: "Cannot be negative" });
    else if (v > 1000) errs.push({ row, field: "hintXpPenalty", message: "Max 1000" });
  }

  // ── status ──
  if (q.status && !["draft", "published"].includes(String(q.status))) {
    errs.push({ row, field: "status", message: "Must be 'draft' or 'published'" });
  }

  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/questions/bulk
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  try {
    const body = await req.json();
    const { levelId, subcategoryId, categoryId, questions } = body;

    // ── Presence checks ────────────────────────────────────────────────────
    if (!levelId)       return NextResponse.json({ success: false, message: "levelId is required" },       { status: 400 });
    if (!subcategoryId) return NextResponse.json({ success: false, message: "subcategoryId is required" }, { status: 400 });
    if (!categoryId)    return NextResponse.json({ success: false, message: "categoryId is required" },    { status: 400 });

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, message: "questions array is required and must not be empty" }, { status: 400 });
    }

    // ── Fetch level ────────────────────────────────────────────────────────
    const level = await Level.findById(levelId);
    if (!level) {
      return NextResponse.json({ success: false, message: "Level not found" }, { status: 404 });
    }

    // ── Slot limit check ───────────────────────────────────────────────────
    const existingCount = await Question.countDocuments({ levelId });
    const slotsLeft     = level.questionCount - existingCount;

    if (slotsLeft <= 0) {
      return NextResponse.json({
        success:       false,
        message:       `This level is already full (${existingCount}/${level.questionCount} questions). Cannot add more.`,
        existingCount,
        maxAllowed:    level.questionCount,
        slotsLeft:     0,
      }, { status: 409 });
    }

    if (questions.length > slotsLeft) {
      return NextResponse.json({
        success:       false,
        message:       `Cannot add ${questions.length} question(s). Only ${slotsLeft} slot(s) remain in this level (max: ${level.questionCount}, existing: ${existingCount}).`,
        slotsLeft,
        existingCount,
        maxAllowed:    level.questionCount,
      }, { status: 409 });
    }

    // ── Validate all rows — collect all errors before rejecting ────────────
    const allErrors: { row: number; field: string; message: string }[] = [];
    questions.forEach((q: Record<string, unknown>, i: number) => {
      const rowErrors = validateQuestion(q, i + 1);
      allErrors.push(...rowErrors);
    });

    if (allErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Validation failed: ${allErrors.length} error(s) across ${new Set(allErrors.map(e => e.row)).size} question(s). Fix all errors before saving.`,
        errors:  allErrors,
      }, { status: 422 });
    }

    // ── Build and insert documents ─────────────────────────────────────────
    const docs = questions.map((q: Record<string, unknown>, i: number) => ({
      levelId,
      subcategoryId,
      categoryId,
      questionType:    "option",
      questionContent: String(q.questionContent).trim(),
      optionA:         String(q.optionA).trim(),
      optionB:         String(q.optionB).trim(),
      optionC:         String(q.optionC).trim(),
      optionD:         String(q.optionD).trim(),
      correctOption:   String(q.correctOption).trim().toUpperCase(),
      acceptedAnswers: [],
      hintText:        q.hintText        ? String(q.hintText).trim()             : "",
      hintXpPenalty:   q.hintXpPenalty   ? Math.max(0, Number(q.hintXpPenalty)) : 0,
      explanation:     q.explanation     ? String(q.explanation).trim()          : "",
      displayOrder:    q.displayOrder    !== undefined ? Number(q.displayOrder)  : existingCount + i,
      status:          q.status === "published" ? "published" : "draft",
    }));

    const inserted = await Question.insertMany(docs, { ordered: true });

    return NextResponse.json({
      success:        true,
      message:        `${inserted.length} question(s) saved successfully.`,
      savedCount:     inserted.length,
      existingCount:  existingCount + inserted.length,
      maxAllowed:     level.questionCount,
      slotsRemaining: level.questionCount - (existingCount + inserted.length),
    }, { status: 201 });

  } catch (error: any) {
    console.error("BULK UPLOAD ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error during bulk save" }, { status: 500 });
  }
}