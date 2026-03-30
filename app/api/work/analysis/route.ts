// app/api/work/analysis/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/app/lib/mongodb";
import WorkLog from "@/app/models/WorkLog";
import User from "@/app/models/User";

// GET /api/work/analysis?year=YYYY&month=M

const IST_TIMEZONE = "Asia/Kolkata";

// ---------- TIME HELPERS ----------

/**
 * Convert a Date/string to IST and return { year, month, day } parts.
 * Used for bucketing logs into the correct IST calendar day.
 */
function toISTDateParts(dateInput: Date | string | null | undefined) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  return {
    year:  Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day:   Number(parts.find(p => p.type === "day")?.value),
  };
}

/**
 * TIME DISPLAY FUNCTION
 *
 * ⚠️  IMPORTANT — read this if times look wrong in the Analysis page:
 *
 * How entryTime/exitTime are stored in MongoDB determines which function to use:
 *
 * Case A — times stored CORRECTLY as UTC:
 *   User picks 9:00 PM IST → frontend does new Date() with local time
 *   → stored as 15:30 UTC (IST minus 5:30)
 *   → use toISTHHMM() below  (converts UTC back to IST)
 *
 * Case B — times stored as LOCAL wall-clock in UTC (common Next.js mistake):
 *   User picks 9:00 PM → frontend does new Date(`...T21:00:00.000Z`)
 *   → stored as 21:00 UTC  (no offset subtracted)
 *   → use toUTCHHMM() below  (reads UTC hours directly, no conversion)
 *
 * If Analysis shows times ~5h 30m LATER than Today's Track → you're in Case B.
 * Switch the two lines at the bottom of this block.
 */
function toISTHHMM(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hh = parts.find(p => p.type === "hour")?.value   ?? "00";
  const mm = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}

