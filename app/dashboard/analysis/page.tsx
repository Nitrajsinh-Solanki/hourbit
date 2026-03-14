// app/dashboard/analysis/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  BarChart2, TrendingUp, TrendingDown, Clock, Coffee, Zap,
  CalendarDays, ChevronLeft, ChevronRight, Award, Flame,
  AlertCircle, CheckCircle2, RefreshCw, LogIn, LogOut,
  Target, Activity, BookCheck, Settings2, Filter,
  ArrowUpDown, ChevronDown, BrainCircuit,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
interface DayData {
  day: number;
  dow: number;
  isWeekend: boolean;
  isFuture: boolean;
  isHoliday: boolean;
  hasEntry: boolean;
  productiveH: number;
  officeH: number;
  breakH: number;
  requiredH: number;
  entryTime: string | null;
  exitTime: string | null;
  notes: string;
  breaks: { type: string; duration: number }[];
}

interface AnalysisData {
  year: number;
  month: number;
  daysInMonth: number;
  dailyData: DayData[];
  totalLoggedDays: number;
  totalWorkDays: number;
  totalMissingDays: number;
  totalHolidays: number;
  totalWeekends: number;
  totalProductiveH: number;
  totalOfficeH: number;
  totalBreakH: number;
  totalRequiredH: number;
  overtimeH: number;
  underworkH: number;
  consistencyScore: number;
  weeks: { weekNum: number; totalProductiveH: number; totalRequiredH: number; days: DayData[] }[];
  avgEntryTime: string | null;
  avgExitTime: string | null;
  earliestEntry: string | null;
  latestExit: string | null;
  breakBreakdown: {
    tea: { count: number; totalH: number };
    lunch: { count: number; totalH: number };
    custom: { count: number; totalH: number };
  };
  longestBreakMins: number;
  maxBreaksInDay: number;
  avgBreakMins: number;
  bestDay: { day: number; productiveH: number } | null;
  worstDay: { day: number; productiveH: number } | null;
  currentStreak: number;
  longestStreak: number;
  prevMonth: { year: number; month: number; loggedDays: number; productiveH: number };
}

