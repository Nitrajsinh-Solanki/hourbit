// app/api/auth/profile/sessions/route.ts
//
// Employee version of session management
// GET  → returns all devices registered on the current employee account
//         EXCEPT the current device (identified by deviceId in the JWT).
//
// DELETE { deviceId: string } → removes (revokes) a specific session/device
// DELETE { deviceId: "all" }  → removes ALL sessions except the current one
//
// PATCH { deviceId, ban: true|false } → toggle ban on a specific device
// Ban = immediately log out + permanently ban that device from accessing the account

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

async function requireEmployee(): Promise<
  { userId: string; currentDeviceId: string } | { error: string; status: number }
> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return { error: "Not authenticated", status: 401 };

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    // Allow both employee and admin roles to access this
    if (!decoded.role) return { error: "Invalid token", status: 401 };

    return {
      userId:          decoded.userId,
      currentDeviceId: decoded.deviceId ?? "",
    };
  } catch {
    return { error: "Invalid or expired token", status: 401 };
  }
}

// ── GET — list all sessions ──────────────────────────────────────────────────
export async function GET() {
  const auth = await requireEmployee();
  if ("error" in auth) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  }

  await connectDB();

  const user = await User.findById(auth.userId).select("devices email fullName").lean() as any;
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  // Return all devices, marking which one is the current session
  const sessions = (user.devices ?? []).map((d: any) => ({
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
    email:    user.email,
    fullName: user.fullName,
  });
}

// ── DELETE — revoke (remove) a session or all sessions ───────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireEmployee();
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

  const user = await User.findById(auth.userId);
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  if (targetDeviceId === "all") {
    // Remove all devices EXCEPT the current one
    user.devices = user.devices.filter(
      (d: any) => d.deviceId === auth.currentDeviceId
    );
  } else {
    user.devices = user.devices.filter(
      (d: any) => d.deviceId !== targetDeviceId
    );
  }

  await user.save();

  return NextResponse.json({
    success: true,
    message: targetDeviceId === "all"
      ? "All other sessions have been removed."
      : "Session removed successfully.",
  });
}

// ── PATCH — ban / unban a specific session ───────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireEmployee();
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

  const user = await User.findById(auth.userId);
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const device = user.devices.find((d: any) => d.deviceId === targetDeviceId);
  if (!device) {
    return NextResponse.json({ success: false, message: "Session not found" }, { status: 404 });
  }

  device.isBanned  = ban;
  device.banReason = ban ? (typeof body.banReason === "string" ? body.banReason.trim() : "Banned by user") : "";
  device.bannedAt  = ban ? new Date() : null;

  await user.save();

  return NextResponse.json({
    success: true,
    message: ban ? "Session banned successfully." : "Session unbanned successfully.",
  });
}