/** Reads UTC hours directly — use when times are stored as local-time-in-UTC (Case B). */
function toUTCHHMM(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * 👉 CHANGE THIS if times look wrong.
 *    If Analysis times are ~5h 30m ahead of Today's Track → switch to toUTCHHMM
 *    If they match → keep toISTHHMM
 */
const toDisplayHHMM = toUTCHHMM;   // ← toggle: toUTCHHMM  |  toISTHHMM

// ----------

function hhmmToMins(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minsToHHMM(mins: number | null): string | null {
  if (mins === null || Number.isNaN(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
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

    const user = await User.findById(decoded.userId)
      .select("defaultWorkHours")
      .lean();

    const userDefaultHours: number = (user as any)?.defaultWorkHours ?? 8.5;

    // Wide UTC window to safely capture IST month edges
    const from = new Date(Date.UTC(year, month - 1, 1, -6, 0, 0));
    const to   = new Date(Date.UTC(year, month,     1,  6, 0, 0));

    const prevYear = month === 1 ? year - 1 : year;
    const prevMon  = month === 1 ? 12 : month - 1;
    const prevFrom = new Date(Date.UTC(prevYear, prevMon - 1, 1, -6, 0, 0));
    const prevTo   = new Date(Date.UTC(prevYear, prevMon,     1,  6, 0, 0));

    const [logsRaw, prevLogsRaw] = await Promise.all([
      WorkLog.find({ userId: decoded.userId, date: { $gte: from, $lt: to } }).lean(),
      WorkLog.find({ userId: decoded.userId, date: { $gte: prevFrom, $lt: prevTo } }).lean(),
    ]);

    // Filter by IST calendar month
    const logs     = logsRaw.filter((log: any) => { const p = toISTDateParts(log.date); return p && p.year === year     && p.month === month;   });
    const prevLogs = prevLogsRaw.filter((log: any) => { const p = toISTDateParts(log.date); return p && p.year === prevYear && p.month === prevMon; });

    const toH = (s: number) => Math.round((s / 3600) * 100) / 100;

    const daysInMonth = new Date(year, month, 0).getDate();
    const nowIST      = toISTDateParts(new Date())!;
    const todayKey    = `${nowIST.year}-${String(nowIST.month).padStart(2,"0")}-${String(nowIST.day).padStart(2,"0")}`;

    // Index logs by IST day
    const logByDay: Record<number, any> = {};
    for (const log of logs) {
      const p = toISTDateParts(log.date);
      if (p) logByDay[p.day] = log;
    }

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day       = i + 1;
      const dateLocal = new Date(year, month - 1, day);
      const dow       = dateLocal.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const key       = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const isFuture  = key > todayKey;
      const log       = logByDay[day];

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
        isHoliday:  log?.isHoliday ?? false,
        hasEntry:   !!(log && !log.isHoliday && log.entryTime),
        productiveH: log && !log.isHoliday ? toH(log.productiveTime   ?? 0) : 0,
        officeH:     log && !log.isHoliday ? toH(log.totalOfficeTime  ?? 0) : 0,
        breakH:      log && !log.isHoliday ? toH(log.totalBreakTime   ?? 0) : 0,
        requiredH,

        // Raw ISO (kept for debugging)
        entryTime: log?.entryTime ? new Date(log.entryTime).toISOString() : null,
        exitTime:  log?.exitTime  ? new Date(log.exitTime).toISOString()  : null,

        // Display-ready HH:mm — consistent with how Today's Track shows times
        entryTimeLocal: toDisplayHHMM(log?.entryTime),
        exitTimeLocal:  toDisplayHHMM(log?.exitTime),

        notes:  log?.notes  ?? "",
        breaks: log?.breaks ?? [],
      };
    });

    const holidayDays  = dailyData.filter(d => d.isHoliday);
    const weekendDays  = dailyData.filter(d => d.isWeekend && !d.isFuture && !d.isHoliday);
    const stdWorkDays  = dailyData.filter(d => !d.isWeekend && !d.isFuture && !d.isHoliday);
    const loggedDays   = dailyData.filter(d => d.hasEntry);
    const missingDays  = stdWorkDays.filter(d => !d.hasEntry);

    let totalRequiredH = 0;
    for (const d of dailyData) {
      if (d.isFuture || d.isHoliday) continue;
      if (d.isWeekend) { if (d.hasEntry) totalRequiredH += d.requiredH; }
      else totalRequiredH += d.requiredH;
    }
    totalRequiredH = Math.round(totalRequiredH * 100) / 100;

    const totalProductiveH = Math.round(loggedDays.reduce((a, d) => a + d.productiveH, 0) * 100) / 100;
    const totalOfficeH     = Math.round(loggedDays.reduce((a, d) => a + d.officeH,     0) * 100) / 100;
    const totalBreakH      = Math.round(loggedDays.reduce((a, d) => a + d.breakH,      0) * 100) / 100;
    const overtimeH        = Math.round(Math.max(0, totalProductiveH - totalRequiredH) * 100) / 100;
    const underworkH       = Math.round(Math.max(0, totalRequiredH - totalProductiveH) * 100) / 100;

    const consistencyScore = totalRequiredH > 0
      ? Math.min(100, Math.round((totalProductiveH / totalRequiredH) * 100))
      : 0;

    const totalWorkDays = stdWorkDays.length + weekendDays.filter(d => d.hasEntry).length;

    // Weekly breakdown
    const weeks: { weekNum: number; days: typeof dailyData; totalProductiveH: number; totalRequiredH: number }[] = [];
    for (let i = 0; i < dailyData.length; i += 7) {
      const slice = dailyData.slice(i, i + 7);
      const wReq  = slice.reduce((a, d) => {
        if (d.isFuture || d.isHoliday) return a;
        if (d.isWeekend && !d.hasEntry) return a;
        return a + d.requiredH;
      }, 0);
      weeks.push({
        weekNum:        weeks.length + 1,
        days:           slice,
        totalProductiveH: Math.round(slice.reduce((a, d) => a + d.productiveH, 0) * 100) / 100,
        totalRequiredH:   Math.round(wReq * 100) / 100,
      });
    }

    // Entry/exit pattern analysis — use same display function for consistency
    const entryMins: number[] = [];
    const exitMins:  number[] = [];
    for (const d of loggedDays) {
      const e = hhmmToMins(d.entryTimeLocal);
      const x = hhmmToMins(d.exitTimeLocal);
      if (e !== null) entryMins.push(e);
      if (x !== null) exitMins.push(x);
    }
    const avgArr = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

    // Break breakdown
    let teaC = 0, lunchC = 0, customC = 0;
    let teaS = 0, lunchS = 0, customS = 0;
    let longestBreakSecs = 0, maxBreaksInDay = 0;

    for (const log of logs) {
      if ((log as any).isHoliday) continue;
      const breaks = (log as any).breaks ?? [];
      if (breaks.length > maxBreaksInDay) maxBreaksInDay = breaks.length;
      for (const b of breaks) {
        const dur = b.duration ?? 0;
        if (b.type === "tea")        { teaC++;    teaS    += dur; }
        else if (b.type === "lunch") { lunchC++;  lunchS  += dur; }
        else                         { customC++; customS += dur; }
        if (dur > longestBreakSecs) longestBreakSecs = dur;
      }
    }

    const totalBreakCount = teaC + lunchC + customC;
    const avgBreakSecs    = totalBreakCount > 0
      ? Math.round((teaS + lunchS + customS) / totalBreakCount)
      : 0;

    // Best / worst day
    const sorted   = [...loggedDays].sort((a, b) => b.productiveH - a.productiveH);
    const bestDay  = sorted[0]                    ?? null;
    const worstDay = sorted[sorted.length - 1]    ?? null;

    // Streak calculation
    let currentStreak = 0, streakBroken = false;
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

    // Prev month summary
    const prevLogged      = prevLogs.filter((l: any) => !l.isHoliday && l.entryTime);
    const prevProductiveH = Math.round(
      prevLogged.reduce((a: number, l: any) => a + toH(l.productiveTime ?? 0), 0) * 100
    ) / 100;

    return NextResponse.json({
      success: true,
      data: {
        year, month, daysInMonth, dailyData,
        totalLoggedDays: loggedDays.length,
        totalWorkDays,
        totalMissingDays: missingDays.length,
        totalHolidays: holidayDays.length,
        totalWeekends: weekendDays.length,
        totalProductiveH, totalOfficeH, totalBreakH, totalRequiredH,
        overtimeH, underworkH, consistencyScore,
        weeks,

        avgEntryTime:   minsToHHMM(avgArr(entryMins)),
        avgExitTime:    minsToHHMM(avgArr(exitMins)),
        earliestEntry:  minsToHHMM(entryMins.length ? Math.min(...entryMins) : null),
        latestExit:     minsToHHMM(exitMins.length  ? Math.max(...exitMins)  : null),

        breakBreakdown: {
          tea:    { count: teaC,    totalH: toH(teaS)    },
          lunch:  { count: lunchC,  totalH: toH(lunchS)  },
          custom: { count: customC, totalH: toH(customS) },
        },
        longestBreakMins: Math.round(longestBreakSecs / 60),
        maxBreaksInDay,
        avgBreakMins: Math.round(avgBreakSecs / 60),

        bestDay:  bestDay  ? { day: bestDay.day,  productiveH: bestDay.productiveH  } : null,
        worstDay: worstDay ? { day: worstDay.day, productiveH: worstDay.productiveH } : null,

        currentStreak, longestStreak,

        prevMonth: {
          year: prevYear, month: prevMon,
          loggedDays: prevLogged.length,
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