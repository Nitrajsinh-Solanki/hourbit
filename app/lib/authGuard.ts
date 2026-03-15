// app/lib/authGuard.ts

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

export interface AuthPayload {
  userId:   string;
  email:    string;
  role:     string;
  deviceId: string;
}

export type AuthResult =
  | { ok: true;  payload: AuthPayload }
  | { ok: false; status: number; message: string };

/**
 * Validates the JWT cookie AND checks:
 *  - user exists
 *  - user.status is "active" (not banned/suspended)
 *  - the specific device is not banned
 *
 * Use this in every protected API route.
 */
export async function requireAuth(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return { ok: false, status: 401, message: "Not authenticated" };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;

    await connectDB();

    const user = await User.findById(decoded.userId).select(
      "status isBlocked blockedUntil devices role"
    );

    if (!user) {
      return { ok: false, status: 401, message: "User not found" };
    }

    // Check account-level ban
    if (user.status === "banned") {
      return { ok: false, status: 403, message: "Account permanently banned" };
    }

    if (user.status === "suspended") {
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        return { ok: false, status: 403, message: "Account suspended" };
      }
      // Suspension expired — auto-restore
      user.status = "active";
      await user.save();
    }

    // Check device-level ban (only if deviceId is in the JWT)
    if (decoded.deviceId) {
      const device = user.devices.find((d: any) => d.deviceId === decoded.deviceId);
      if (device?.isBanned) {
        return { ok: false, status: 403, message: "This device has been banned" };
      }
    }

    return { ok: true, payload: decoded };

  } catch {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }
}

/**
 * Same as requireAuth but also requires role === "admin"
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.payload.role !== "admin") {
    return { ok: false, status: 403, message: "Admin access required" };
  }
  return result;
}