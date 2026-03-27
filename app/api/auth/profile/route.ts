// app/api/auth/profile/route.ts


import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

type DecodedToken = {
  userId: string;
  email: string;
  role: string;
  deviceId?: string;
};

function normalizeWorkHours(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  // sensible app-level range
  if (num < 0 || num > 24) return null;

  // round to 2 decimals max
  return Math.round(num * 100) / 100;
}

// ─────────────────────────────────────────────
// GET /api/auth/profile
// Returns editable profile data for current user
// ─────────────────────────────────────────────
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as DecodedToken;

    await connectDB();

    const user = await User.findById(decoded.userId).select(
      "fullName email companyName defaultWorkHours role status banReason blockedUntil devices createdAt updatedAt"
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // ── Account-level ban check ──
    if (user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "Your account has been permanently banned." },
        { status: 403 }
      );
    }

    // ── Account-level suspension check ──
    if (user.status === "suspended") {
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        return NextResponse.json(
          { success: false, message: "Your account has been suspended." },
          { status: 403 }
        );
      }

      // suspension expired → silently restore
      user.status = "active";
      user.banReason = "";
      user.blockedUntil = null;
      await user.save();
    }

    // ── Device-level ban check ──
    if (decoded.deviceId) {
      const device = user.devices?.find(
        (d: any) => d.deviceId === decoded.deviceId
      );

      if (device?.isBanned) {
        return NextResponse.json(
          {
            success: false,
            message: device.banReason
              ? `This device has been banned. Reason: ${device.banReason}`
              : "This device has been banned from accessing this account.",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        fullName: user.fullName ?? "",
        email: user.email ?? "",
        companyName: user.companyName ?? "",
        defaultWorkHours: user.defaultWorkHours ?? 8.5,
        role: user.role ?? "employee",
      },
    });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/auth/profile
// Updates editable profile fields
// Allowed:
//   - fullName
//   - companyName
//   - defaultWorkHours
// Not allowed:
//   - email
//   - role
//   - status
//   - password
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as DecodedToken;

    const body = await req.json();

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const companyName =
      typeof body.companyName === "string" ? body.companyName.trim() : "";
    const defaultWorkHours = normalizeWorkHours(body.defaultWorkHours);

    // ── Validation ────────────────────────────
    if (!fullName || fullName.length < 2 || fullName.length > 60) {
      return NextResponse.json(
        {
          success: false,
          message: "Full name must be between 2 and 60 characters.",
        },
        { status: 400 }
      );
    }

    if (companyName.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "Company name cannot exceed 100 characters.",
        },
        { status: 400 }
      );
    }

    if (defaultWorkHours === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Default work hours must be a valid number between 0 and 24.",
        },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(decoded.userId).select(
      "fullName email companyName defaultWorkHours role status banReason blockedUntil devices"
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // ── Account-level ban check ──
    if (user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "Your account has been permanently banned." },
        { status: 403 }
      );
    }

    // ── Account-level suspension check ──
    if (user.status === "suspended") {
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        return NextResponse.json(
          { success: false, message: "Your account has been suspended." },
          { status: 403 }
        );
      }

      // suspension expired → silently restore
      user.status = "active";
      user.banReason = "";
      user.blockedUntil = null;
    }

    // ── Device-level ban check ──
    if (decoded.deviceId) {
      const device = user.devices?.find(
        (d: any) => d.deviceId === decoded.deviceId
      );

      if (device?.isBanned) {
        return NextResponse.json(
          {
            success: false,
            message: device.banReason
              ? `This device has been banned. Reason: ${device.banReason}`
              : "This device has been banned from accessing this account.",
          },
          { status: 403 }
        );
      }
    }

    // ── Prevent useless DB write ──
    const noChanges =
      user.fullName === fullName &&
      (user.companyName ?? "") === companyName &&
      Number(user.defaultWorkHours ?? 8.5) === defaultWorkHours;

    if (noChanges) {
      return NextResponse.json({
        success: true,
        message: "No changes detected.",
        user: {
          fullName: user.fullName ?? "",
          email: user.email ?? "",
          companyName: user.companyName ?? "",
          defaultWorkHours: user.defaultWorkHours ?? 8.5,
          role: user.role ?? "employee",
        },
      });
    }

    // ── Apply updates ──
    user.fullName = fullName;
    user.companyName = companyName;
    user.defaultWorkHours = defaultWorkHours;

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        fullName: user.fullName ?? "",
        email: user.email ?? "",
        companyName: user.companyName ?? "",
        defaultWorkHours: user.defaultWorkHours ?? 8.5,
        role: user.role ?? "employee",
      },
    });
  } catch (error: any) {
    console.error("PATCH PROFILE ERROR:", error);

    if (error.name === "JsonWebTokenError") {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}