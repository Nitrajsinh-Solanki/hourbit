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

function toUTCHHMM(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// 👉 toggle: toUTCHHMM | toISTHHMM
const toDisplayHHMM = toUTCHHMM;

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

// ---------- PROPER CALENDAR WEEK BUILDER ----------
// Weeks are Mon–Fri calendar weeks.
// Week 1 starts on day 1 of the month and ends on the nearest Friday (or last day of month).
// Each subsequent week starts on the next Monday after the previous week's Friday.
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildCalendarWeeks(
  dailyData: any[],
  year: number,
  month: number
): {
  weekNum: number;
  days: any[];
  totalProductiveH: number;
  totalRequiredH: number;
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
  label: string;
}[] {
  const weeks: ReturnType<typeof buildCalendarWeeks> = [];
  const daysInMonth = dailyData.length;
  const pad2 = (n: number) => String(n).padStart(2, "0");

  let weekStart = 1;
  let weekNum   = 1;

  while (weekStart <= daysInMonth) {
    // Determine the day-of-week for weekStart (0=Sun,1=Mon,...,6=Sat)
    const startDow = new Date(year, month - 1, weekStart).getDay();

    // Days until Friday from weekStart (inclusive):
    // If already Friday (5), daysToFri=0. If Saturday(6) or Sunday(0), we skip to next Monday instead.
    const daysToFri = (5 - startDow + 7) % 7;
    const weekEnd   = Math.min(weekStart + daysToFri, daysInMonth);

    const weekDays = dailyData.filter((d: any) => d.day >= weekStart && d.day <= weekEnd);

    const wReq = weekDays.reduce((a: number, d: any) => {
      if (d.isFuture || d.isHoliday) return a;
      if (d.isWeekend && !d.hasEntry) return a;
      return a + d.requiredH;
    }, 0);

    const wProd = weekDays.reduce((a: number, d: any) => a + d.productiveH, 0);

    const monthShort = MONTHS_SHORT[month - 1];
    const startDateStr = `${weekStart} ${monthShort}`;
    const endDateStr   = `${weekEnd} ${monthShort}`;

    weeks.push({
      weekNum,
      days:             weekDays,
      totalProductiveH: Math.round(wProd * 100) / 100,
      totalRequiredH:   Math.round(wReq  * 100) / 100,
      startDay:  weekStart,
      endDay:    weekEnd,
      startDate: startDateStr,
      endDate:   endDateStr,
      label:     `${startDateStr} – ${endDateStr}`,
    });

    // Next week starts the following Monday after weekEnd
    const endDow    = new Date(year, month - 1, weekEnd).getDay();
    // Days until the next Monday (1)
    const daysToMon = (8 - endDow) % 7 || 7;
    weekStart       = weekEnd + daysToMon;
    weekNum++;

    if (weekStart > daysInMonth) break;
  }

  return weeks;
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
      const log       = logByDay[day];

      // ─── TODAY RULE ────────────────────────────────────────────────────────
      // Today is included in analysis ONLY when BOTH entryTime AND exitTime
      // are saved. Otherwise treat it identically to a future date so it is
      // excluded from every total, average, streak and KPI calculation.
      const isToday          = key === todayKey;
      const todayFullyLogged = isToday && !!(log && !log.isHoliday && log.entryTime && log.exitTime);
      const isFuture         = key > todayKey || (isToday && !todayFullyLogged);
      // ──────────────────────────────────────────────────────────────────────

      let requiredH: number;
      if (log) {
        requiredH = (log as any).requiredWorkHoursOverride != null
          ? (log as any).requiredWorkHoursOverride
          : (log.requiredWorkHours ?? userDefaultHours);
      } else {
        requiredH = userDefaultHours;
      }

      // Only expose productive/office/break data if the day is not excluded
      const countable = !isFuture && !!(log && !log.isHoliday);

      return {
        day,
        dow,
        isWeekend,
        isFuture,
        isToday,
        isHoliday:   log?.isHoliday ?? false,
        // hasEntry: true only when the day is counted (not excluded) and has an entry
        hasEntry:    !!(log && !log.isHoliday && log.entryTime && !isFuture),
        productiveH: countable ? toH(log.productiveTime   ?? 0) : 0,
        officeH:     countable ? toH(log.totalOfficeTime  ?? 0) : 0,
        breakH:      countable ? toH(log.totalBreakTime   ?? 0) : 0,
        requiredH,

        // Raw ISO (kept for debugging / heatmap tooltip)
        entryTime: log?.entryTime ? new Date(log.entryTime).toISOString() : null,
        exitTime:  log?.exitTime  ? new Date(log.exitTime).toISOString()  : null,

        // Display HH:mm — null when day is excluded so table shows "—"
        entryTimeLocal: !isFuture ? toDisplayHHMM(log?.entryTime) : null,
        exitTimeLocal:  !isFuture ? toDisplayHHMM(log?.exitTime)  : null,

        notes:  log?.notes  ?? "",
        breaks: log?.breaks ?? [],
      };
    });

    // ─── All aggregations naturally exclude today unless fully logged ───────

    const holidayDays = dailyData.filter(d => d.isHoliday);
    const weekendDays = dailyData.filter(d => d.isWeekend && !d.isFuture && !d.isHoliday);
    const stdWorkDays = dailyData.filter(d => !d.isWeekend && !d.isFuture && !d.isHoliday);
    const loggedDays  = dailyData.filter(d => d.hasEntry && !d.isFuture);
    const missingDays = stdWorkDays.filter(d => !d.hasEntry);

    // totalRequiredH: only past weekdays + logged weekends (today excluded unless fully logged)
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

    // ─── Build proper calendar weeks (Mon–Fri) ─────────────────────────────
    const weeks = buildCalendarWeeks(dailyData, year, month);

    // Entry/exit timing — only fully-counted days
    const entryMins: number[] = [];
    const exitMins:  number[] = [];
    for (const d of loggedDays) {
      const e = hhmmToMins(d.entryTimeLocal);
      const x = hhmmToMins(d.exitTimeLocal);
      if (e !== null) entryMins.push(e);
      if (x !== null) exitMins.push(x);
    }
    const avgArr = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;

    // Break breakdown — skip today's log if not fully logged
    let teaC = 0, lunchC = 0, customC = 0;
    let teaS = 0, lunchS = 0, customS = 0;
    let longestBreakSecs = 0, maxBreaksInDay = 0;

    for (const log of logs) {
      if ((log as any).isHoliday) continue;
      const logParts = toISTDateParts((log as any).date);
      if (logParts) {
        const logKey = `${logParts.year}-${String(logParts.month).padStart(2,"0")}-${String(logParts.day).padStart(2,"0")}`;
        // Skip today unless both entry AND exit exist
        if (logKey === todayKey && !((log as any).entryTime && (log as any).exitTime)) continue;
      }
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
    const bestDay  = sorted[0]                 ?? null;
    const worstDay = sorted[sorted.length - 1] ?? null;

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
        totalLoggedDays:  loggedDays.length,
        totalWorkDays,
        totalMissingDays: missingDays.length,
        totalHolidays:    holidayDays.length,
        totalWeekends:    weekendDays.length,
        totalProductiveH, totalOfficeH, totalBreakH, totalRequiredH,
        overtimeH, underworkH, consistencyScore,

        // Proper calendar weeks — each with startDay, endDay, label, date range
        weeks,

        avgEntryTime:  minsToHHMM(avgArr(entryMins)),
        avgExitTime:   minsToHHMM(avgArr(exitMins)),
        earliestEntry: minsToHHMM(entryMins.length ? Math.min(...entryMins) : null),
        latestExit:    minsToHHMM(exitMins.length  ? Math.max(...exitMins)  : null),

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