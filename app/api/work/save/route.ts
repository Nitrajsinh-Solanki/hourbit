// app/api/work/save/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// ── helpers ────────────────────────────────────────────────────

/** Convert "HH:MM" time string + a reference Date into a full Date object */
function timeStrToDate(timeStr: string, refDate: Date): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(refDate);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Return midnight UTC for a given date */
function toMidnightUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  );
}

// ── POST /api/work/save ────────────────────────────────────────
export async function POST(req: Request) {
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

    // Fetch user to get requiredWorkHours
    const user = await User.findById(decoded.userId).select("defaultWorkHours");
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // 2. Parse body
    const body = await req.json();
    const {
      entryTime,  // "HH:MM" | null
      exitTime,   // "HH:MM" | null
      breaks,     // [{ start: "HH:MM", end: "HH:MM", type: string }]
      notes,      // string
    } = body;

    // 3. Build today's midnight UTC date (used as the unique key)
    const now = new Date();
    const todayMidnight = toMidnightUTC(now);

    // 4. Convert time strings → Date objects
    const entryDate = entryTime ? timeStrToDate(entryTime, now) : null;
    const exitDate  = exitTime  ? timeStrToDate(exitTime,  now) : null;

    // 5. Calculate breaks
    const parsedBreaks = (breaks || [])
      .filter((b: any) => b.start && b.end)
      .map((b: any) => {
        const s = timeStrToDate(b.start, now);
        const e = timeStrToDate(b.end,   now);
        const dur = Math.max(0, Math.floor((e.getTime() - s.getTime()) / 1000));
        return { start: s, end: e, duration: dur, type: b.type || "custom" };
      });

    const totalBreakTime = parsedBreaks.reduce(
      (acc: number, b: any) => acc + b.duration, 0
    );

    // 6. Calculate office & productive time (seconds)
    let totalOfficeTime = 0;
    let productiveTime  = 0;

    if (entryDate && exitDate && exitDate > entryDate) {
      totalOfficeTime = Math.floor(
        (exitDate.getTime() - entryDate.getTime()) / 1000
      );
      productiveTime = Math.max(0, totalOfficeTime - totalBreakTime);
    }

    const requiredWorkHours = user.defaultWorkHours ?? 8.5;

    // 7. Upsert — one record per user per day
    const workLog = await WorkLog.findOneAndUpdate(
      { userId: decoded.userId, date: todayMidnight },
      {
        $set: {
          entryTime:         entryDate,
          exitTime:          exitDate,
          breaks:            parsedBreaks,
          totalBreakTime,
          totalOfficeTime,
          productiveTime,
          requiredWorkHours,
          notes:             notes || "",
        },
      },
      {
        upsert:    true,
        new:       true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Work log saved successfully",
      data:    workLog,
    });

  } catch (error: any) {
    console.error("SAVE WORK LOG ERROR:", error);

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