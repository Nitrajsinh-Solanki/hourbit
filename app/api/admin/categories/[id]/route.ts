// app/api/admin/categories/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { Category } from "@/app/models/brain/Category";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

// ── Admin auth guard ──────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role: string;
    };
    if (decoded.role !== "admin") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// ── GET /api/admin/categories/[id] ───────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;   // ← await params (Next.js 16 requirement)

  await connectDB();

  const category = await Category.findById(id).lean();
  if (!category) return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });

  return NextResponse.json({ success: true, category });
}

// ── PUT /api/admin/categories/[id] ───────────────────────────────────────────
// Body: { name?, description?, displayOrder?, status? }
// slug is NOT accepted — auto-regenerates from name via pre-save hook

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;   // ← await params

  await connectDB();

  try {
    const body = await req.json();
    const { name, description, displayOrder, status } = body;

    const category = await Category.findById(id);
    if (!category) return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ success: false, message: "Name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 80) {
        return NextResponse.json({ success: false, message: "Name must be 80 characters or less" }, { status: 400 });
      }
      category.name = name.trim();
      // slug regenerates automatically via pre-save hook (isModified("name") = true)
    }

    if (description !== undefined) {
      if (description.length > 500) {
        return NextResponse.json({ success: false, message: "Description must be 500 characters or less" }, { status: 400 });
      }
      category.description = description.trim();
    }

    if (displayOrder !== undefined) {
      category.displayOrder = Number(displayOrder) || 0;
    }

    if (status !== undefined) {
      const allowed = ["active", "archived", "deleted"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid status value" }, { status: 400 });
      }
      category.status = status;
    }

    await category.save();

    return NextResponse.json({ success: true, category });

  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A category with this name already exists." },
        { status: 409 }
      );
    }
    console.error("UPDATE CATEGORY ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/categories/[id] ────────────────────────────────────────
// Uses findByIdAndDelete() so the Category schema's "findOneAndDelete" post-hook
// fires and cascades:  Subcategories → Levels → Questions

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;   // ← await params

  await connectDB();

  try {
    // MUST use findByIdAndDelete — triggers the "findOneAndDelete" post-hook in Category.ts
    // which cascades: Subcategories → Levels → Questions
    const deleted = await Category.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Category and all related subcategories, levels, and questions have been permanently deleted.",
    });

  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}