type SortKey = "day" | "productiveH" | "officeH" | "breakH" | "entryTime" | "exitTime";
type SortDir = "asc" | "desc";
type WeekFilter = "all" | "week1" | "week2" | "week3" | "week4";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtH(h: number): string {
  if (h <= 0) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function fmtHLabel(h: number): string {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function to12h(hhmm: string | null): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  return `${pad2(h % 12 || 12)}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
}

function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getScoreMeta(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: "Excellent",         color: "#22d3a0", emoji: "🏆" };
  if (score >= 75) return { label: "Good",              color: "#7c6ef3", emoji: "✨" };
  if (score >= 60) return { label: "Needs Improvement", color: "#fbbf24", emoji: "📈" };
  return               { label: "Poor",                color: "#f87171", emoji: "⚠️" };
}

function timeToMinutes(hhmm: string | null): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function weekOf(day: number): 1 | 2 | 3 | 4 {
  if (day <= 7)  return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

// ─────────────────────────────────────────────────────────────────
// SMART INSIGHTS ENGINE
// ─────────────────────────────────────────────────────────────────
function generateInsights(data: AnalysisData): { type: "positive" | "warning" | "info"; text: string }[] {
  const out: { type: "positive" | "warning" | "info"; text: string }[] = [];

  const attendanceRate = data.totalWorkDays > 0
    ? Math.round((data.totalLoggedDays / data.totalWorkDays) * 100) : 0;

  if (attendanceRate < 70 && data.totalWorkDays > 0)
    out.push({ type: "warning", text: `Attendance at ${attendanceRate}% — ${data.totalMissingDays} unlogged work days this month. Consider building a daily check-in habit.` });
  else if (attendanceRate === 100)
    out.push({ type: "positive", text: `Perfect attendance! You logged every work day this month. Keep the streak alive.` });

  if (data.overtimeH > 5)
    out.push({ type: "warning", text: `${fmtH(data.overtimeH)} of overtime recorded — great dedication, but watch for burnout. Schedule recovery time.` });
  else if (data.overtimeH > 0)
    out.push({ type: "positive", text: `${fmtH(data.overtimeH)} overtime this month — slightly above target. Well balanced.` });
  else if (data.underworkH > 10)
    out.push({ type: "warning", text: `${fmtH(data.underworkH)} short of required hours. Identify which weeks dragged and plan ahead.` });

  if (data.avgBreakMins > 90)
    out.push({ type: "warning", text: `Average break time is ${data.avgBreakMins}m — above healthy limits. Try to keep total breaks under 60–75 minutes.` });
  else if (data.avgBreakMins < 15 && data.totalLoggedDays > 5)
    out.push({ type: "warning", text: `Very short breaks detected (avg ${data.avgBreakMins}m). Regular breaks improve focus — aim for at least 30–45 mins/day.` });

  if (data.earliestEntry && data.avgEntryTime) {
    const spread = timeToMinutes(data.avgEntryTime) - timeToMinutes(data.earliestEntry);
    if (spread > 90)
      out.push({ type: "info", text: `High entry-time variance — earliest at ${to12h(data.earliestEntry)}, avg at ${to12h(data.avgEntryTime)}. More consistent starts improve daily structure.` });
  }

  if (data.consistencyScore >= 90)
    out.push({ type: "positive", text: `${data.consistencyScore}% consistency score — you're hitting your targets reliably. Excellent work ethic.` });
  else if (data.consistencyScore < 60 && data.totalLoggedDays > 0)
    out.push({ type: "warning", text: `Consistency score of ${data.consistencyScore}% signals frequent target misses. Break the month into weekly mini-goals.` });

  if (data.currentStreak >= 5)
    out.push({ type: "positive", text: `${data.currentStreak}-day active streak! You're on a roll — momentum is building.` });

  if (data.bestDay && data.worstDay) {
    const spread = data.bestDay.productiveH - data.worstDay.productiveH;
    if (spread > 4)
      out.push({ type: "info", text: `${fmtH(spread)} spread between best (${ordinal(data.bestDay.day)}) and worst (${ordinal(data.worstDay.day)}) day — high variance. Identify what made the best day special.` });
  }

  return out.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────
// BASE COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Card({ children, className = "", glow = false }: {
  children: React.ReactNode; className?: string; glow?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: glow ? "0 0 40px rgba(124,110,243,0.07)" : "none",
      }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, iconColor, title, subtitle, badge }: {
  icon: React.ElementType; iconColor: string; title: string; subtitle?: string; badge?: string;
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `${iconColor}20` }}>
          <Icon size={12} style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="font-syne font-semibold text-[14px]" style={{ color: "var(--text)" }}>{title}</h2>
          {subtitle && <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
          style={{ background: "rgba(124,110,243,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,243,0.25)" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color, height = 6 }: {
  value: number; max: number; color: string; height?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "var(--border)" }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatCard({ label, value, sub, color, icon: Icon, bg, delta }: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ElementType; bg: string;
  delta?: { val: number; label: string };
}) {
  const [hov, setHov] = useState(false);
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden transition-all duration-200"
      style={{ background: "var(--surface)", border: `1px solid ${hov ? color + "55" : "var(--border)"}` }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="absolute top-0 right-0 w-14 h-14 rounded-full opacity-[0.06] -translate-y-3 translate-x-3 pointer-events-none"
        style={{ background: color }} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>{label}</span>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p className="font-syne font-extrabold text-[24px] leading-none" style={{ color }}>{value}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {sub && <p className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>{sub}</p>}
        {delta && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-lg shrink-0"
            style={{
              background: delta.val >= 0 ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.12)",
              color: delta.val >= 0 ? "#22d3a0" : "#f87171",
            }}>
            {delta.val >= 0 ? "↑" : "↓"} {Math.abs(delta.val)}% {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SPARKLINE
// ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 22 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${height - (v / max) * height}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// HEATMAP CALENDAR
// ─────────────────────────────────────────────────────────────────
function HeatmapCalendar({ dailyData, year, month, maxH }: {
  dailyData: DayData[]; year: number; month: number; maxH: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  function getCellBg(d: DayData) {
    if (d.isHoliday)      return "rgba(251,191,36,0.35)";
    if (d.isWeekend)      return "var(--border)";
    if (d.isFuture)       return "var(--surface2)";
    if (!d.hasEntry)      return "rgba(248,113,113,0.18)";
    const pct = maxH > 0 ? d.productiveH / maxH : 0;
    if (pct >= 0.9)       return "#7c6ef3";
    if (pct >= 0.7)       return "rgba(124,110,243,0.65)";
    if (pct >= 0.4)       return "rgba(124,110,243,0.38)";
    return "rgba(124,110,243,0.18)";
  }

  const empties = Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />);
  const cells   = dailyData.map(d => {
    const isHov = hovered === d.day;
    return (
      <div key={d.day}
        className="relative rounded-lg flex items-center justify-center cursor-default select-none"
        style={{
          aspectRatio: "1",
          background: getCellBg(d),
          border: isHov ? "1.5px solid var(--accent)" : "1.5px solid transparent",
          transform: isHov ? "scale(1.18)" : "scale(1)",
          transition: "transform 0.15s, border-color 0.15s",
          zIndex: isHov ? 10 : 1,
        }}
        onMouseEnter={() => setHovered(d.day)}
        onMouseLeave={() => setHovered(null)}>
        <span className="font-mono text-[9px]" style={{ color: d.hasEntry && !d.isFuture ? "var(--text2)" : "var(--text4)" }}>
          {d.day}
        </span>
        {isHov && (
          <div className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl whitespace-nowrap pointer-events-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
            <p className="font-mono text-[11px] font-semibold" style={{ color: "var(--text)" }}>
              {d.isHoliday ? "Holiday" : d.isWeekend ? DOW_LABELS[d.dow] : d.hasEntry ? `${fmtH(d.productiveH)} productive` : "Not logged"}
            </p>
            {d.hasEntry && !d.isHoliday && (
              <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>
                {to12h(d.entryTime)} → {to12h(d.exitTime)}
              </p>
            )}
          </div>
        )}
      </div>
    );
  });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} className="text-center">
            <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{[...empties, ...cells]}</div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { color: "#7c6ef3",                   label: "Full day"  },
          { color: "rgba(124,110,243,0.38)",     label: "Partial"  },
          { color: "rgba(248,113,113,0.25)",     label: "Missed"   },
          { color: "rgba(251,191,36,0.35)",      label: "Holiday"  },
          { color: "var(--border)",              label: "Weekend"  },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: color }} />
            <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BAR CHART  (full-month)
// ─────────────────────────────────────────────────────────────────
function BarChart({ data, maxVal, barColor = "#7c6ef3", refColor = "rgba(124,110,243,0.12)",
  showRef = false, height = 120, tooltip }: {
  data: { label: string; value: number; refValue?: number; isFuture?: boolean; isWeekend?: boolean; isHoliday?: boolean }[];
  maxVal: number; barColor?: string; refColor?: string;
  showRef?: boolean; height?: number; tooltip?: (d: any) => string;
}) {
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div className="relative" style={{ height: height + 40 }}>
      {hov !== null && tooltip && (
        <div className="absolute z-10 px-3 py-2 rounded-xl font-mono text-[11px] pointer-events-none"
          style={{
            background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text)",
            top: 0, left: `${Math.min(80, (hov / data.length) * 100)}%`,
            transform: "translateX(-50%)", whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}>
          {tooltip(data[hov])}
        </div>
      )}
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((d, i) => {
          const barH  = maxVal > 0 ? (d.value / maxVal) * height : 0;
          const refH  = maxVal > 0 && d.refValue ? (d.refValue / maxVal) * height : 0;
          const faded = d.isFuture || d.isWeekend;
          const color = d.isHoliday ? "#fbbf24" : d.isFuture ? "var(--border2)" : d.isWeekend ? "var(--border)" : barColor;
          return (
            <div key={i} className="relative flex-1 flex flex-col justify-end cursor-pointer"
              style={{ height, opacity: faded ? 0.3 : 1 }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {showRef && refH > 0 && (
                <div className="absolute bottom-0 left-0 right-0 rounded-sm"
                  style={{ height: refH, background: refColor, zIndex: 0 }} />
              )}
              <div className="relative rounded-t-sm transition-all duration-200"
                style={{
                  height: Math.max(barH, d.value > 0 ? 2 : 0),
                  background: hov === i ? "#a78bfa" : color,
                  zIndex: 1,
                  boxShadow: hov === i ? `0 -4px 10px ${color}50` : "none",
                }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-px mt-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="font-mono text-[9px]" style={{ color: hov === i ? "var(--accent)" : "var(--text4)" }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WEEK DETAIL CHART  (shown when a specific week is selected)
// ─────────────────────────────────────────────────────────────────
function WeekDetailChart({ days }: { days: DayData[] }) {
  const [hov, setHov] = useState<number | null>(null);
  const workDays = days.filter(d => !d.isWeekend && !d.isFuture);
  const maxH     = Math.max(...workDays.map(d => Math.max(d.productiveH, d.requiredH)), 1);

  if (workDays.length === 0)
    return (
      <div className="flex items-center justify-center py-8">
        <p className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>No data for this week</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="relative" style={{ height: 130 }}>
        <div className="flex items-end gap-2 h-full pb-6">
          {workDays.map((d, i) => {
            const barH    = (d.productiveH / maxH) * 104;
            const refH    = (d.requiredH / maxH) * 104;
            const isOver  = d.hasEntry && d.productiveH >= d.requiredH;
            const barColor = d.isHoliday ? "#fbbf24"
                          : !d.hasEntry  ? "rgba(248,113,113,0.25)"
                          : isOver       ? "#22d3a0"
                          : "#7c6ef3";
            return (
              <div key={d.day} className="relative flex-1 flex flex-col justify-end"
                onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
                {/* ghost required bar */}
                <div className="absolute bottom-6 left-0 right-0 rounded-sm"
                  style={{ height: Math.max(refH, 2), background: "rgba(124,110,243,0.12)", zIndex: 0 }} />
                {/* productive bar */}
                <div className="relative rounded-t-sm transition-all duration-300 mb-6"
                  style={{
                    height: Math.max(barH, d.productiveH > 0 ? 3 : 0),
                    background: hov === i ? "#a78bfa" : barColor,
                    zIndex: 1,
                    boxShadow: hov === i ? `0 -4px 12px ${barColor}60` : "none",
                  }} />
                {hov === i && (
                  <div className="absolute z-20 bottom-full mb-1 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl pointer-events-none whitespace-nowrap"
                    style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
                    <p className="font-mono text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                      {d.isHoliday ? "Holiday" : !d.hasEntry ? "Not logged" : `${fmtH(d.productiveH)} productive`}
                    </p>
                    {d.hasEntry && !d.isHoliday && (
                      <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>
                        Target: {fmtH(d.requiredH)} · Break: {fmtH(d.breakH)}
                      </p>
                    )}
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 text-center font-mono text-[10px]"
                  style={{ color: "var(--text4)" }}>
                  {DOW_LABELS[d.dow]?.slice(0, 2) ?? String(d.day)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-day stat rows */}
      <div className="space-y-1.5">
        {workDays.map(d => {
          const isOver   = d.hasEntry && d.productiveH >= d.requiredH;
          const barColor = !d.hasEntry ? "rgba(248,113,113,0.4)" : isOver ? "#22d3a0" : "#7c6ef3";
          return (
            <div key={d.day} className="flex items-center gap-3 py-2 px-3 rounded-xl"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="font-mono text-[11px] w-5 shrink-0 font-semibold" style={{ color: "var(--text3)" }}>{d.day}</span>
              <span className="font-mono text-[10px] w-7 shrink-0" style={{ color: "var(--text4)" }}>
                {DOW_LABELS[d.dow]?.slice(0, 3) ?? ""}
              </span>
              <span className="font-mono text-[10px] w-16 shrink-0" style={{ color: "var(--text3)" }}>
                {to12h(d.entryTime)}
              </span>
              <div className="flex-1">
                <ProgressBar value={d.productiveH} max={d.requiredH} color={barColor} height={5} />
              </div>
              <span className="font-mono text-[11px] w-14 text-right shrink-0" style={{ color: barColor }}>
                {d.hasEntry ? fmtH(d.productiveH) : "—"}
              </span>
              <span className="font-mono text-[10px] w-14 text-right shrink-0" style={{ color: "var(--text4)" }}>
                {d.hasEntry ? `/ ${fmtH(d.requiredH)}` : "missed"}
              </span>
              {d.hasEntry && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: isOver ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.1)",
                    color: isOver ? "#22d3a0" : "#f87171",
                  }}>
                  {isOver
                    ? `+${fmtH(d.productiveH - d.requiredH)}`
                    : `-${fmtH(d.requiredH - d.productiveH)}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0)
    return (
      <div className="flex items-center justify-center h-[96px]">
        <p className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>No break data</p>
      </div>
    );

  let cum = 0;
  const stops = segments.filter(s => s.value > 0).map(s => {
    const pct = (s.value / total) * 100;
    const start = cum; cum += pct;
    return `${s.color} ${start.toFixed(1)}% ${cum.toFixed(1)}%`;
  }).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: 90, height: 90 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${stops})` }} />
        <div className="absolute rounded-full" style={{ inset: "18px", background: "var(--surface)" }} />
      </div>
      <div className="flex flex-col gap-2">
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>{s.label}</span>
            <span className="font-mono text-[11px] ml-1" style={{ color: "var(--text3)" }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WEEK SELECTOR DROPDOWN
// ─────────────────────────────────────────────────────────────────
function WeekSelector({ value, onChange, weeks, daysInMonth }: {
  value: WeekFilter;
  onChange: (v: WeekFilter) => void;
  weeks: AnalysisData["weeks"];
  daysInMonth: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const opts: { key: WeekFilter; label: string; sub: string }[] = [
    { key: "all",   label: "Full Month", sub: "All weeks combined"       },
    { key: "week1", label: "Week 1",     sub: "Days 1 – 7"               },
    { key: "week2", label: "Week 2",     sub: "Days 8 – 14"              },
    { key: "week3", label: "Week 3",     sub: "Days 15 – 21"             },
    { key: "week4", label: "Week 4+",    sub: `Days 22 – ${daysInMonth}` },
  ];

  const current = opts.find(o => o.key === value) ?? opts[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-[12px] cursor-pointer border-none transition-all"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
        <CalendarDays size={12} style={{ color: "var(--accent)" }} />
        <span style={{ color: "var(--text)" }}>{current.label}</span>
        <ChevronDown size={11} style={{
          color: "var(--text3)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
        }} />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 py-1.5 rounded-2xl w-56"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          }}>
          {opts.map(o => {
            const isActive  = o.key === value;
            const weekData  = o.key !== "all" ? weeks.find(w => `week${w.weekNum}` === o.key) : null;
            return (
              <button key={o.key}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-none text-left transition-all"
                style={{ background: isActive ? "rgba(124,110,243,0.1)" : "transparent" }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <div>
                  <p className="font-mono text-[12px] font-semibold" style={{ color: isActive ? "var(--accent)" : "var(--text)" }}>
                    {o.label}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>{o.sub}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {weekData && (
                    <span className="font-mono text-[10px] shrink-0"
                      style={{ color: weekData.totalProductiveH >= weekData.totalRequiredH ? "#22d3a0" : "#f87171" }}>
                      {fmtH(weekData.totalProductiveH)}
                    </span>
                  )}
                  {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DAILY LOG TABLE
// ─────────────────────────────────────────────────────────────────
function DailyLogTable({ dailyData, year, month, weekFilter }: {
  dailyData: DayData[]; year: number; month: number; weekFilter: WeekFilter;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [rowFilter, setRowFilter] = useState<"all" | "logged" | "missed" | "overtime" | "underwork">("all");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const rows = useMemo(() => {
    let r = dailyData.filter(d => !d.isWeekend && !d.isFuture);
    if (weekFilter !== "all") {
      const wn = Number(weekFilter.replace("week", ""));
      r = r.filter(d => weekOf(d.day) === wn);
    }
    if (rowFilter === "logged")    r = r.filter(d => d.hasEntry);
    if (rowFilter === "missed")    r = r.filter(d => !d.hasEntry && !d.isHoliday);
    if (rowFilter === "overtime")  r = r.filter(d => d.hasEntry && d.productiveH > d.requiredH);
    if (rowFilter === "underwork") r = r.filter(d => d.hasEntry && d.productiveH < d.requiredH);
    return [...r].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "day")         { av = a.day; bv = b.day; }
      if (sortKey === "productiveH") { av = a.productiveH; bv = b.productiveH; }
      if (sortKey === "officeH")     { av = a.officeH; bv = b.officeH; }
      if (sortKey === "breakH")      { av = a.breakH; bv = b.breakH; }
      if (sortKey === "entryTime")   { av = timeToMinutes(a.entryTime); bv = timeToMinutes(b.entryTime); }
      if (sortKey === "exitTime")    { av = timeToMinutes(a.exitTime);  bv = timeToMinutes(b.exitTime); }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [dailyData, rowFilter, sortKey, sortDir, weekFilter]);

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => handleSort(col)}
      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest cursor-pointer border-none bg-transparent transition-colors"
      style={{ color: sortKey === col ? "var(--accent)" : "var(--text3)" }}>
      {label}
      <ArrowUpDown size={9} style={{ opacity: sortKey === col ? 1 : 0.4 }} />
    </button>
  );

  const filterOpts = [
    { key: "all" as const,       label: "All Days"    },
    { key: "logged" as const,    label: "Logged"      },
    { key: "missed" as const,    label: "Missed"      },
    { key: "overtime" as const,  label: "Overtime"    },
    { key: "underwork" as const, label: "Under Target" },
  ];

  return (
    <Card>
      <SectionTitle icon={Activity} iconColor="var(--accent)" title="Daily Log Table"
        subtitle="Sort and filter every work day at a glance" badge={`${rows.length} days`} />

      <div className="flex gap-2 flex-wrap mb-4">
        {filterOpts.map(o => (
          <button key={o.key} onClick={() => setRowFilter(o.key)}
            className="px-3 py-1 rounded-full font-mono text-[11px] cursor-pointer border-none transition-all"
            style={rowFilter === o.key
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)" }}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {([ ["day","Date"],["entryTime","Entry"],["exitTime","Exit"],["productiveH","Productive"],["officeH","Office"],["breakH","Break"] ] as [SortKey,string][]).map(([col, lbl]) => (
                <th key={col} className="px-4 py-2.5 text-left"><SortBtn col={col} label={lbl} /></th>
              ))}
              <th className="px-4 py-2.5 text-left">
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center">
                <p className="font-mono text-[13px]" style={{ color: "var(--text4)" }}>No matching days</p>
              </td></tr>
            ) : rows.map((d, idx) => {
              const dateStr = new Date(Date.UTC(year, month - 1, d.day))
                .toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
              const isOT  = d.hasEntry && d.productiveH > d.requiredH;
              const isUW  = d.hasEntry && d.productiveH < d.requiredH;
              const pct   = d.requiredH > 0 ? Math.min(100, Math.round((d.productiveH / d.requiredH) * 100)) : 0;
              return (
                <tr key={d.day} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 ? "var(--surface2)" : "transparent" }}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text)" }}>{dateStr}</p>
                    {d.isHoliday && <span className="font-mono text-[9px]" style={{ color: "#fbbf24" }}>Holiday</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px]" style={{ color: d.entryTime ? "#7c6ef3" : "var(--text4)" }}>
                      {to12h(d.entryTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px]" style={{ color: d.exitTime ? "#22d3a0" : "var(--text4)" }}>
                      {to12h(d.exitTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.hasEntry ? (
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isOT ? "#22d3a0" : "#7c6ef3" }} />
                        </div>
                        <span className="font-mono text-[12px]" style={{ color: isOT ? "#22d3a0" : "var(--text2)" }}>
                          {fmtH(d.productiveH)}
                        </span>
                      </div>
                    ) : <span className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px]" style={{ color: d.officeH > 0 ? "var(--text2)" : "var(--text4)" }}>
                      {fmtH(d.officeH)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px]" style={{ color: d.breakH > 0 ? "#fbbf24" : "var(--text4)" }}>
                      {fmtH(d.breakH)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!d.hasEntry && !d.isHoliday
                      ? <span className="px-2 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>Missed</span>
                      : d.isHoliday
                        ? <span className="px-2 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>Holiday</span>
                        : isOT
                          ? <span className="px-2 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(34,211,160,0.12)", color: "#22d3a0" }}>+OT {fmtH(d.productiveH - d.requiredH)}</span>
                          : isUW
                            ? <span className="px-2 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>-{fmtH(d.requiredH - d.productiveH)}</span>
                            : <span className="px-2 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(34,211,160,0.12)", color: "#22d3a0" }}>On Target</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// MONTH PICKER
// ─────────────────────────────────────────────────────────────────
function MonthPicker({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const today   = new Date();
  const ty      = today.getFullYear(), tm = today.getMonth() + 1;
  const canNext = year < ty || (year === ty && month < tm);

  function nav(delta: number) {
    let nm = month + delta, ny = year;
    if (nm < 1)  { nm = 12; ny--; }
    if (nm > 12) { nm = 1;  ny++; }
    if (ny > ty || (ny === ty && nm > tm)) return;
    onChange(ny, nm);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <button onClick={() => nav(-1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer border-none transition-colors"
        style={{ background: "var(--bg)", color: "var(--text2)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text2)")}>
        <ChevronLeft size={13} />
      </button>
      <p className="font-syne font-bold text-[14px] min-w-[130px] text-center" style={{ color: "var(--text)" }}>
        {MONTHS[month - 1]} {year}
      </p>
      <button onClick={() => canNext && nav(1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center border-none transition-colors"
        style={{ background: "var(--bg)", color: canNext ? "var(--text2)" : "var(--text4)", cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.4 }}
        onMouseEnter={e => { if (canNext) (e.currentTarget.style.color = "var(--accent)"); }}
        onMouseLeave={e => (e.currentTarget.style.color = canNext ? "var(--text2)" : "var(--text4)")}>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// QUICK FILTERS
// ─────────────────────────────────────────────────────────────────
function QuickFilters({ current, onSelect }: {
  current: string; onSelect: (key: string, y: number, m: number) => void;
}) {
  const now   = new Date();
  const thisY = now.getFullYear(), thisM = now.getMonth() + 1;
  const lastM = thisM === 1 ? 12 : thisM - 1;
  const lastY = thisM === 1 ? thisY - 1 : thisY;
  const l3M   = thisM <= 3 ? ((thisM + 9) % 12) || 12 : thisM - 3;
  const l3Y   = thisM <= 3 ? thisY - 1 : thisY;

  const opts = [
    { key: "this-month", label: "This Month", y: thisY, m: thisM },
    { key: "last-month", label: "Last Month", y: lastY, m: lastM },
    { key: "3m-ago",     label: `${MONTH_SHORT[l3M - 1]} ${l3Y}`, y: l3Y, m: l3M },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {opts.map(o => (
        <button key={o.key} onClick={() => onSelect(o.key, o.y, o.m)}
          className="px-3 py-1.5 rounded-xl font-mono text-[12px] cursor-pointer border-none transition-all"
          style={current === o.key
            ? { background: "var(--accent)", color: "#fff" }
            : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
          onMouseEnter={e => { if (current !== o.key) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
          onMouseLeave={e => { if (current !== o.key) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PER-DAY HOURS OVERRIDE TABLE
// ─────────────────────────────────────────────────────────────────
function PerDayHoursTable({ dailyData, defaultRequiredH, year, month }: {
  dailyData: DayData[]; defaultRequiredH: number; year: number; month: number;
}) {
  const overrideDays = dailyData.filter(d => d.hasEntry && Math.abs(d.requiredH - defaultRequiredH) > 0.01);
  if (!overrideDays.length) return null;
  return (
    <Card>
      <SectionTitle icon={Settings2} iconColor="var(--accent)" title="Custom Daily Targets"
        subtitle={`${overrideDays.length} day${overrideDays.length > 1 ? "s" : ""} used a custom required-hours target`} />
      <p className="font-mono text-[12px] mb-4" style={{ color: "var(--text3)" }}>
        Profile default is {fmtHLabel(defaultRequiredH)}. These days had a per-day override from the Today page.
      </p>
      <div className="space-y-2">
        {overrideDays.map(d => {
          const pct  = d.requiredH > 0 ? Math.min(100, (d.productiveH / d.requiredH) * 100) : 0;
          const done = pct >= 100;
          const dateStr = new Date(Date.UTC(year, month - 1, d.day))
            .toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
          return (
            <div key={d.day} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="w-20 shrink-0">
                <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text2)" }}>{dateStr}</p>
              </div>
              <span className="font-mono text-[12px] font-bold shrink-0" style={{ color: "var(--accent)" }}>
                {fmtHLabel(d.requiredH)} target
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done ? "#22d3a0" : "#7c6ef3" }} />
              </div>
              <span className="font-mono text-[12px] shrink-0 w-14 text-right" style={{ color: done ? "#22d3a0" : "var(--text3)" }}>
                {fmtH(d.productiveH)}{done ? " ✓" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOADING / EMPTY
// ─────────────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>Loading analytics…</p>
      </div>
    </div>
  );
}

function EmptyState({ month, year }: { month: number; year: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.2)" }}>
        <BarChart2 size={28} style={{ color: "var(--accent)" }} />
      </div>
      <div className="text-center">
        <p className="font-syne font-bold text-[18px]" style={{ color: "var(--text)" }}>
          No data for {MONTHS[month - 1]} {year}
        </p>
        <p className="font-mono text-[13px] mt-1" style={{ color: "var(--text3)" }}>
          Start logging your work days to see analytics here.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const now  = new Date();
  const [year,         setYear]         = useState(now.getFullYear());
  const [month,        setMonth]        = useState(now.getMonth() + 1);
  const [data,         setData]         = useState<AnalysisData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [activeFilter, setActiveFilter] = useState("this-month");
  const [weekFilter,   setWeekFilter]   = useState<WeekFilter>("all");

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/work/analysis?year=${y}&month=${m}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message ?? "Failed to load");
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  function handleMonthChange(y: number, m: number) { setYear(y); setMonth(m); setActiveFilter(""); setWeekFilter("all"); }
  function handleQuickFilter(key: string, y: number, m: number) { setActiveFilter(key); setYear(y); setMonth(m); setWeekFilter("all"); }

  const defaultRequiredH = useMemo(() => {
    if (!data) return 8.5;
    const logged = data.dailyData.filter(d => d.hasEntry);
    if (!logged.length) return 8.5;
    const freq: Record<number, number> = {};
    for (const d of logged) freq[d.requiredH] = (freq[d.requiredH] || 0) + 1;
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }, [data]);

  const hasVariableHours = useMemo(() =>
    data?.dailyData.some(d => d.hasEntry && Math.abs(d.requiredH - defaultRequiredH) > 0.01) ?? false,
  [data, defaultRequiredH]);

  // Filtered daily data for bar chart (responds to week selector)
  const chartData = useMemo(() => {
    if (!data) return [];
    const days = weekFilter === "all"
      ? data.dailyData
      : data.dailyData.filter(d => weekOf(d.day) === Number(weekFilter.replace("week", "")));
    return days.map(d => ({
      label: String(d.day), value: d.productiveH, refValue: d.requiredH,
      isFuture: d.isFuture, isWeekend: d.isWeekend, isHoliday: d.isHoliday,
    }));
  }, [data, weekFilter]);

  const maxDailyProd = useMemo(() => {
    if (!data) return 10;
    return Math.max(...data.dailyData.map(d => d.productiveH), ...data.dailyData.map(d => d.requiredH), 1);
  }, [data]);

  const sparklineData = useMemo(() =>
    data?.dailyData.filter(d => d.hasEntry && !d.isWeekend).map(d => d.productiveH) ?? [],
  [data]);

  // Current week's AnalysisData.weeks entry
  const selectedWeekData = useMemo(() => {
    if (!data || weekFilter === "all") return null;
    return data.weeks.find(w => `week${w.weekNum}` === weekFilter) ?? null;
  }, [data, weekFilter]);

  const score = data?.consistencyScore ?? 0;
  const { label: scoreLabel, color: scoreColor, emoji: scoreEmoji } = getScoreMeta(score);
  const insights = useMemo(() => data ? generateInsights(data) : [], [data]);

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-6">

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-syne font-extrabold text-[22px] tracking-tight" style={{ color: "var(--text)" }}>
              Work Analytics
            </h1>
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
              style={{ background: "rgba(124,110,243,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,243,0.2)" }}>
              {MONTHS[month - 1]} {year}
            </span>
          </div>
          <p className="font-mono text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
            Deep productivity insights · patterns · trends
          </p>
        </div>
        <button onClick={() => fetchData(year, month)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[12px] cursor-pointer transition-all self-start"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── FILTER BAR ───────────────────────────────────────────── */}
      <div className="rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <Filter size={12} style={{ color: "var(--text3)" }} />
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>Period</span>
        </div>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
        <div className="h-5 w-px hidden sm:block" style={{ background: "var(--border)" }} />
        <QuickFilters current={activeFilter} onSelect={handleQuickFilter} />

        {data && (
          <>
            <div className="h-5 w-px hidden sm:block" style={{ background: "var(--border)" }} />
            <div className="flex items-center gap-2">
              <CalendarDays size={12} style={{ color: "var(--text3)" }} />
              <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>Week</span>
              <WeekSelector
                value={weekFilter} onChange={setWeekFilter}
                weeks={data.weeks} daysInMonth={data.daysInMonth}
              />
            </div>
          </>
        )}
      </div>

      {/* ── WEEK STATS BANNER ────────────────────────────────────── */}
      {selectedWeekData && weekFilter !== "all" && (
        <div className="rounded-2xl px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4"
          style={{ background: "rgba(124,110,243,0.06)", border: "1px solid rgba(124,110,243,0.25)" }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text4)" }}>
              Week {selectedWeekData.weekNum}
            </p>
            <p className="font-syne font-bold text-[16px]" style={{ color: "var(--accent)" }}>
              {selectedWeekData.days.filter(d => d.hasEntry).length}
              <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
                &nbsp;/ {selectedWeekData.days.filter(d => !d.isWeekend && !d.isFuture).length} days
              </span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text4)" }}>Productive</p>
            <p className="font-syne font-bold text-[16px]" style={{ color: "#7c6ef3" }}>{fmtH(selectedWeekData.totalProductiveH)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text4)" }}>Required</p>
            <p className="font-syne font-bold text-[16px]" style={{ color: "var(--text)" }}>{fmtH(selectedWeekData.totalRequiredH)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text4)" }}>
              {selectedWeekData.totalProductiveH >= selectedWeekData.totalRequiredH ? "Overtime" : "Shortfall"}
            </p>
            <p className="font-syne font-bold text-[16px]"
              style={{ color: selectedWeekData.totalProductiveH >= selectedWeekData.totalRequiredH ? "#22d3a0" : "#f87171" }}>
              {selectedWeekData.totalProductiveH >= selectedWeekData.totalRequiredH
                ? `+${fmtH(selectedWeekData.totalProductiveH - selectedWeekData.totalRequiredH)}`
                : `-${fmtH(selectedWeekData.totalRequiredH - selectedWeekData.totalProductiveH)}`}
            </p>
          </div>
        </div>
      )}

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      {loading ? <LoadingSpinner /> : error ? (
        <div className="flex items-center gap-3 p-5 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          <p className="font-mono text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      ) : !data ? <EmptyState month={month} year={year} /> : (
        <div className="space-y-6">

          {/* Warnings */}
          {data.totalLoggedDays === 0 && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <AlertCircle size={16} style={{ color: "var(--amber)" }} />
              <p className="font-mono text-[13px]" style={{ color: "var(--amber)" }}>
                No work logs found for {MONTHS[month - 1]} {year}. Start logging days to see analytics populate.
              </p>
            </div>
          )}
          {hasVariableHours && (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
              style={{ background: "rgba(124,110,243,0.07)", border: "1px solid rgba(124,110,243,0.25)" }}>
              <Settings2 size={14} style={{ color: "var(--accent)" }} />
              <p className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>
                Some days used a custom daily target. All totals use each day's actual target. Default is {fmtHLabel(defaultRequiredH)}.
              </p>
            </div>
          )}

          {/* ══ 1 · STAT CARDS ══════════════════════════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Days Logged" value={String(data.totalLoggedDays)}
              sub={`of ${data.totalWorkDays} work days`} color="var(--text)" icon={CalendarDays} bg="var(--border)"
              delta={data.prevMonth.loggedDays > 0 ? { val: Math.round(((data.totalLoggedDays - data.prevMonth.loggedDays) / data.prevMonth.loggedDays) * 100), label: "MoM" } : undefined}
            />
            <StatCard label="Productive Hrs" value={fmtH(data.totalProductiveH)}
              sub="total this month" color="var(--accent)" icon={Zap} bg="rgba(124,110,243,0.12)"
              delta={data.prevMonth.productiveH > 0 ? { val: Math.round(((data.totalProductiveH - data.prevMonth.productiveH) / data.prevMonth.productiveH) * 100), label: "MoM" } : undefined}
            />
            <StatCard label="Required Hrs"   value={fmtH(data.totalRequiredH)}
              sub={`${data.totalWorkDays} day target`} color="#7c6ef3" icon={BookCheck} bg="rgba(124,110,243,0.10)" />
            <StatCard label="Office Time"    value={fmtH(data.totalOfficeH)}
              sub="total hrs in office"       color="var(--text2)"  icon={Clock}      bg="var(--border)" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Break Time" value={fmtH(data.totalBreakH)}
              sub="total break hrs" color="var(--amber)" icon={Coffee} bg="rgba(251,191,36,0.12)" />
            <StatCard
              label={data.overtimeH > 0 ? "Overtime" : "Underwork"}
              value={fmtH(data.overtimeH > 0 ? data.overtimeH : data.underworkH)}
              sub={data.overtimeH > 0 ? "extra hrs worked" : "hrs short of required"}
              color={data.overtimeH > 0 ? "#22d3a0" : "#f87171"}
              icon={data.overtimeH > 0 ? TrendingUp : TrendingDown}
              bg={data.overtimeH > 0 ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.12)"}
            />
            <StatCard label="Missing Days" value={String(data.totalMissingDays)}
              sub={`${data.totalHolidays} holiday${data.totalHolidays !== 1 ? "s" : ""} this month`}
              color={data.totalMissingDays > 0 ? "#f87171" : "#22d3a0"}
              icon={data.totalMissingDays > 0 ? AlertCircle : CheckCircle2}
              bg={data.totalMissingDays > 0 ? "rgba(248,113,113,0.12)" : "rgba(34,211,160,0.12)"}
            />
          </div>

          {/* ══ 2 · BAR CHART + HEATMAP ════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2">
              <SectionTitle
                icon={BarChart2} iconColor="var(--accent)"
                title={weekFilter === "all" ? "Daily Productive Hours" : `Week ${weekFilter.replace("week", "")} — Daily Breakdown`}
                subtitle="Bars = productive · ghost = required target"
              />

              {/* Full month chart */}
              {weekFilter === "all" && (
                <>
                  {sparklineData.length > 1 && (
                    <div className="mb-2"><Sparkline data={sparklineData} color="var(--accent)" /></div>
                  )}
                  <div className="flex gap-2">
                    <div className="flex flex-col justify-between pb-6 text-right pr-1" style={{ height: 120, minWidth: 24 }}>
                      {[maxDailyProd, maxDailyProd / 2, 0].map((v, i) => (
                        <span key={i} className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>
                          {v === 0 ? "" : `${v.toFixed(0)}h`}
                        </span>
                      ))}
                    </div>
                    <div className="flex-1">
                      <BarChart data={chartData} maxVal={maxDailyProd} barColor="#7c6ef3"
                        refColor="rgba(124,110,243,0.12)" showRef height={120}
                        tooltip={d =>
                          d.isHoliday ? `Day ${d.label} — Holiday` :
                          d.isWeekend ? `Day ${d.label} — Weekend` :
                          d.isFuture  ? `Day ${d.label} — Future`  :
                          d.value === 0 ? `Day ${d.label} — Not logged` :
                          `Day ${d.label} — ${fmtH(d.value)} / ${fmtH(d.refValue ?? 0)}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-5 mt-2 flex-wrap">
                    {[{ color: "#7c6ef3", label: "Productive" }, { color: "rgba(124,110,243,0.18)", label: "Required target" }, { color: "#fbbf24", label: "Holiday" }].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                        <span className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Week detail chart */}
              {weekFilter !== "all" && selectedWeekData && (
                <WeekDetailChart days={selectedWeekData.days} />
              )}
            </Card>

            {/* Heatmap — always full month */}
            <Card>
              <SectionTitle icon={CalendarDays} iconColor="#a78bfa" title="Month Heatmap" subtitle="Daily intensity at a glance" />
              <HeatmapCalendar dailyData={data.dailyData} year={year} month={month} maxH={maxDailyProd} />
            </Card>
          </div>

          {/* Per-day overrides */}
          <PerDayHoursTable dailyData={data.dailyData} defaultRequiredH={defaultRequiredH} year={year} month={month} />

          {/* ══ 3 · WEEK BREAKDOWN + BEST/WORST + STREAK ═══════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <SectionTitle icon={Activity} iconColor="#22d3a0" title="Week-by-Week Breakdown" subtitle="Productive vs required per week" />
              <div className="space-y-2">
                {data.weeks.map(w => {
                  const pct      = w.totalRequiredH > 0 ? Math.min(100, Math.round((w.totalProductiveH / w.totalRequiredH) * 100)) : 0;
                  const barColor = pct >= 90 ? "#22d3a0" : pct >= 70 ? "#7c6ef3" : "#fbbf24";
                  const isActive = weekFilter === `week${w.weekNum}`;
                  return (
                    <div key={w.weekNum} className="p-3 rounded-xl transition-all"
                      style={{ background: isActive ? "rgba(124,110,243,0.06)" : "transparent", border: isActive ? "1px solid rgba(124,110,243,0.2)" : "1px solid transparent" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>Week {w.weekNum}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-syne font-bold text-[13px]" style={{ color: barColor }}>{fmtH(w.totalProductiveH)}</span>
                          <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>/ {fmtH(w.totalRequiredH)}</span>
                          <span className="font-mono text-[11px] w-9 text-right" style={{ color: barColor }}>
                            {w.totalRequiredH > 0 ? `${pct}%` : "—"}
                          </span>
                        </div>
                      </div>
                      <ProgressBar value={w.totalProductiveH} max={w.totalRequiredH} color={barColor} />
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <SectionTitle icon={Award} iconColor="var(--amber)" title="Best & Worst Day" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "best",  day: data.bestDay,  color: "#22d3a0", bg: "rgba(34,211,160,0.08)",  border: "rgba(34,211,160,0.25)",  label: "BEST DAY"  },
                    { key: "worst", day: data.worstDay, color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", label: "WORST DAY" },
                  ].map(({ key, day, color, bg, border, label }) =>
                    day ? (
                      <div key={key} className="rounded-xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                        <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>{label}</p>
                        <p className="font-syne font-extrabold text-[26px]" style={{ color }}>{ordinal(day.day)}</p>
                        <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>{fmtH(day.productiveH)}</p>
                      </div>
                    ) : (
                      <div key={key} className="rounded-xl p-4 text-center" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>{label}</p>
                        <p className="font-mono text-[13px]" style={{ color: "var(--text4)" }}>—</p>
                      </div>
                    )
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Flame} iconColor="#f87171" title="Attendance Streak" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "CURRENT", val: data.currentStreak,  color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
                    { label: "LONGEST", val: data.longestStreak,  color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.25)"  },
                  ].map(({ label, val, color, bg, border }) => (
                    <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                      <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>{label}</p>
                      <p className="font-syne font-extrabold text-[32px] leading-none" style={{ color }}>{val}</p>
                      <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>days</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* ══ 4 · BREAK ANALYSIS + ENTRY/EXIT ═══════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <SectionTitle icon={Coffee} iconColor="var(--amber)" title="Break Analysis" subtitle="Tea · Lunch · Custom breakdown" />
              <div className="flex flex-col gap-5">
                <DonutChart segments={[
                  { label: "Tea / Coffee", value: data.breakBreakdown.tea.count,    color: "#fbbf24" },
                  { label: "Lunch",        value: data.breakBreakdown.lunch.count,  color: "#22d3a0" },
                  { label: "Custom",       value: data.breakBreakdown.custom.count, color: "#a78bfa" },
                ]} />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Tea",    count: data.breakBreakdown.tea.count,    h: data.breakBreakdown.tea.totalH,    c: "#fbbf24" },
                    { label: "Lunch",  count: data.breakBreakdown.lunch.count,  h: data.breakBreakdown.lunch.totalH,  c: "#22d3a0" },
                    { label: "Custom", count: data.breakBreakdown.custom.count, h: data.breakBreakdown.custom.totalH, c: "#a78bfa" },
                  ].map(b => (
                    <div key={b.label} className="rounded-xl p-3 text-center"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{b.label}</p>
                      <p className="font-syne font-bold text-[18px] mt-1" style={{ color: b.c }}>{b.count}×</p>
                      <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{fmtH(b.h)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Longest Break", value: `${data.longestBreakMins}m` },
                    { label: "Avg Break",      value: `${data.avgBreakMins}m`     },
                    { label: "Max in Day",     value: String(data.maxBreaksInDay) },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{s.label}</p>
                      <p className="font-syne font-bold text-[16px] mt-1" style={{ color: "var(--text)" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={LogIn} iconColor="#7c6ef3" title="Entry / Exit Patterns" subtitle="Your timing habits this month" />
              <div className="relative mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  {["07:00","10:00","13:00","16:00","19:00","22:00"].map(t => (
                    <span key={t} className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{t}</span>
                  ))}
                </div>
                <div className="w-full h-3 rounded-full relative overflow-hidden" style={{ background: "var(--border)" }}>
                  {data.avgEntryTime && data.avgExitTime && (() => {
                    const [eh, em] = data.avgEntryTime.split(":").map(Number);
                    const [xh, xm] = data.avgExitTime.split(":").map(Number);
                    const dayStart = 7 * 60, range = 15 * 60;
                    const left  = Math.max(0, ((eh * 60 + em - dayStart) / range) * 100);
                    const width = Math.min(100 - left, (((xh * 60 + xm) - (eh * 60 + em)) / range) * 100);
                    return <div className="absolute h-full rounded-full"
                      style={{ left: `${left}%`, width: `${width}%`, background: "linear-gradient(to right, #7c6ef3, #22d3a0)" }} />;
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Avg Entry",     value: to12h(data.avgEntryTime),  icon: LogIn,  color: "#7c6ef3"  },
                  { label: "Avg Exit",      value: to12h(data.avgExitTime),   icon: LogOut, color: "#22d3a0"  },
                  { label: "Earliest Entry",value: to12h(data.earliestEntry), icon: LogIn,  color: "var(--amber)"  },
                  { label: "Latest Exit",   value: to12h(data.latestExit),    icon: LogOut, color: "#f87171"  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl p-4"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon size={11} style={{ color }} />
                      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>{label}</span>
                    </div>
                    <p className="font-syne font-bold text-[18px]" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ══ 5 · CONSISTENCY SCORE + MOM ════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <SectionTitle icon={Target} iconColor={scoreColor} title="Work Consistency Score" subtitle="Productive ÷ Required hours × 100" />
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="relative" style={{ width: 160, height: 90 }}>
                  <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
                    <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke={scoreColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(score / 100) * 188.5} 188.5`} style={{ transition: "stroke-dasharray 1s ease" }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-[18px]">{scoreEmoji}</span>
                    <span className="font-syne font-extrabold text-[24px] leading-none" style={{ color: scoreColor }}>{score}%</span>
                  </div>
                </div>
                <div className="px-5 py-2.5 rounded-xl" style={{ background: `${scoreColor}18`, border: `1px solid ${scoreColor}40` }}>
                  <p className="font-syne font-bold text-[15px]" style={{ color: scoreColor }}>{scoreLabel}</p>
                </div>
                <div className="w-full grid grid-cols-2 gap-2">
                  {[
                    { range: "90–100%", badge: "Excellent",         color: "#22d3a0" },
                    { range: "75–89%",  badge: "Good",              color: "#7c6ef3" },
                    { range: "60–74%",  badge: "Needs Improvement", color: "#fbbf24" },
                    { range: "< 60%",   badge: "Poor",              color: "#f87171" },
                  ].map(t => {
                    const isActive = t.badge === scoreLabel;
                    return (
                      <div key={t.badge} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                        style={{ background: isActive ? `${t.color}12` : "transparent", border: isActive ? `1px solid ${t.color}40` : "1px solid transparent" }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                        <span className="font-mono text-[10px]" style={{ color: isActive ? t.color : "var(--text4)" }}>
                          {t.range} · {t.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full grid grid-cols-2 gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Required",   val: data.totalRequiredH,  color: "#7c6ef3"      },
                    { label: "Productive", val: data.totalProductiveH, color: "var(--accent)" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center"
                      style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.2)" }}>
                      <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{label}</p>
                      <p className="font-syne font-bold text-[16px] mt-0.5" style={{ color }}>{fmtH(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={TrendingUp} iconColor="var(--accent)" title="Month-over-Month"
                subtitle={`${MONTH_SHORT[data.prevMonth.month - 1]} ${data.prevMonth.year} vs ${MONTH_SHORT[month - 1]} ${year}`} />
              <div className="space-y-5">
                {[
                  { label: "Productive Hours", prev: data.prevMonth.productiveH, curr: data.totalProductiveH, fmt: fmtH,           color: "var(--accent)" },
                  { label: "Days Logged",       prev: data.prevMonth.loggedDays,  curr: data.totalLoggedDays,  fmt: (v: number) => `${v}d`, color: "#22d3a0" },
                ].map(({ label, prev, curr, fmt, color }) => {
                  const maxV      = Math.max(prev, curr, 1);
                  const diff      = curr - prev;
                  const pctChange = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>{label}</span>
                        <span className="font-mono text-[11px]" style={{ color: diff >= 0 ? "#22d3a0" : "#f87171" }}>
                          {diff >= 0 ? "+" : ""}{prev > 0 ? `${pctChange}%` : "—"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { val: prev, lbl: MONTH_SHORT[data.prevMonth.month - 1], opacity: 0.45 },
                          { val: curr, lbl: MONTH_SHORT[month - 1],                opacity: 1    },
                        ].map(({ val, lbl, opacity }, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="font-mono text-[10px] w-8 text-right" style={{ color: "var(--text4)" }}>{lbl}</span>
                            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(val / maxV) * 100}%`, background: color, opacity }} />
                            </div>
                            <span className="font-mono text-[11px] w-10" style={{ color: "var(--text2)" }}>{fmt(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="rounded-xl p-3" style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Overtime</p>
                    <p className="font-syne font-bold text-[17px] mt-0.5" style={{ color: "#22d3a0" }}>+{fmtH(data.overtimeH)}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Underwork</p>
                    <p className="font-syne font-bold text-[17px] mt-0.5" style={{ color: "#f87171" }}>-{fmtH(data.underworkH)}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ══ 6 · DAILY LOG TABLE ════════════════════════════════ */}
          <DailyLogTable dailyData={data.dailyData} year={year} month={month} weekFilter={weekFilter} />

          {/* ══ 7 · SMART INSIGHTS  ← always at the very bottom ═══ */}
          {insights.length > 0 && (
            <Card glow>
              <SectionTitle icon={BrainCircuit} iconColor="#a78bfa" title="Smart Insights"
                subtitle="Auto-generated observations from your work data" badge={`${insights.length} insights`} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-3 p-3.5 rounded-xl"
                    style={{
                      background: ins.type === "positive" ? "rgba(34,211,160,0.06)"
                        : ins.type === "warning" ? "rgba(248,113,113,0.06)"
                          : "rgba(124,110,243,0.06)",
                      border: `1px solid ${ins.type === "positive" ? "rgba(34,211,160,0.2)"
                        : ins.type === "warning" ? "rgba(248,113,113,0.2)"
                          : "rgba(124,110,243,0.2)"}`,
                    }}>
                    <span className="text-[16px] mt-0.5 shrink-0">
                      {ins.type === "positive" ? "✅" : ins.type === "warning" ? "⚠️" : "💡"}
                    </span>
                    <p className="font-mono text-[12px] leading-relaxed" style={{ color: "var(--text2)" }}>
                      {ins.text}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}