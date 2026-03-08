// app/api/work/today/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";

/** Return midnight UTC for today */
function todayMidnightUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ── GET /api/work/today ────────────────────────────────────────
export async function GET() {
  try {
    // 1. Authenticate
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

    // 2. Fetch today's log
    const log = await WorkLog.findOne({
      userId: decoded.userId,
      date:   todayMidnightUTC(),
    }).lean();

    if (!log) {
      return NextResponse.json({ success: true, data: null });
    }

    // 3. Serialise Date fields → ISO strings for the client
    return NextResponse.json({
      success: true,
      data: {
        entryTime:         log.entryTime  ? (log.entryTime  as Date).toISOString() : null,
        exitTime:          log.exitTime   ? (log.exitTime   as Date).toISOString() : null,
        breaks: (log.breaks as any[]).map((b) => ({
          start:    (b.start as Date).toISOString(),
          end:      (b.end   as Date).toISOString(),
          duration: b.duration,
          type:     b.type,
        })),
        totalBreakTime:    log.totalBreakTime,
        totalOfficeTime:   log.totalOfficeTime,
        productiveTime:    log.productiveTime,
        requiredWorkHours: log.requiredWorkHours,
        notes:             log.notes,
        isHoliday:         log.isHoliday,
      },
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