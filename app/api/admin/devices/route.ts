// app/api/admin/devices/route.ts
//
// Manages a global banned-devices list (separate from per-user device bans).
// Banning a device here blocks ALL requests from that deviceId OR IP,
// regardless of which user account they use — checked in authGuard.ts.
//
// GET    /api/admin/devices              → list all banned devices/IPs
// POST   /api/admin/devices              → ban a device or IP globally
// DELETE /api/admin/devices              → unban a device or IP
// PATCH  /api/admin/devices/bulk-ban     → ban multiple devices at once

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import { cookies }   from "next/headers";
import jwt           from "jsonwebtoken";
import mongoose, { Schema, Model, Document } from "mongoose";

// ── Admin guard ───────────────────────────────────────────────────────────────

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

// ── BannedDevice model (defined inline so it can live in this file) ────────────

export interface IBannedDevice extends Document {
  type:      "device" | "ip";
  value:     string;   // deviceId or IP address
  reason:    string;
  bannedBy:  mongoose.Types.ObjectId;
  bannedAt:  Date;
  userAgent?: string;
  userId?:   mongoose.Types.ObjectId; // which user it was associated with (optional context)
}

const BannedDeviceSchema = new Schema<IBannedDevice>(
  {
    type:     { type: String, enum: ["device", "ip"], required: true, index: true },
    value:    { type: String, required: true, unique: true, index: true },
    reason:   { type: String, default: "" },
    bannedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bannedAt: { type: Date, default: Date.now },
    userAgent:{ type: String, default: "" },
    userId:   { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: false }
);

function getBannedDeviceModel(): Model<IBannedDevice> {
  return (mongoose.models.BannedDevice as Model<IBannedDevice>) ||
    mongoose.model<IBannedDevice>("BannedDevice", BannedDeviceSchema);
}

// ── GET — list all global bans ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await connectDB();
  const BannedDevice = getBannedDeviceModel();

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type")   || "all"; // "all" | "device" | "ip"
  const search = searchParams.get("search") || "";
  const page   = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  const filter: Record<string, unknown> = {};
  if (type !== "all") filter.type = type;
  if (search) filter.value = { $regex: search, $options: "i" };

  const total   = await BannedDevice.countDocuments(filter);
  const records = await BannedDevice.find(filter)
    .sort({ bannedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return NextResponse.json({
    success: true,
    bans: records,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}

// ── POST — ban a single device or IP ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const { type, value, reason = "", userAgent = "", userId } = body as {
    type: "device" | "ip";
    value: string;
    reason?: string;
    userAgent?: string;
    userId?: string;
  };

  if (!type || !["device", "ip"].includes(type)) {
    return NextResponse.json({ success: false, message: 'type must be "device" or "ip"' }, { status: 400 });
  }
  if (!value || typeof value !== "string" || value.trim() === "") {
    return NextResponse.json({ success: false, message: "value (deviceId or IP) is required" }, { status: 400 });
  }

  await connectDB();
  const BannedDevice = getBannedDeviceModel();

  // Also update the device's isBanned flag on the user's device array if userId provided
  if (userId && type === "device") {
    try {
      const User = (await import("@/app/models/User")).default;
      await User.updateOne(
        { _id: userId, "devices.deviceId": value.trim() },
        { $set: { "devices.$.isBanned": true, "devices.$.banReason": reason || "Globally banned by admin" } }
      );
    } catch {}
  }

  try {
    const ban = await BannedDevice.findOneAndUpdate(
      { value: value.trim() },
      {
        type,
        value:     value.trim(),
        reason:    typeof reason === "string" ? reason.trim() : "",
        bannedBy:  new mongoose.Types.ObjectId(admin.userId),
        bannedAt:  new Date(),
        userAgent: typeof userAgent === "string" ? userAgent.trim() : "",
        userId:    userId && mongoose.Types.ObjectId.isValid(userId as string)
          ? new mongoose.Types.ObjectId(userId as string)
          : null,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, ban, message: `${type === "ip" ? "IP" : "Device"} banned globally.` });
  } catch (err: any) {
    console.error("GLOBAL BAN ERROR:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── DELETE — unban ────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const value = searchParams.get("value");

  if (!value) {
    return NextResponse.json({ success: false, message: "value param required" }, { status: 400 });
  }

  await connectDB();
  const BannedDevice = getBannedDeviceModel();
  const deleted = await BannedDevice.deleteOne({ value: value.trim() });

  if (deleted.deletedCount === 0) {
    return NextResponse.json({ success: false, message: "Ban record not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Ban removed successfully." });
}

// ── PATCH — bulk ban multiple devices ────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const { bans } = body as {
    bans: Array<{ type: "device" | "ip"; value: string; reason?: string; userId?: string }>;
  };

  if (!Array.isArray(bans) || bans.length === 0) {
    return NextResponse.json({ success: false, message: "bans array required" }, { status: 400 });
  }

  await connectDB();
  const BannedDevice = getBannedDeviceModel();

  const ops = bans
    .filter(b => b.value && b.type)
    .map(b => ({
      updateOne: {
        filter: { value: b.value.trim() },
        update: {
          $set: {
            type:     b.type,
            value:    b.value.trim(),
            reason:   b.reason?.trim() || "",
            bannedBy: new mongoose.Types.ObjectId(admin.userId),
            bannedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

  if (ops.length === 0) {
    return NextResponse.json({ success: false, message: "No valid bans to apply" }, { status: 400 });
  }

  await BannedDevice.bulkWrite(ops);

  // Also reflect bans on user.devices array
  for (const b of bans) {
    if (b.type === "device" && b.userId) {
      try {
        const User = (await import("@/app/models/User")).default;
        await User.updateOne(
          { _id: b.userId, "devices.deviceId": b.value.trim() },
          { $set: { "devices.$.isBanned": true, "devices.$.banReason": b.reason || "Globally banned by admin" } }
        );
      } catch {}
    }
  }

  return NextResponse.json({ success: true, message: `${ops.length} ban(s) applied globally.`, count: ops.length });
}