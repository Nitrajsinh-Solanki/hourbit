// app/api/admin/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import User                          from "@/app/models/User";
import { requireAdmin }              from "@/app/lib/authGuard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // ← Promise<{id}>
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  // ── Await params before reading .id ──
  const { id } = await params;

  await connectDB();

  const user = await User.findById(id)
    .select("-password -otp -otpExpiry")
    .lean();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, user });
}