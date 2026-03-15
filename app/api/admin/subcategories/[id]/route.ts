// app/api/admin/subcategories/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/app/lib/mongodb";
import { Subcategory } from "@/app/models/brain/Subcategory";
import { Category }    from "@/app/models/brain/Category";
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

// ── GET /api/admin/subcategories/[id] ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const subcategory = await Subcategory.findById(id).lean();
  if (!subcategory) {
    return NextResponse.json({ success: false, message: "Subcategory not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, subcategory });
}

// ── PUT /api/admin/subcategories/[id] ─────────────────────────────────────────
// Body: { name?, categoryId?, displayOrder?, status? }
// Slug is NOT accepted — auto-regenerates from name via pre-save hook

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();
    const { name, categoryId, displayOrder, status } = body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return NextResponse.json({ success: false, message: "Subcategory not found" }, { status: 404 });
    }

    // ── Validate and apply name ──
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ success: false, message: "Name cannot be empty" }, { status: 400 });
      }
      if (name.trim().length > 80) {
        return NextResponse.json({ success: false, message: "Name must be 80 characters or less" }, { status: 400 });
      }
      subcategory.name = name.trim();
      // slug will regenerate automatically via pre-save hook (isModified("name") = true)
    }

    // ── Validate and apply categoryId (parent reassignment) ──
    if (categoryId !== undefined) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return NextResponse.json({ success: false, message: "Target category not found" }, { status: 404 });
      }
      subcategory.categoryId = categoryId;
    }

    if (displayOrder !== undefined) {
      subcategory.displayOrder = Number(displayOrder) || 0;
    }

    if (status !== undefined) {
      const allowed = ["active", "archived", "deleted"];
      if (!allowed.includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid status value" }, { status: 400 });
      }
      subcategory.status = status;
    }

    await subcategory.save();

    return NextResponse.json({ success: true, subcategory });

  } catch (error: any) {
    // Duplicate (categoryId + slug) compound index
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: "A subcategory with this name already exists in that category." },
        { status: 409 }
      );
    }
    console.error("UPDATE SUBCATEGORY ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/subcategories/[id] ──────────────────────────────────────
// Uses findByIdAndDelete() → triggers Subcategory post-hook
// → cascade deletes all Levels → which cascade deletes all Questions

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  try {
    // MUST use findByIdAndDelete — triggers the "findOneAndDelete" post-hook
    // in Subcategory.ts → cascade deletes Levels → Questions
    const deleted = await Subcategory.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, message: "Subcategory not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Subcategory and all related levels and questions have been permanently deleted.",
    });

  } catch (error) {
    console.error("DELETE SUBCATEGORY ERROR:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}