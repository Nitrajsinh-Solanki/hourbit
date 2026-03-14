// app/api/work/analysis/route.ts

import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import jwt              from "jsonwebtoken";
import { connectDB }    from "@/app/lib/mongodb";
import WorkLog          from "@/app/models/WorkLog";
import User             from "@/app/models/User";

// GET /api/work/analysis?year=YYYY&month=M
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
    const month = parseInt(searchParams.get("month") ?? "");

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Provide valid year and month (1-12)" },
        { status: 400 }
      );
    }

    await connectDB();

    // Fetch user profile default hours
    const user = await User.findById(decoded.userId).select("defaultWorkHours").lean();
    const userDefaultHours: number = (user as any)?.defaultWorkHours ?? 8.5;

    const from     = new Date(Date.UTC(year, month - 1, 1));
    const to       = new Date(Date.UTC(year, month,     1));
    const prevYear = month === 1 ? year - 1 : year;
    const prevMon  = month === 1 ? 12 : month - 1;
    const prevFrom = new Date(Date.UTC(prevYear, prevMon - 1, 1));
    const prevTo   = new Date(Date.UTC(prevYear, prevMon,     1));

    const [logs, prevLogs] = await Promise.all([
      WorkLog.find({ userId: decoded.userId, date: { $gte: from, $lt: to } }).lean(),
      WorkLog.find({ userId: decoded.userId, date: { $gte: prevFrom, $lt: prevTo } }).lean(),
    ]);

    const toH = (s: number) => Math.round((s / 3600) * 100) / 100;

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today       = new Date();
    const todayUTC    = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const logByDay: Record<number, any> = {};
    for (const log of logs) {
      logByDay[(log.date as Date).getUTCDate()] = log;
    }

    // ── Per-day array ────────────────────────────────────────────
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day       = i + 1;
      const date      = new Date(Date.UTC(year, month - 1, day));
      const dow       = date.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isFuture  = date > todayUTC;
      const log       = logByDay[day];

      // ── Effective required hours for this day ─────────────────
      // Priority: log.requiredWorkHoursOverride > log.requiredWorkHours > userDefaultHours
      // requiredWorkHoursOverride is the explicit per-day value the user set.
      // requiredWorkHours is the effective value already stored on the log (includes fallback).
      // If no log exists, use the profile default.
      let requiredH: number;
      if (log) {
        requiredH = (log as any).requiredWorkHoursOverride != null
          ? (log as any).requiredWorkHoursOverride
          : (log.requiredWorkHours ?? userDefaultHours);
      } else {
        requiredH = userDefaultHours;
      }

      return {
        day,
        dow,
        isWeekend,
        isFuture,
        isHoliday:   log?.isHoliday ?? false,
        hasEntry:    !!(log && !log.isHoliday && log.entryTime),
        productiveH: log && !log.isHoliday ? toH(log.productiveTime  ?? 0) : 0,
        officeH:     log && !log.isHoliday ? toH(log.totalOfficeTime ?? 0) : 0,
        breakH:      log && !log.isHoliday ? toH(log.totalBreakTime  ?? 0) : 0,
        // Per-day effective required hours (may vary day to day)
        requiredH,
        entryTime:   log?.entryTime ? (log.entryTime as Date).toISOString() : null,
        exitTime:    log?.exitTime  ? (log.exitTime  as Date).toISOString() : null,
        notes:       log?.notes ?? "",
        breaks:      log?.breaks ?? [],
      };
    });

    // ── Classify days ────────────────────────────────────────────
    const holidayDays = dailyData.filter(d => d.isHoliday);
    const weekendDays = dailyData.filter(d => d.isWeekend && !d.isFuture && !d.isHoliday);
    const stdWorkDays = dailyData.filter(d => !d.isWeekend && !d.isFuture && !d.isHoliday);
    const loggedDays  = dailyData.filter(d => d.hasEntry);
    const missingDays = stdWorkDays.filter(d => !d.hasEntry);

    // ── Total Required Hours ─────────────────────────────────────
    // Each day uses its own per-day requiredH (override or profile default).
    // Weekdays always counted; weekends only if user logged that day; holidays/future excluded.
    let totalRequiredH = 0;
    for (const d of dailyData) {
      if (d.isFuture || d.isHoliday) continue;
      if (d.isWeekend) {
        if (d.hasEntry) totalRequiredH += d.requiredH;
      } else {
        totalRequiredH += d.requiredH;
      }
    }
    totalRequiredH = Math.round(totalRequiredH * 100) / 100;

    // ── Totals ───────────────────────────────────────────────────
    const totalProductiveH = Math.round(loggedDays.reduce((a, d) => a + d.productiveH, 0) * 100) / 100;
    const totalOfficeH     = Math.round(loggedDays.reduce((a, d) => a + d.officeH,     0) * 100) / 100;
    const totalBreakH      = Math.round(loggedDays.reduce((a, d) => a + d.breakH,      0) * 100) / 100;
    const overtimeH        = Math.round(Math.max(0, totalProductiveH - totalRequiredH) * 100) / 100;
    const underworkH       = Math.round(Math.max(0, totalRequiredH - totalProductiveH) * 100) / 100;
    const consistencyScore = totalRequiredH > 0
      ? Math.min(100, Math.round((totalProductiveH / totalRequiredH) * 100))
      : 0;

    const totalWorkDays = stdWorkDays.length + weekendDays.filter(d => d.hasEntry).length;

    // ── Weekly breakdown ─────────────────────────────────────────
    const weeks: {
      weekNum:          number;
      days:             typeof dailyData;
      totalProductiveH: number;
      totalRequiredH:   number;
    }[] = [];

    for (let i = 0; i < dailyData.length; i += 7) {
      const slice = dailyData.slice(i, i + 7);
      const wReq  = slice.reduce((a, d) => {
        if (d.isFuture || d.isHoliday) return a;
        if (d.isWeekend && !d.hasEntry) return a;
        return a + d.requiredH;
      }, 0);
      weeks.push({
        weekNum:          weeks.length + 1,
        days:             slice,
        totalProductiveH: Math.round(slice.reduce((a, d) => a + d.productiveH, 0) * 100) / 100,
        totalRequiredH:   Math.round(wReq * 100) / 100,
      });
    }

    // ── Entry/Exit patterns ──────────────────────────────────────
    const entryMins: number[] = [];
    const exitMins:  number[] = [];
    for (const d of loggedDays) {
      if (d.entryTime) { const t = new Date(d.entryTime); entryMins.push(t.getUTCHours() * 60 + t.getUTCMinutes()); }
      if (d.exitTime)  { const t = new Date(d.exitTime);  exitMins.push(t.getUTCHours()  * 60 + t.getUTCMinutes()); }
    }
    const avgArr = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    const fmtMin = (m: number | null) => m === null ? null
      : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    // ── Break analysis ───────────────────────────────────────────
    let teaC = 0, lunchC = 0, customC = 0;
    let teaS = 0, lunchS = 0, customS = 0;
    let longestBreakSecs = 0, maxBreaksInDay = 0;

    for (const log of logs) {
      if ((log as any).isHoliday) continue;
      const breaks = (log as any).breaks ?? [];
      if (breaks.length > maxBreaksInDay) maxBreaksInDay = breaks.length;
      for (const b of breaks) {
        const dur = b.duration ?? 0;
        if      (b.type === "tea")   { teaC++;    teaS   += dur; }
        else if (b.type === "lunch") { lunchC++;  lunchS += dur; }
        else                         { customC++; customS += dur; }
        if (dur > longestBreakSecs) longestBreakSecs = dur;
      }
    }
    const totalBreakCount = teaC + lunchC + customC;
    const avgBreakSecs    = totalBreakCount > 0
      ? Math.round((teaS + lunchS + customS) / totalBreakCount) : 0;

    // ── Best / Worst ─────────────────────────────────────────────
    const sorted   = [...loggedDays].sort((a, b) => b.productiveH - a.productiveH);
    const bestDay  = sorted[0]                 ?? null;
    const worstDay = sorted[sorted.length - 1] ?? null;

    // ── Streaks ──────────────────────────────────────────────────
    let currentStreak = 0; let streakBroken = false;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      const d = dailyData[i];
      if (d.isFuture || d.isHoliday) continue;
      if (d.isWeekend && !d.hasEntry) continue;
      if (d.hasEntry && !streakBroken) currentStreak++;
      else streakBroken = true;
    }
    let lTemp = 0, longestStreak = 0;
    for (const d of dailyData) {
      if (d.isFuture || d.isHoliday) continue;
      if (d.isWeekend && !d.hasEntry) continue;
      if (d.hasEntry) { lTemp++; if (lTemp > longestStreak) longestStreak = lTemp; }
      else lTemp = 0;
    }

    // ── Prev month ───────────────────────────────────────────────
    const prevLogged      = prevLogs.filter((l: any) => !l.isHoliday && l.entryTime);
    const prevProductiveH = Math.round(
      prevLogged.reduce((a: number, l: any) => a + toH(l.productiveTime ?? 0), 0) * 100
    ) / 100;

    return NextResponse.json({
      success: true,
      data: {
        year, month, daysInMonth,
        dailyData,
        totalLoggedDays:  loggedDays.length,
        totalWorkDays,
        totalMissingDays: missingDays.length,
        totalHolidays:    holidayDays.length,
        totalWeekends:    weekendDays.length,
        totalProductiveH,
        totalOfficeH,
        totalBreakH,
        totalRequiredH,
        overtimeH,
        underworkH,
        consistencyScore,
        weeks,
        avgEntryTime:    fmtMin(avgArr(entryMins)),
        avgExitTime:     fmtMin(avgArr(exitMins)),
        earliestEntry:   fmtMin(entryMins.length ? Math.min(...entryMins) : null),
        latestExit:      fmtMin(exitMins.length  ? Math.max(...exitMins)  : null),
        breakBreakdown: {
          tea:    { count: teaC,    totalH: toH(teaS)    },
          lunch:  { count: lunchC,  totalH: toH(lunchS)  },
          custom: { count: customC, totalH: toH(customS) },
        },
        longestBreakMins: Math.round(longestBreakSecs / 60),
        maxBreaksInDay,
        avgBreakMins:     Math.round(avgBreakSecs / 60),
        bestDay:  bestDay  ? { day: bestDay.day,  productiveH: bestDay.productiveH  } : null,
        worstDay: worstDay ? { day: worstDay.day, productiveH: worstDay.productiveH } : null,
        currentStreak,
        longestStreak,
        prevMonth: {
          year:        prevYear,
          month:       prevMon,
          loggedDays:  prevLogged.length,
          productiveH: prevProductiveH,
        },
      },
    });

  } catch (error: any) {
    console.error("ANALYSIS ERROR:", error);
    if (error.name === "JsonWebTokenError") {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}