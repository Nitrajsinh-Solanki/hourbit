// app/api/auth/me/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import User             from "@/app/models/User";

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

    /* ── Verify JWT ── */
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId:   string;
      email:    string;
      role:     string;
      deviceId: string;   // present in all tokens issued after the login update
    };

    await connectDB();

    /* ── Fetch the user — include status + device list for ban checks ── */
    const user = await User.findById(decoded.userId).select(
      "fullName email role companyName status banReason blockedUntil devices"
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    /* ── Account-level ban check ── */
    if (user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "Your account has been permanently banned." },
        { status: 403 }
      );
    }

    /* ── Account-level suspension check ── */
    if (user.status === "suspended") {
      if (!user.blockedUntil || user.blockedUntil > new Date()) {
        return NextResponse.json(
          { success: false, message: "Your account has been suspended." },
          { status: 403 }
        );
      }

      // Suspension has expired — silently restore
      user.status       = "active";
      user.banReason    = "";
      user.blockedUntil = null;
      await user.save();
    }

    /* ── Device-level ban check ── */
    // Only runs when the JWT was issued after the login update (has deviceId)
    if (decoded.deviceId) {
      const device = user.devices.find(
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

    /* ── All checks passed — return user info ── */
    return NextResponse.json({
      success: true,
      user: {
        fullName:    user.fullName,
        email:       user.email,
        role:        user.role,
        companyName: user.companyName,
      },
    });

  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid or expired token" },
      { status: 401 }
    );
  }
}