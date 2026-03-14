// app/api/work/today/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

/** Return midnight UTC for today */
function todayMidnightUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ── GET /api/work/today ────────────────────────────────────────
// Returns today's work log. Includes effective requiredWorkHours:
//   log.requiredWorkHoursOverride (per-day) if set, else user.defaultWorkHours
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };

    await connectDB();

    // Fetch user defaults + today's log in parallel
    const [log, user] = await Promise.all([
      WorkLog.findOne({
        userId: decoded.userId,
        date:   todayMidnightUTC(),
      }).lean(),
      User.findById(decoded.userId).select("defaultWorkHours").lean(),
    ]);

    const userDefaultHours: number = (user as any)?.defaultWorkHours ?? 8.5;

    // No log yet — return null + profile defaults so the UI knows the target
    if (!log) {
      return NextResponse.json({
        success:  true,
        data:     null,
        defaults: { requiredWorkHours: userDefaultHours },
      });
    }

    const l = log as any;

    // Effective hours: per-day override wins over profile default
    const effectiveRequiredHours: number =
      l.requiredWorkHoursOverride != null
        ? l.requiredWorkHoursOverride
        : userDefaultHours;

    return NextResponse.json({
      success: true,
      data: {
        entryTime:  l.entryTime ? (l.entryTime as Date).toISOString() : null,
        exitTime:   l.exitTime  ? (l.exitTime  as Date).toISOString() : null,
        breaks: (l.breaks as any[]).map((b) => ({
          start:    (b.start as Date).toISOString(),
          end:      (b.end   as Date).toISOString(),
          duration: b.duration,
          type:     b.type,
          label:    b.label ?? "",
        })),
        totalBreakTime:    l.totalBreakTime,
        totalOfficeTime:   l.totalOfficeTime,
        productiveTime:    l.productiveTime,
        notes:             l.notes,
        isHoliday:         l.isHoliday,

        // Per-day override value (null = not set, UI shows "using profile default")
        requiredWorkHoursOverride: l.requiredWorkHoursOverride ?? null,
        // Effective value the UI uses for all calculations
        requiredWorkHours:         effectiveRequiredHours,
      },
      // Profile default always returned so UI can show "reset to X"
      defaults: { requiredWorkHours: userDefaultHours },
    });

  } catch (error: any) {
    console.error("GET TODAY LOG ERROR:", error);

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