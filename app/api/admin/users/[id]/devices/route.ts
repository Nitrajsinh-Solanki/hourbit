// app/api/admin/users/[id]/devices/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import User                          from "@/app/models/User";
import { requireAdmin }              from "@/app/lib/authGuard";

// PATCH /api/admin/users/[id]/devices
// Body: { deviceId: string, isBanned: boolean, banReason?: string }
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
  const { deviceId, isBanned, banReason } = body;

  if (!deviceId || typeof isBanned !== "boolean") {
    return NextResponse.json(
      { success: false, message: "deviceId (string) and isBanned (boolean) are required." },
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

  const device = user.devices.find((d: any) => d.deviceId === deviceId);
  if (!device) {
    return NextResponse.json(
      { success: false, message: "Device not found on this user account." },
      { status: 404 }
    );
  }

  device.isBanned  = isBanned;
  device.bannedAt  = isBanned ? new Date() : null;
  device.banReason = banReason?.trim() || "";

  await user.save();

  return NextResponse.json({
    success: true,
    message: `Device ${isBanned ? "banned" : "unbanned"} successfully.`,
  });
}

// DELETE /api/admin/users/[id]/devices?deviceId=xxx
// Removes a device from the user's registered devices list entirely
export async function DELETE(
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

  const deviceId = new URL(req.url).searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json(
      { success: false, message: "deviceId query param is required." },
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

  const beforeCount = user.devices.length;
  user.devices      = user.devices.filter((d: any) => d.deviceId !== deviceId);

  if (user.devices.length === beforeCount) {
    return NextResponse.json(
      { success: false, message: "Device not found on this user account." },
      { status: 404 }
    );
  }

  await user.save();

  return NextResponse.json({
    success: true,
    message: "Device removed successfully.",
  });
}