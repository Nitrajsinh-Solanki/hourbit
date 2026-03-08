// app/api/work/logged-dates/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";

// GET /api/work/logged-dates?year=2025&month=5   (month is 1-indexed)
// Returns { success: true, days: [1, 3, 7, ...] }  — day numbers that have an entry
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const { searchParams } = new URL(req.url);
    const year  = parseInt(searchParams.get("year")  ?? "");
    const month = parseInt(searchParams.get("month") ?? ""); // 1-indexed

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Provide valid year and month (1-12)" },
        { status: 400 }
      );
    }

    // Midnight UTC range: first day of month → first day of next month (exclusive)
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to   = new Date(Date.UTC(year, month,     1));

    await connectDB();

    const logs = await WorkLog.find({
      userId: decoded.userId,
      date:   { $gte: from, $lt: to },
    }).select("date").lean();

    // Extract UTC day numbers
    const days: number[] = logs.map((l) => (l.date as Date).getUTCDate());

    return NextResponse.json({ success: true, days });

  } catch (error: any) {
    console.error("GET LOGGED DATES ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}