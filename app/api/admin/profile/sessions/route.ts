// app/api/admin/profile/sessions/route.ts
//
// GET  → returns all devices registered on the current admin account
//         EXCEPT the current device (identified by deviceId in the JWT).
//
// DELETE { deviceId: string } → removes (revokes) a specific session/device
// DELETE { deviceId: "all" }  → removes ALL sessions except the current one
//
// "Ban" a session means flagging isBanned=true so even if they have a valid
// JWT cookie for that device, the authGuard will block them.
// PATCH { deviceId, ban: true|false } → toggle ban on a specific device

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

type DecodedToken = {
  userId:   string;
  email:    string;
  role:     string;
  deviceId?: string;
};

async function requireAdmin(): Promise<
  { adminId: string; currentDeviceId: string } | { error: string; status: number }
> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return { error: "Not authenticated", status: 401 };

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    if (decoded.role !== "admin") return { error: "Forbidden", status: 403 };

    return {
      adminId:         decoded.userId,
      currentDeviceId: decoded.deviceId ?? "",
    };
  } catch {
    return { error: "Invalid or expired token", status: 401 };
  }
}

// ── GET — list all OTHER sessions ────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  await connectDB();

  const admin = await User.findById(auth.adminId).select("devices email fullName").lean() as any;
  if (!admin) {
    return NextResponse.json({ success: false, message: "Admin not found" }, { status: 404 });
  }

  // Return all devices, marking which one is the current session
  const sessions = (admin.devices ?? []).map((d: any) => ({
    deviceId:        d.deviceId,
    ipAddress:       d.ipAddress  ?? "Unknown",
    userAgent:       d.userAgent  ?? "Unknown",
    lastLogin:       d.lastLogin  ?? null,
    isBanned:        d.isBanned   ?? false,
    banReason:       d.banReason  ?? "",
    isCurrent:       d.deviceId === auth.currentDeviceId,
  }));

  return NextResponse.json({
    success:  true,
    sessions,
    email:    admin.email,
    fullName: admin.fullName,
  });
}

// ── DELETE — revoke (remove) a session or all sessions ───────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const targetDeviceId = typeof body.deviceId === "string" ? body.deviceId : null;
  if (!targetDeviceId) {
    return NextResponse.json({ success: false, message: "deviceId is required" }, { status: 400 });
  }

  // Prevent removing the current session via this endpoint
  if (targetDeviceId === auth.currentDeviceId) {
    return NextResponse.json(
      { success: false, message: "You cannot remove your current active session here. Use Sign Out instead." },
      { status: 400 }
    );
  }

  await connectDB();

  const admin = await User.findById(auth.adminId);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Admin not found" }, { status: 404 });
  }

  if (targetDeviceId === "all") {
    // Remove all devices EXCEPT the current one
    admin.devices = admin.devices.filter(
      (d: any) => d.deviceId === auth.currentDeviceId
    );
  } else {
    admin.devices = admin.devices.filter(
      (d: any) => d.deviceId !== targetDeviceId
    );
  }

  await admin.save();

  return NextResponse.json({
    success: true,
    message: targetDeviceId === "all"
      ? "All other sessions have been removed."
      : "Session removed successfully.",
  });
}

// ── PATCH — ban / unban a specific session ───────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const targetDeviceId = typeof body.deviceId === "string" ? body.deviceId : null;
  const ban            = typeof body.ban      === "boolean" ? body.ban      : null;

  if (!targetDeviceId || ban === null) {
    return NextResponse.json(
      { success: false, message: "deviceId and ban (boolean) are required" },
      { status: 400 }
    );
  }

  if (targetDeviceId === auth.currentDeviceId) {
    return NextResponse.json(
      { success: false, message: "You cannot ban your own current session." },
      { status: 400 }
    );
  }

  await connectDB();

  const admin = await User.findById(auth.adminId);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Admin not found" }, { status: 404 });
  }

  const device = admin.devices.find((d: any) => d.deviceId === targetDeviceId);
  if (!device) {
    return NextResponse.json({ success: false, message: "Session not found" }, { status: 404 });
  }

  device.isBanned  = ban;
  device.banReason = ban ? (typeof body.banReason === "string" ? body.banReason.trim() : "Banned by admin") : "";
  device.bannedAt  = ban ? new Date() : null;

  await admin.save();

  return NextResponse.json({
    success: true,
    message: ban ? "Session banned successfully." : "Session unbanned successfully.",
  });
}