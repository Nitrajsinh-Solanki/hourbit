// app/api/admin/users/[id]/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import User                          from "@/app/models/User";
import { requireAdmin }              from "@/app/lib/authGuard";

// PATCH /api/admin/users/[id]/status
// Body: {
//   status: "active" | "suspended" | "banned",
//   banReason?: string,
//   suspendUntil?: string   // ISO date string, only for "suspended"
// }
export async function PATCH(
  req: NextRequest,
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

  const body = await req.json();
  const { status, banReason, suspendUntil } = body;

  if (!["active", "suspended", "banned"].includes(status)) {
    return NextResponse.json(
      { success: false, message: "Invalid status. Must be active, suspended, or banned." },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json(
      { success: false, message: "User not found" },
      { status: 404 }
    );
  }

  // Prevent admin from banning themselves
  if (String(user._id) === auth.payload.userId) {
    return NextResponse.json(
      { success: false, message: "You cannot change your own account status." },
      { status: 400 }
    );
  }

  // Prevent changing another admin's status
  if (user.role === "admin") {
    return NextResponse.json(
      { success: false, message: "Cannot change the status of another admin account." },
      { status: 400 }
    );
  }

  user.status    = status;
  user.banReason = banReason?.trim() || "";

  if (status === "banned") {
    user.bannedAt     = new Date();
    user.blockedUntil = null;
    // Clear all registered devices to immediately invalidate every active JWT
    user.devices      = [];
  } else if (status === "suspended") {
    user.bannedAt     = null;
    user.blockedUntil = suspendUntil ? new Date(suspendUntil) : null;
  } else if (status === "active") {
    user.bannedAt      = null;
    user.blockedUntil  = null;
    user.isBlocked     = false;
    user.loginAttempts = 0;
  }

  await user.save();

  return NextResponse.json({
    success: true,
    message: `User status updated to "${status}" successfully.`,
    user: {
      _id:       user._id,
      status:    user.status,
      banReason: user.banReason,
    },
  });
}