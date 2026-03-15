// app/api/admin/users/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { requireAdmin } from "@/app/lib/authGuard";

// GET /api/admin/users?page=1&limit=20&status=all&search=email
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") || "20"));
  const status = searchParams.get("status") || "all";
  const search = searchParams.get("search")?.trim() || "";

  const filter: Record<string, unknown> = { role: "employee" };

  if (status !== "all") filter.status = status;

  if (search) {
    filter.$or = [
      { email:    { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select("fullName email status banReason bannedAt lastLogin devices createdAt companyName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    users,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}