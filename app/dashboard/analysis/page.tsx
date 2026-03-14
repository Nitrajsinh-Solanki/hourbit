// app/dashboard/analysis/page.tsx

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart2, TrendingUp, TrendingDown, Clock, Coffee, Zap,
  CalendarDays, ChevronLeft, ChevronRight, Award, Flame,
  AlertCircle, CheckCircle2, RefreshCw, LogIn, LogOut,
  Target, Activity, BookCheck, Settings2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
interface DayData {
  day:         number;
  dow:         number;
  isWeekend:   boolean;
  isFuture:    boolean;
  isHoliday:   boolean;
  hasEntry:    boolean;
  productiveH: number;
  officeH:     number;
  breakH:      number;
  requiredH:   number;
  entryTime:   string | null;
  exitTime:    string | null;
  notes:       string;
  breaks:      { type: string; duration: number }[];
}

interface AnalysisData {
  year:             number;
  month:            number;
  daysInMonth:      number;
  dailyData:        DayData[];
  totalLoggedDays:  number;
  totalWorkDays:    number;
  totalMissingDays: number;
  totalHolidays:    number;
  totalWeekends:    number;
  totalProductiveH: number;
  totalOfficeH:     number;
  totalBreakH:      number;
  totalRequiredH:   number;
  overtimeH:        number;
  underworkH:       number;
  consistencyScore: number;
  weeks:            { weekNum: number; totalProductiveH: number; totalRequiredH: number; days: DayData[] }[];
  avgEntryTime:     string | null;
  avgExitTime:      string | null;
  earliestEntry:    string | null;
  latestExit:       string | null;
  breakBreakdown: {
    tea:    { count: number; totalH: number };
    lunch:  { count: number; totalH: number };
    custom: { count: number; totalH: number };
  };
  longestBreakMins: number;
  maxBreaksInDay:   number;
  avgBreakMins:     number;
  bestDay:  { day: number; productiveH: number } | null;
  worstDay: { day: number; productiveH: number } | null;
  currentStreak:    number;
  longestStreak:    number;
  prevMonth: { year: number; month: number; loggedDays: number; productiveH: number };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtH(h: number): string {
  if (h <= 0) return "—";
  const hrs  = Math.floor(h);
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
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getScoreMeta(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent",         color: "#22d3a0" };
  if (score >= 75) return { label: "Good",              color: "#7c6ef3" };
  if (score >= 60) return { label: "Needs Improvement", color: "#fbbf24" };
  return               { label: "Poor",                color: "#f87171" };
}

// ─────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, iconColor, title, subtitle }: {
  icon: React.ElementType; iconColor: string; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 mb-4"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <Icon size={14} style={{ color: iconColor }} />
      <div>
        <h2 className="font-syne font-semibold text-[14px]" style={{ color: "var(--text)" }}>{title}</h2>
        {subtitle && <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon: Icon, bg }: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ElementType; bg: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
          {label}
        </span>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p className="font-syne font-extrabold text-[22px] leading-none" style={{ color }}>{value}</p>
      {sub && <p className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PURE-CSS BAR CHART
// ─────────────────────────────────────────────────────────────────
function BarChart({
  data, maxVal, barColor = "#7c6ef3", refColor = "rgba(124,110,243,0.2)",
  showRef = false, height = 100, tooltip,
}: {
  data: { label: string; value: number; refValue?: number; isFuture?: boolean; isWeekend?: boolean; isHoliday?: boolean }[];
  maxVal: number; barColor?: string; refColor?: string;
  showRef?: boolean; height?: number; tooltip?: (d: any) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="relative" style={{ height: height + 40 }}>
      {hovered !== null && tooltip && (
        <div className="absolute z-10 px-3 py-2 rounded-xl font-mono text-[11px] pointer-events-none"
          style={{
            background: "var(--surface2)", border: "1px solid var(--border2)",
            color: "var(--text)", top: 0,
            left: `${Math.min(80, (hovered / data.length) * 100)}%`,
            transform: "translateX(-50%)", whiteSpace: "nowrap",
          }}>
          {tooltip(data[hovered])}
        </div>
      )}
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((d, i) => {
          const barH  = maxVal > 0 ? (d.value / maxVal) * height : 0;
          const refH  = maxVal > 0 && d.refValue ? (d.refValue / maxVal) * height : 0;
          const faded = d.isFuture || d.isWeekend;
          const color = d.isHoliday ? "#fbbf24"
                      : d.isFuture  ? "var(--border2)"
                      : d.isWeekend ? "var(--border)"
                      : barColor;
          return (
            <div key={i}
              className="relative flex-1 flex flex-col justify-end cursor-pointer"
              style={{ height, opacity: faded ? 0.4 : 1 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}>
              {showRef && refH > 0 && (
                <div className="absolute bottom-0 left-0 right-0 rounded-sm"
                  style={{ height: refH, background: refColor, zIndex: 0 }} />
              )}
              <div className="relative rounded-t-sm transition-all duration-300"
                style={{
                  height: Math.max(barH, d.value > 0 ? 2 : 0),
                  background: hovered === i
                    ? (d.isHoliday ? "#d97706" : d.isFuture ? "var(--border2)" : "#a78bfa")
                    : color,
                  zIndex: 1,
                }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-px mt-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="font-mono text-[9px]"
              style={{ color: hovered === i ? "var(--accent)" : "var(--text4)" }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────────
function DonutChart({ segments }: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-[100px]">
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
      <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
        <div className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${stops})` }} />
        <div className="absolute rounded-full" style={{ inset: "20px", background: "var(--surface)" }} />
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
// MONTH PICKER
// ─────────────────────────────────────────────────────────────────
function MonthPicker({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const today  = new Date();
  const ty     = today.getFullYear();
  const tm     = today.getMonth() + 1;
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
        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer border-none transition-all"
        style={{ background: "var(--bg)", color: "var(--text2)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text2)")}>
        <ChevronLeft size={13} />
      </button>
      <p className="font-syne font-bold text-[14px] min-w-[130px] text-center" style={{ color: "var(--text)" }}>
        {MONTHS[month - 1]} {year}
      </p>
      <button onClick={() => canNext && nav(1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center border-none transition-all"
        style={{
          background: "var(--bg)",
          color:   canNext ? "var(--text2)" : "var(--text4)",
          cursor:  canNext ? "pointer"      : "not-allowed",
          opacity: canNext ? 1              : 0.4,
        }}
        onMouseEnter={e => { if (canNext) (e.currentTarget.style.color = "var(--accent)"); }}
        onMouseLeave={e => (e.currentTarget.style.color = canNext ? "var(--text2)" : "var(--text4)")}>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// QUICK FILTER BUTTONS
// ─────────────────────────────────────────────────────────────────
function QuickFilters({ current, onSelect }: {
  current: string;
  onSelect: (key: string, year: number, month: number) => void;
}) {
  const now   = new Date();
  const thisY = now.getFullYear();
  const thisM = now.getMonth() + 1;
  const lastM = thisM === 1 ? 12 : thisM - 1;
  const lastY = thisM === 1 ? thisY - 1 : thisY;

  const opts = [
    { key: "this-month", label: "This Month", y: thisY, m: thisM },
    { key: "last-month", label: "Last Month", y: lastY, m: lastM },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {opts.map(o => (
        <button key={o.key} onClick={() => onSelect(o.key, o.y, o.m)}
          className="px-3 py-1.5 rounded-xl font-mono text-[12px] cursor-pointer border-none transition-all"
          style={
            current === o.key
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }
          }
          onMouseEnter={e => { if (current !== o.key) (e.currentTarget.style.borderColor = "var(--accent)"); }}
          onMouseLeave={e => { if (current !== o.key) (e.currentTarget.style.borderColor = "var(--border)"); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PER-DAY HOURS OVERRIDE TABLE — only rendered when days differ
// ─────────────────────────────────────────────────────────────────
function PerDayHoursTable({
  dailyData, defaultRequiredH, year, month,
}: {
  dailyData: DayData[]; defaultRequiredH: number; year: number; month: number;
}) {
  const overrideDays = dailyData.filter(
    d => d.hasEntry && Math.abs(d.requiredH - defaultRequiredH) > 0.01
  );
  if (overrideDays.length === 0) return null;

  return (
    <Card>
      <SectionTitle
        icon={Settings2} iconColor="var(--accent)"
        title="Custom Daily Targets"
        subtitle={`${overrideDays.length} day${overrideDays.length > 1 ? "s" : ""} used a custom required-hours target`}
      />
      <p className="font-mono text-[12px] mb-4" style={{ color: "var(--text3)" }}>
        Profile default is {fmtHLabel(defaultRequiredH)}.
        These days had a per-day override set from the Today page.
      </p>
      <div className="space-y-2">
        {overrideDays.map(d => {
          const pct  = d.requiredH > 0 ? Math.min(100, (d.productiveH / d.requiredH) * 100) : 0;
          const done = pct >= 100;
          const dateStr = new Date(Date.UTC(year, month - 1, d.day))
            .toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
          const barColor = done ? "#22d3a0" : "#7c6ef3";
          return (
            <div key={d.day} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="w-20 shrink-0">
                <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text2)" }}>{dateStr}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                  {fmtHLabel(d.requiredH)}
                </span>
                <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>target</span>
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <span className="font-mono text-[12px] shrink-0 w-14 text-right"
                style={{ color: done ? "var(--green)" : "var(--text3)" }}>
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

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`/api/work/analysis?year=${y}&month=${m}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message ?? "Failed to load");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, month); }, [year, month, fetchData]);

  function handleMonthChange(y: number, m: number) {
    setYear(y); setMonth(m); setActiveFilter("");
  }
  function handleQuickFilter(key: string, y: number, m: number) {
    setActiveFilter(key); setYear(y); setMonth(m);
  }

  // Compute default required hours = most common requiredH across logged days
  const defaultRequiredH = useMemo(() => {
    if (!data) return 8.5;
    const logged = data.dailyData.filter(d => d.hasEntry);
    if (!logged.length) return 8.5;
    const freq: Record<number, number> = {};
    for (const d of logged) freq[d.requiredH] = (freq[d.requiredH] || 0) + 1;
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  }, [data]);

  // True if any logged day used a custom target
  const hasVariableHours = useMemo(() =>
    data?.dailyData.some(d => d.hasEntry && Math.abs(d.requiredH - defaultRequiredH) > 0.01) ?? false,
  [data, defaultRequiredH]);

  const dailyBarData = useMemo(() => {
    if (!data) return [];
    return data.dailyData.map(d => ({
      label:     String(d.day),
      value:     d.productiveH,
      refValue:  d.requiredH,           // per-day ghost bar
      isFuture:  d.isFuture,
      isWeekend: d.isWeekend,
      isHoliday: d.isHoliday,
    }));
  }, [data]);

  const maxDailyProd = useMemo(() =>
    data ? Math.max(
      ...data.dailyData.map(d => d.productiveH),
      ...data.dailyData.map(d => d.requiredH),   // keep scale correct for variable targets
      1
    ) : 10,
  [data]);

  const score = data?.consistencyScore ?? 0;
  const { label: scoreLabel, color: scoreColor } = getScoreMeta(score);

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-6">

      {/* ── PAGE HEADER ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-[22px] tracking-tight" style={{ color: "var(--text)" }}>
            See Analysis
          </h1>
          <p className="font-mono text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
            Productivity insights & work patterns
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
        <div className="flex items-center gap-2">
          <CalendarDays size={14} style={{ color: "var(--text3)" }} />
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
            Period
          </span>
        </div>
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
        <div className="h-5 w-px hidden sm:block" style={{ background: "var(--border)" }} />
        <QuickFilters current={activeFilter} onSelect={handleQuickFilter} />
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────── */}
      {loading ? <LoadingSpinner /> : error ? (
        <div className="flex items-center gap-3 p-5 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          <p className="font-mono text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      ) : !data ? (
        <EmptyState month={month} year={year} />
      ) : (
        <div className="space-y-6">

          {/* ── No logged days banner ─────────────────────────────── */}
          {data.totalLoggedDays === 0 && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <AlertCircle size={16} style={{ color: "var(--amber)" }} />
              <p className="font-mono text-[13px]" style={{ color: "var(--amber)" }}>
                No work logs found for {MONTHS[month - 1]} {year}. Start logging days to see analytics populate.
              </p>
            </div>
          )}

          {/* Variable hours info banner */}
          {hasVariableHours && (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
              style={{ background: "rgba(124,110,243,0.07)", border: "1px solid rgba(124,110,243,0.25)" }}>
              <Settings2 size={14} style={{ color: "var(--accent)" }} />
              <p className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>
                Some days this month used a custom daily target. All totals use each day&apos;s actual target.
                Profile default is {fmtHLabel(defaultRequiredH)}.
              </p>
            </div>
          )}

          {/* ══ ROW 1 — MONTHLY OVERVIEW STAT CARDS ════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              label="Days Logged"
              value={String(data.totalLoggedDays)}
              sub={`of ${data.totalWorkDays} work days`}
              color="var(--text)"
              icon={CalendarDays}
              bg="var(--border)"
            />
            <StatCard
              label="Productive Hrs"
              value={fmtH(data.totalProductiveH)}
              sub="total this month"
              color="var(--accent)"
              icon={Zap}
              bg="rgba(124,110,243,0.12)"
            />
            <StatCard
              label="Required Hrs"
              value={fmtH(data.totalRequiredH)}
              sub={`${data.totalWorkDays} day${data.totalWorkDays !== 1 ? "s" : ""} × per-day target`}
              color="#7c6ef3"
              icon={BookCheck}
              bg="rgba(124,110,243,0.10)"
            />
            <StatCard
              label="Office Time"
              value={fmtH(data.totalOfficeH)}
              sub="total hrs in office"
              color="var(--text2)"
              icon={Clock}
              bg="var(--border)"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Break Time"
              value={fmtH(data.totalBreakH)}
              sub="total break hrs"
              color="var(--amber)"
              icon={Coffee}
              bg="rgba(251,191,36,0.12)"
            />
            <StatCard
              label={data.overtimeH > 0 ? "Overtime" : "Underwork"}
              value={fmtH(data.overtimeH > 0 ? data.overtimeH : data.underworkH)}
              sub={data.overtimeH > 0 ? "extra hrs worked" : "hrs short of required"}
              color={data.overtimeH > 0 ? "var(--green)" : "var(--danger)"}
              icon={data.overtimeH > 0 ? TrendingUp : TrendingDown}
              bg={data.overtimeH > 0 ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.12)"}
            />
            <StatCard
              label="Missing Days"
              value={String(data.totalMissingDays)}
              sub={`${data.totalHolidays} holiday${data.totalHolidays !== 1 ? "s" : ""} this month`}
              color={data.totalMissingDays > 0 ? "var(--danger)" : "var(--green)"}
              icon={data.totalMissingDays > 0 ? AlertCircle : CheckCircle2}
              bg={data.totalMissingDays > 0 ? "rgba(248,113,113,0.12)" : "rgba(34,211,160,0.12)"}
            />
          </div>

          {/* ══ ROW 2 — DAILY PRODUCTIVE HOURS BAR CHART ═══════════ */}
          <Card>
            <SectionTitle icon={BarChart2} iconColor="var(--accent)" title="Daily Productive Hours"
              subtitle={`${MONTHS[month - 1]} ${year} — each bar = one day · ghost = per-day required target`} />
            <div className="flex gap-2">
              <div className="flex flex-col justify-between pb-6 text-right pr-1"
                style={{ height: 120, minWidth: 24 }}>
                {[maxDailyProd, maxDailyProd / 2, 0].map((v, i) => (
                  <span key={i} className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>
                    {v === 0 ? "" : `${v.toFixed(0)}h`}
                  </span>
                ))}
              </div>
              <div className="flex-1">
                <BarChart
                  data={dailyBarData}
                  maxVal={maxDailyProd}
                  barColor="#7c6ef3"
                  refColor="rgba(124,110,243,0.12)"
                  showRef
                  height={120}
                  tooltip={d =>
                    d.isHoliday   ? `Day ${d.label} — Holiday` :
                    d.isWeekend   ? `Day ${d.label} — Weekend` :
                    d.isFuture    ? `Day ${d.label} — Future`  :
                    d.value === 0 ? `Day ${d.label} — Not logged` :
                    `Day ${d.label} — ${fmtH(d.value)} productive / ${fmtH(d.refValue ?? 0)} required`
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-5 mt-2 flex-wrap">
              {[
                { color: "#7c6ef3",               label: "Productive hrs" },
                { color: "rgba(124,110,243,0.2)", label: "Required hrs (per-day ghost)" },
                { color: "#fbbf24",               label: "Holiday" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                  <span className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ══ PER-DAY HOURS OVERRIDE TABLE (only if any overrides) */}
          <PerDayHoursTable
            dailyData={data.dailyData}
            defaultRequiredH={defaultRequiredH}
            year={year}
            month={month}
          />

          {/* ══ ROW 3 — WEEK-BY-WEEK + BEST/WORST + STREAKS ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Week breakdown — uses per-day totalRequiredH from API */}
            <Card>
              <SectionTitle icon={Activity} iconColor="#22d3a0" title="Week-by-Week Breakdown"
                subtitle="Productive vs required per week (per-day targets)" />
              <div className="space-y-3">
                {data.weeks.map(w => {
                  const pct      = w.totalRequiredH > 0
                    ? Math.min(100, Math.round((w.totalProductiveH / w.totalRequiredH) * 100))
                    : 0;
                  const barColor = pct >= 90 ? "#22d3a0" : pct >= 70 ? "#7c6ef3" : "#fbbf24";
                  return (
                    <div key={w.weekNum}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>
                          Week {w.weekNum}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-syne font-bold text-[13px]" style={{ color: barColor }}>
                            {fmtH(w.totalProductiveH)}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>
                            / {fmtH(w.totalRequiredH)}
                          </span>
                          <span className="font-mono text-[11px] w-9 text-right" style={{ color: barColor }}>
                            {w.totalRequiredH > 0 ? `${pct}%` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Best/Worst + Streaks stacked */}
            <div className="space-y-4">
              <Card>
                <SectionTitle icon={Award} iconColor="var(--amber)" title="Best & Worst Day" />
                <div className="grid grid-cols-2 gap-3">
                  {data.bestDay ? (
                    <div className="rounded-xl p-4 text-center"
                      style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
                      <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>BEST DAY</p>
                      <p className="font-syne font-extrabold text-[26px]" style={{ color: "#22d3a0" }}>
                        {ordinal(data.bestDay.day)}
                      </p>
                      <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>
                        {fmtH(data.bestDay.productiveH)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl p-4 text-center"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>BEST DAY</p>
                      <p className="font-mono text-[13px]" style={{ color: "var(--text4)" }}>—</p>
                    </div>
                  )}
                  {data.worstDay ? (
                    <div className="rounded-xl p-4 text-center"
                      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                      <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>WORST DAY</p>
                      <p className="font-syne font-extrabold text-[26px]" style={{ color: "#f87171" }}>
                        {ordinal(data.worstDay.day)}
                      </p>
                      <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>
                        {fmtH(data.worstDay.productiveH)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl p-4 text-center"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>WORST DAY</p>
                      <p className="font-mono text-[13px]" style={{ color: "var(--text4)" }}>—</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Flame} iconColor="#f87171" title="Attendance Streak" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 text-center"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                    <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>CURRENT</p>
                    <p className="font-syne font-extrabold text-[32px] leading-none" style={{ color: "#f87171" }}>
                      {data.currentStreak}
                    </p>
                    <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>days</p>
                  </div>
                  <div className="rounded-xl p-4 text-center"
                    style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
                    <p className="font-mono text-[10px] mb-2" style={{ color: "var(--text3)" }}>LONGEST</p>
                    <p className="font-syne font-extrabold text-[32px] leading-none" style={{ color: "#fbbf24" }}>
                      {data.longestStreak}
                    </p>
                    <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text2)" }}>days</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* ══ ROW 4 — BREAK ANALYSIS + ENTRY/EXIT PATTERNS ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Break analysis */}
            <Card>
              <SectionTitle icon={Coffee} iconColor="var(--amber)" title="Break Analysis"
                subtitle="Tea · Lunch · Custom breakdown" />
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

            {/* Entry/Exit patterns */}
            <Card>
              <SectionTitle icon={LogIn} iconColor="#7c6ef3" title="Entry / Exit Patterns"
                subtitle="Your timing habits this month" />

              {/* Timeline bar */}
              <div className="relative mb-6">
                <div className="flex items-center justify-between mb-1">
                  {["07:00", "10:00", "13:00", "16:00", "19:00", "22:00"].map(t => (
                    <span key={t} className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{t}</span>
                  ))}
                </div>
                <div className="w-full h-3 rounded-full relative overflow-hidden"
                  style={{ background: "var(--border)" }}>
                  {data.avgEntryTime && data.avgExitTime && (() => {
                    const [eh, em] = data.avgEntryTime.split(":").map(Number);
                    const [xh, xm] = data.avgExitTime.split(":").map(Number);
                    const dayStart = 7 * 60, dayEnd = 22 * 60, range = dayEnd - dayStart;
                    const startMin = eh * 60 + em, endMin = xh * 60 + xm;
                    const left  = Math.max(0, ((startMin - dayStart) / range) * 100);
                    const width = Math.min(100 - left, ((endMin - startMin) / range) * 100);
                    return (
                      <div className="absolute h-full rounded-full"
                        style={{
                          left: `${left}%`, width: `${width}%`,
                          background: "linear-gradient(to right, #7c6ef3, #22d3a0)",
                        }} />
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Avg Entry",      value: to12h(data.avgEntryTime),  icon: LogIn,  color: "#7c6ef3"       },
                  { label: "Avg Exit",        value: to12h(data.avgExitTime),   icon: LogOut, color: "#22d3a0"       },
                  { label: "Earliest Entry",  value: to12h(data.earliestEntry), icon: LogIn,  color: "var(--amber)"  },
                  { label: "Latest Exit",     value: to12h(data.latestExit),    icon: LogOut, color: "var(--danger)" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl p-4"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon size={11} style={{ color }} />
                      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
                        {label}
                      </span>
                    </div>
                    <p className="font-syne font-bold text-[18px]" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ══ ROW 5 — CONSISTENCY SCORE + MONTH-OVER-MONTH ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Consistency score gauge */}
            <Card>
              <SectionTitle icon={Target} iconColor={scoreColor} title="Work Consistency Score"
                subtitle="Productive ÷ Required hours × 100 (uses per-day targets)" />
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="relative" style={{ width: 160, height: 90 }}>
                  <svg viewBox="0 0 160 90" className="w-full h-full overflow-visible">
                    <path d="M 20 85 A 60 60 0 0 1 140 85"
                      fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 20 85 A 60 60 0 0 1 140 85"
                      fill="none" stroke={scoreColor} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(score / 100) * 188.5} 188.5`}
                      style={{ transition: "stroke-dasharray 1s ease" }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="font-syne font-extrabold text-[28px] leading-none" style={{ color: scoreColor }}>
                      {score}%
                    </span>
                  </div>
                </div>

                <div className="px-5 py-2.5 rounded-xl"
                  style={{ background: `${scoreColor}15`, border: `1px solid ${scoreColor}40` }}>
                  <p className="font-syne font-bold text-[16px]" style={{ color: scoreColor }}>{scoreLabel}</p>
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
                        style={{
                          background: isActive ? `${t.color}10` : "transparent",
                          border:     isActive ? `1px solid ${t.color}40` : "1px solid transparent",
                        }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                        <span className="font-mono text-[10px]"
                          style={{ color: isActive ? t.color : "var(--text4)" }}>
                          {t.range} · {t.badge}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full grid grid-cols-2 gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Required</p>
                    <p className="font-syne font-bold text-[16px] mt-0.5" style={{ color: "#7c6ef3" }}>
                      {fmtH(data.totalRequiredH)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Productive</p>
                    <p className="font-syne font-bold text-[16px] mt-0.5" style={{ color: "var(--accent)" }}>
                      {fmtH(data.totalProductiveH)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Month-over-Month */}
            <Card>
              <SectionTitle icon={TrendingUp} iconColor="var(--accent)" title="Month-over-Month"
                subtitle={`${MONTH_SHORT[data.prevMonth.month - 1]} ${data.prevMonth.year} vs ${MONTH_SHORT[month - 1]} ${year}`} />

              <div className="space-y-5">
                {[
                  {
                    label: "Productive Hours",
                    prev:  data.prevMonth.productiveH,
                    curr:  data.totalProductiveH,
                    fmt:   (v: number) => fmtH(v),
                    color: "var(--accent)",
                  },
                  {
                    label: "Days Logged",
                    prev:  data.prevMonth.loggedDays,
                    curr:  data.totalLoggedDays,
                    fmt:   (v: number) => `${v}d`,
                    color: "#22d3a0",
                  },
                ].map(({ label, prev, curr, fmt, color }) => {
                  const maxV      = Math.max(prev, curr, 1);
                  const diff      = curr - prev;
                  const pctChange = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>{label}</span>
                        <span className="font-mono text-[11px]"
                          style={{ color: diff >= 0 ? "#22d3a0" : "#f87171" }}>
                          {diff >= 0 ? "+" : ""}{prev > 0 ? `${pctChange}%` : "—"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { val: prev, lbl: MONTH_SHORT[data.prevMonth.month - 1], opacity: 0.45 },
                          { val: curr, lbl: MONTH_SHORT[month - 1],                opacity: 1    },
                        ].map(({ val, lbl, opacity }, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="font-mono text-[10px] w-8 text-right" style={{ color: "var(--text4)" }}>
                              {lbl}
                            </span>
                            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(val / maxV) * 100}%`, background: color, opacity }} />
                            </div>
                            <span className="font-mono text-[11px] w-10" style={{ color: "var(--text2)" }}>
                              {fmt(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="rounded-xl p-3"
                    style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Overtime</p>
                    <p className="font-syne font-bold text-[17px] mt-0.5" style={{ color: "#22d3a0" }}>
                      +{fmtH(data.overtimeH)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>Underwork</p>
                    <p className="font-syne font-bold text-[17px] mt-0.5" style={{ color: "#f87171" }}>
                      -{fmtH(data.underworkH)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

          </div>

        </div>
      )}
    </div>
  );
}