// app/dashboard/analysis/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
  ArrowUpDown, TrendingUp, TrendingDown, CheckCircle2,
  CalendarDays, Zap, Clock, Coffee, Flame, BarChart2,
  Calendar, List,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayData {
  day: number; dow: number;
  isWeekend: boolean; isFuture: boolean; isHoliday: boolean; hasEntry: boolean;
  productiveH: number; officeH: number; breakH: number; requiredH: number;
  entryTimeLocal: string | null; exitTimeLocal: string | null;
  notes: string; breaks: { type: string; duration: number }[];
}

interface WeekSummary {
  weekNum: number;
  days: DayData[];
  totalProductiveH: number;
  totalRequiredH: number;
}

interface AnalysisData {
  year: number; month: number; daysInMonth: number; dailyData: DayData[];
  totalLoggedDays: number; totalWorkDays: number; totalMissingDays: number;
  totalHolidays: number; totalProductiveH: number; totalOfficeH: number;
  totalBreakH: number; totalRequiredH: number;
  overtimeH: number; underworkH: number; consistencyScore: number;
  avgEntryTime: string | null; avgExitTime: string | null;
  earliestEntry: string | null; latestExit: string | null;
  bestDay: { day: number; productiveH: number } | null;
  worstDay: { day: number; productiveH: number } | null;
  currentStreak: number; longestStreak: number;
  prevMonth: { year: number; month: number; loggedDays: number; productiveH: number };
  breakBreakdown: {
    tea:    { count: number; totalH: number };
    lunch:  { count: number; totalH: number };
    custom: { count: number; totalH: number };
  };
  longestBreakMins: number; avgBreakMins: number; maxBreaksInDay: number;
  weeks?: WeekSummary[];
}

type SortKey   = "day" | "productiveH" | "breakH" | "entryTime" | "exitTime";
type SortDir   = "asc" | "desc";
type RowFilter = "all" | "logged" | "missed" | "overtime" | "underwork";
type ViewMode  = "monthly" | "weekly";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS    = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ROWS_PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtH(h: number): string {
  if (!h || h <= 0) return "—";
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function to12h(v: string | null): string {
  if (!v) return "—";
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "—";
  const h = +m[1], min = +m[2];
  return `${pad2(h % 12 || 12)}:${pad2(min)} ${h >= 12 ? "pm" : "am"}`;
}

function timeToMins(v: string | null): number {
  if (!v) return 0;
  const m = v.match(/^(\d{2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : 0;
}

function ordinal(n: number) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MonthNav({ year, month, onChange }: {
  year: number; month: number;
  onChange: (y: number, m: number) => void;
}) {
  const now = new Date(), ty = now.getFullYear(), tm = now.getMonth() + 1;
  const canNext = year < ty || (year === ty && month < tm);

  function nav(delta: number) {
    let m = month + delta, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    if (y > ty || (y === ty && m > tm)) return;
    onChange(y, m);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button onClick={() => nav(-1)}
        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer border-none transition-all"
        style={{ background: "var(--surface2)", color: "var(--text2)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text2)"; }}>
        <ChevronLeft size={13} />
      </button>
      <p className="font-mono font-bold text-[13px] min-w-[130px] text-center select-none"
        style={{ color: "var(--text)" }}>
        {MONTHS[month - 1]} {year}
      </p>
      <button onClick={() => canNext && nav(1)} disabled={!canNext}
        className="w-7 h-7 rounded-lg flex items-center justify-center border-none transition-all"
        style={{ background: "var(--surface2)", color: canNext ? "var(--text2)" : "var(--text4)", cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.3 }}
        onMouseEnter={e => { if (canNext) (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = canNext ? "var(--text2)" : "var(--text4)"; }}>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

function Card({ children, style = {}, className = "" }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest mb-3"
      style={{ color: "var(--text4)" }}>
      {children}
    </p>
  );
}

function StatCard({ label, value, sub, color, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  color: string; accent?: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {/* accent glow strip */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: color, opacity: 0.7 }} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--text4)" }}>
          {label}
        </span>
        {Icon && (
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: `${color}18` }}>
            <Icon size={12} style={{ color }} />
          </div>
        )}
      </div>
      <p className="font-mono font-extrabold text-[24px] sm:text-[28px] leading-none mt-1" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[10px] leading-snug" style={{ color: "var(--text3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function PBar({ value, max, color, height = 4 }: {
  value: number; max: number; color: string; height?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden"
      style={{ height, background: "var(--border2)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── COMPACT HEATMAP ──────────────────────────────────────────────────────────
function HeatmapCalendar({ days, year, month, maxH }: {
  days: DayData[]; year: number; month: number; maxH: number;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const firstDow = new Date(year, month - 1, 1).getDay();

  function cellBg(d: DayData): string {
    if (d.isHoliday) return "rgba(251,191,36,0.50)";
    if (d.isWeekend) return "var(--surface2)";
    if (d.isFuture)  return "var(--border)";
    if (!d.hasEntry) return "rgba(248,113,113,0.22)";
    const r = maxH > 0 ? d.productiveH / maxH : 0;
    if (r >= 0.9) return "#7c6ef3";
    if (r >= 0.7) return "rgba(124,110,243,0.65)";
    if (r >= 0.4) return "rgba(124,110,243,0.38)";
    return "rgba(124,110,243,0.18)";
  }

  const CELL_SIZE = 24;

  return (
    <div style={{ width: "100%" }}>
      {/* DOW headers */}
      <div className="grid grid-cols-7 mb-1" style={{ gap: 3 }}>
        {["S","M","T","W","T","F","S"].map((l, i) => (
          <div key={i} className="flex items-center justify-center"
            style={{ height: CELL_SIZE }}>
            <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7" style={{ gap: 3 }}>
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`empty-${i}`} style={{ height: CELL_SIZE }} />
        ))}
        {days.map(d => {
          const isHov = hov === d.day;
          return (
            <div key={d.day}
              className="relative flex items-center justify-center rounded-md select-none cursor-default"
              style={{
                height: CELL_SIZE,
                background: cellBg(d),
                border: isHov ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                transform: isHov ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.1s ease, border-color 0.1s ease",
                zIndex: isHov ? 10 : 1,
              }}
              onMouseEnter={() => setHov(d.day)}
              onMouseLeave={() => setHov(null)}
            >
              <span className="font-mono leading-none"
                style={{ fontSize: "8px", color: d.hasEntry && !d.isFuture ? "#fff" : "var(--text4)" }}>
                {d.day}
              </span>

              {/* Tooltip */}
              {isHov && (
                <div className="absolute z-30 bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-2 rounded-xl pointer-events-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border2)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                    minWidth: "130px",
                    whiteSpace: "nowrap",
                  }}>
                  <p className="font-mono text-[11px] font-bold" style={{ color: "var(--text)" }}>
                    {DOW_SHORT[d.dow]} {d.day} {MONTHS[month - 1].slice(0, 3)}
                  </p>
                  <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text3)" }}>
                    {d.isHoliday ? "🎉 Holiday"
                      : d.isWeekend ? "Weekend"
                      : d.isFuture  ? "Upcoming"
                      : !d.hasEntry ? "❌ Not logged"
                      : `✅ ${fmtH(d.productiveH)} productive`}
                  </p>
                  {d.hasEntry && !d.isHoliday && !d.isFuture && (
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text4)" }}>
                      {to12h(d.entryTimeLocal)} → {to12h(d.exitTimeLocal)}
                      {d.breakH > 0 ? ` · ${fmtH(d.breakH)} break` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { color: "#7c6ef3",                    label: "Full" },
          { color: "rgba(124,110,243,0.38)",     label: "Partial" },
          { color: "rgba(248,113,113,0.22)",     label: "Missed" },
          { color: "rgba(251,191,36,0.50)",      label: "Holiday" },
          { color: "var(--surface2)",            label: "Weekend" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0 inline-block" style={{ background: color }} />
            <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BAR CHART ────────────────────────────────────────────────────────────────
function BarChart({ days, maxH }: { days: DayData[]; maxH: number }) {
  const [hov, setHov] = useState<number | null>(null);
  const workDays = days.filter(d => !d.isWeekend);
  if (!workDays.length) return null;

  function barColor(d: DayData, isHov: boolean): string {
    if (isHov)      return "#a78bfa";
    if (d.isHoliday) return "#fbbf24";
    if (d.isFuture)  return "var(--border2)";
    if (!d.hasEntry) return "rgba(248,113,113,0.30)";
    return d.productiveH >= d.requiredH ? "#22d3a0" : "#7c6ef3";
  }

  return (
    <div>
      <div className="flex items-end gap-px" style={{ height: 96 }}>
        {workDays.map((d, i) => {
          const barH  = maxH > 0 ? Math.max(0, (d.productiveH / maxH) * 96) : 0;
          const refH  = maxH > 0 ? Math.max(0, (d.requiredH  / maxH) * 96) : 0;
          const isHov = hov === i;
          return (
            <div key={d.day}
              className="relative flex-1 flex flex-col justify-end cursor-pointer"
              style={{ height: 96, opacity: (d.isFuture || d.isWeekend) ? 0.25 : 1 }}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}>
              <div className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                style={{ height: Math.max(refH, 2), background: "rgba(124,110,243,0.10)" }} />
              <div className="relative rounded-t-sm transition-all duration-150"
                style={{
                  height: Math.max(barH, d.productiveH > 0 ? 2 : 0),
                  background: barColor(d, isHov),
                  zIndex: 1,
                  boxShadow: isHov ? `0 -4px 12px ${barColor(d, false)}80` : "none",
                }} />
              {isHov && (
                <div className="absolute z-20 bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl pointer-events-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 6px 20px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
                  <p className="font-mono text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                    {DOW_SHORT[d.dow]} {d.day} — {d.isHoliday ? "Holiday" : d.isFuture ? "Future" : !d.hasEntry ? "Missed" : fmtH(d.productiveH)}
                  </p>
                  {d.hasEntry && !d.isHoliday && (
                    <p className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>
                      {to12h(d.entryTimeLocal)} → {to12h(d.exitTimeLocal)} · target {fmtH(d.requiredH)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-px mt-1">
        {workDays.map((d, i) => (
          <div key={d.day} className="flex-1 text-center">
            <span className="font-mono text-[7px]"
              style={{ color: hov === i ? "var(--accent)" : "var(--text4)" }}>
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WEEKLY VIEW ──────────────────────────────────────────────────────────────
function WeeklyView({ weeks, maxH }: { weeks: WeekSummary[]; maxH: number }) {
  return (
    <div className="flex flex-col gap-3">
      {weeks.map((wk) => {
        const pct = wk.totalRequiredH > 0
          ? Math.min(100, Math.round((wk.totalProductiveH / wk.totalRequiredH) * 100))
          : 0;
        const isOver = wk.totalProductiveH >= wk.totalRequiredH;
        const color  = isOver ? "#22d3a0" : pct >= 70 ? "#7c6ef3" : "#f87171";
        const workDays = wk.days.filter(d => !d.isWeekend);
        const loggedInWeek = wk.days.filter(d => d.hasEntry && !d.isHoliday).length;

        return (
          <div key={wk.weekNum} className="rounded-xl p-4"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            {/* Week header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold"
                  style={{ background: `${color}18`, color }}>
                  Week {wk.weekNum}
                </span>
                <span className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>
                  {loggedInWeek} / {workDays.filter(d => !d.isFuture && !d.isHoliday).length} days logged
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] font-bold" style={{ color }}>
                  {fmtH(wk.totalProductiveH)}
                </span>
                <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>
                  / {fmtH(wk.totalRequiredH)}
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${color}18`, color }}>
                  {pct}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <PBar value={wk.totalProductiveH} max={wk.totalRequiredH} color={color} height={4} />

            {/* Daily mini-bars */}
            <div className="flex gap-1 mt-3">
              {wk.days.map(d => {
                if (d.isWeekend) return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm" style={{ height: 32, background: "var(--border)" }} />
                    <span className="font-mono text-[7px]" style={{ color: "var(--text4)" }}>{DOW_SHORT[d.dow]}</span>
                  </div>
                );
                const dH   = maxH > 0 ? Math.min(32, (d.productiveH / maxH) * 32) : 0;
                const dClr = d.isHoliday ? "#fbbf24" : d.isFuture ? "var(--border2)" : !d.hasEntry ? "rgba(248,113,113,0.35)" : d.productiveH >= d.requiredH ? "#22d3a0" : "#7c6ef3";
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm flex items-end"
                      style={{ height: 32, background: "var(--border)" }}>
                      <div className="w-full rounded-sm"
                        style={{ height: Math.max(d.productiveH > 0 ? 2 : 0, dH), background: dClr }} />
                    </div>
                    <span className="font-mono text-[7px]" style={{ color: "var(--text4)" }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DAILY LOG TABLE WITH PAGINATION ─────────────────────────────────────────
function DailyLogTable({ days, year, month }: {
  days: DayData[]; year: number; month: number;
}) {
  const [sort,   setSort]   = useState<{ key: SortKey; dir: SortDir }>({ key: "day", dir: "asc" });
  const [filter, setFilter] = useState<RowFilter>("all");
  const [page,   setPage]   = useState(1);

  function toggleSort(k: SortKey) {
    setSort(s => s.key === k ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" });
    setPage(1);
  }

  const allRows = useMemo(() => {
    let r = days.filter(d => !d.isWeekend && !d.isFuture);
    if (filter === "logged")    r = r.filter(d => d.hasEntry);
    if (filter === "missed")    r = r.filter(d => !d.hasEntry && !d.isHoliday);
    if (filter === "overtime")  r = r.filter(d => d.hasEntry && d.productiveH > d.requiredH);
    if (filter === "underwork") r = r.filter(d => d.hasEntry && d.productiveH < d.requiredH);
    return [...r].sort((a, b) => {
      let av = 0, bv = 0;
      if (sort.key === "day")         { av = a.day;         bv = b.day;         }
      if (sort.key === "productiveH") { av = a.productiveH; bv = b.productiveH; }
      if (sort.key === "breakH")      { av = a.breakH;      bv = b.breakH;      }
      if (sort.key === "entryTime")   { av = timeToMins(a.entryTimeLocal); bv = timeToMins(b.entryTimeLocal); }
      if (sort.key === "exitTime")    { av = timeToMins(a.exitTimeLocal);  bv = timeToMins(b.exitTimeLocal);  }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [days, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const rows       = allRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  function handleFilterChange(f: RowFilter) { setFilter(f); setPage(1); }

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => toggleSort(col)}
      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider cursor-pointer border-none bg-transparent whitespace-nowrap"
      style={{ color: sort.key === col ? "var(--accent)" : "var(--text3)" }}>
      {label}
      <ArrowUpDown size={9} style={{ opacity: sort.key === col ? 1 : 0.4 }} />
    </button>
  );

  const filterOpts: { k: RowFilter; label: string }[] = [
    { k: "all",       label: "All"        },
    { k: "logged",    label: "Logged"     },
    { k: "missed",    label: "Missed"     },
    { k: "overtime",  label: "Overtime"   },
    { k: "underwork", label: "Below target"},
  ];

  return (
    <div>
      {/* Filter pills + count */}
      <div className="flex flex-wrap gap-1.5 mb-4 items-center">
        {filterOpts.map(o => (
          <button key={o.k} onClick={() => handleFilterChange(o.k)}
            className="px-3 py-1 rounded-full font-mono text-[11px] cursor-pointer border-none transition-all"
            style={filter === o.k
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)" }}>
            {o.label}
          </button>
        ))}
        <span className="font-mono text-[10px] ml-auto" style={{ color: "var(--text4)" }}>
          {allRows.length} day{allRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: "560px" }}>
          <thead>
            <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              <th className="px-3 py-2.5 text-left"><SortBtn col="day"         label="Date"        /></th>
              <th className="px-3 py-2.5 text-left"><SortBtn col="entryTime"   label="In"          /></th>
              <th className="px-3 py-2.5 text-left"><SortBtn col="exitTime"    label="Out"         /></th>
              <th className="px-3 py-2.5 text-left"><SortBtn col="productiveH" label="Productive"  /></th>
              <th className="px-3 py-2.5 text-left"><SortBtn col="breakH"      label="Break"       /></th>
              <th className="px-3 py-2.5 text-left">
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text3)" }}>Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>No matching days</p>
                </td>
              </tr>
            ) : rows.map((d, idx) => {
              const isOT  = d.hasEntry && d.productiveH > d.requiredH;
              const isUW  = d.hasEntry && d.productiveH < d.requiredH;
              const pct   = d.requiredH > 0 ? Math.min(100, (d.productiveH / d.requiredH) * 100) : 0;
              const dateStr = new Date(year, month - 1, d.day)
                .toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
              return (
                <tr key={d.day}
                  className="transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: idx % 2 ? "var(--surface2)" : "transparent",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 ? "var(--surface2)" : "transparent"; }}
                >
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text)" }}>{dateStr}</p>
                    {d.isHoliday && (
                      <span className="font-mono text-[9px]" style={{ color: "#fbbf24" }}>Holiday</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[12px]"
                      style={{ color: d.entryTimeLocal ? "#7c6ef3" : "var(--text4)" }}>
                      {to12h(d.entryTimeLocal)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[12px]"
                      style={{ color: d.exitTimeLocal ? "#22d3a0" : "var(--text4)" }}>
                      {to12h(d.exitTimeLocal)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {d.hasEntry ? (
                      <div className="flex items-center gap-2">
                        <div className="rounded-full overflow-hidden" style={{ width: 40, height: 4, background: "var(--border)" }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: isOT ? "#22d3a0" : "#7c6ef3" }} />
                        </div>
                        <span className="font-mono text-[12px]"
                          style={{ color: isOT ? "#22d3a0" : "var(--text2)" }}>
                          {fmtH(d.productiveH)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[12px]"
                      style={{ color: d.breakH > 0 ? "#fbbf24" : "var(--text4)" }}>
                      {fmtH(d.breakH)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {!d.hasEntry && !d.isHoliday ? (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                        style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>Missed</span>
                    ) : d.isHoliday ? (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>Holiday</span>
                    ) : isOT ? (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                        style={{ background: "rgba(34,211,160,0.12)", color: "#22d3a0" }}>
                        +{fmtH(d.productiveH - d.requiredH)}
                      </span>
                    ) : isUW ? (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                        style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>
                        −{fmtH(d.requiredH - d.productiveH)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                        style={{ background: "rgba(34,211,160,0.10)", color: "#22d3a0" }}>On track</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <span className="font-mono text-[11px]" style={{ color: "var(--text4)" }}>
            Page {page} of {totalPages} · showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, allRows.length)} of {allRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all font-mono text-[10px]"
              style={{ background: "var(--surface2)", color: page === 1 ? "var(--text4)" : "var(--text2)", opacity: page === 1 ? 0.4 : 1 }}>
              «
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
              style={{ background: "var(--surface2)", color: page === 1 ? "var(--text4)" : "var(--text2)", opacity: page === 1 ? 0.4 : 1 }}>
              <ChevronLeft size={12} />
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3)  p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer font-mono text-[11px] transition-all"
                  style={{
                    background: page === p ? "var(--accent)" : "var(--surface2)",
                    color:      page === p ? "#fff" : "var(--text2)",
                  }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
              style={{ background: "var(--surface2)", color: page === totalPages ? "var(--text4)" : "var(--text2)", opacity: page === totalPages ? 0.4 : 1 }}>
              <ChevronRight size={12} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all font-mono text-[10px]"
              style={{ background: "var(--surface2)", color: page === totalPages ? "var(--text4)" : "var(--text2)", opacity: page === totalPages ? 0.4 : 1 }}>
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TILE ─────────────────────────────────────────────────────────────────────
function Tile({ label, value, color = "var(--text)" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <p className="font-mono text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text4)" }}>{label}</p>
      <p className="font-mono font-bold text-[15px]" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth() + 1);
  const [data,     setData]     = useState<AnalysisData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true); setError("");
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

  useEffect(() => { load(year, month); }, [year, month, load]);

  function handleMonth(y: number, m: number) { setYear(y); setMonth(m); }

  const maxH = useMemo(() => {
    if (!data) return 10;
    return Math.max(...data.dailyData.map(d => Math.max(d.productiveH, d.requiredH)), 1);
  }, [data]);

  const attendancePct = data?.totalWorkDays
    ? Math.round((data.totalLoggedDays / data.totalWorkDays) * 100) : 0;

  const scoreColor = !data ? "var(--text)"
    : data.consistencyScore >= 90 ? "#22d3a0"
    : data.consistencyScore >= 75 ? "#7c6ef3"
    : data.consistencyScore >= 60 ? "#fbbf24"
    : "#f87171";

  // Build weeks client-side if API doesn't provide them
  const weeks: WeekSummary[] = useMemo(() => {
    if (!data) return [];
    if (data.weeks && data.weeks.length > 0) return data.weeks;
    const wks: WeekSummary[] = [];
    for (let i = 0; i < data.dailyData.length; i += 7) {
      const slice = data.dailyData.slice(i, i + 7);
      const wReq  = slice.reduce((a, d) => {
        if (d.isFuture || d.isHoliday) return a;
        if (d.isWeekend && !d.hasEntry) return a;
        return a + d.requiredH;
      }, 0);
      wks.push({
        weekNum: wks.length + 1,
        days: slice,
        totalProductiveH: Math.round(slice.reduce((a, d) => a + d.productiveH, 0) * 100) / 100,
        totalRequiredH:   Math.round(wReq * 100) / 100,
      });
    }
    return wks;
  }, [data]);

  const isEmpty = !loading && !error && data && data.totalLoggedDays === 0;

  return (
    <div className="max-w-5xl mx-auto pb-12" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono font-extrabold text-[20px] sm:text-[24px] tracking-tight"
            style={{ color: "var(--text)" }}>
            Work Analytics
          </h1>
          <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text3)" }}>
            {MONTHS[month - 1]} {year} · productivity overview
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthNav year={year} month={month} onChange={handleMonth} />
          <button onClick={() => load(year, month)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[12px] cursor-pointer transition-all border-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)" }}>
          <AlertCircle size={15} style={{ color: "#f87171", flexShrink: 0 }} />
          <p className="font-mono text-[12px]" style={{ color: "#f87171" }}>{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl animate-pulse"
                style={{ height: 100, background: "var(--surface)", border: "1px solid var(--border)" }} />
            ))}
          </div>
          <div className="rounded-2xl animate-pulse"
            style={{ height: 200, background: "var(--surface)", border: "1px solid var(--border)" }} />
        </div>
      )}

      {/* ── Empty ── */}
      {isEmpty && (
        <div className="rounded-2xl py-20 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <BarChart2 size={36} style={{ color: "var(--text4)", margin: "0 auto 12px" }} />
          <p className="font-mono font-bold text-[16px]" style={{ color: "var(--text)" }}>
            No logs for {MONTHS[month - 1]} {year}
          </p>
          <p className="font-mono text-[12px] mt-2" style={{ color: "var(--text3)" }}>
            Start tracking your work days to see analytics here.
          </p>
        </div>
      )}

      {/* ── Main content ── */}
      {!loading && !error && data && data.totalLoggedDays > 0 && (
        <>
          {/* ── Key Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Days Logged"
              value={`${data.totalLoggedDays}/${data.totalWorkDays}`}
              sub={`${attendancePct}% attendance · ${data.totalMissingDays} missed`}
              color={attendancePct === 100 ? "#22d3a0" : attendancePct >= 80 ? "#7c6ef3" : "#f87171"}
              icon={CalendarDays}
            />
            <StatCard
              label="Productive"
              value={fmtH(data.totalProductiveH)}
              sub={`of ${fmtH(data.totalRequiredH)} required`}
              color="#7c6ef3"
              icon={Zap}
            />
            <StatCard
              label="Consistency"
              value={`${data.consistencyScore}%`}
              sub={data.consistencyScore >= 90 ? "Excellent ✦" : data.consistencyScore >= 75 ? "Good" : data.consistencyScore >= 60 ? "Needs work" : "Below target"}
              color={scoreColor}
              icon={CheckCircle2}
            />
            <StatCard
              label={data.overtimeH > 0 ? "Overtime" : "Shortfall"}
              value={fmtH(data.overtimeH > 0 ? data.overtimeH : data.underworkH)}
              sub={data.overtimeH > 0 ? "extra this month" : "below required"}
              color={data.overtimeH > 0 ? "#22d3a0" : data.underworkH > 10 ? "#f87171" : "#fbbf24"}
              icon={data.overtimeH > 0 ? TrendingUp : TrendingDown}
            />
          </div>

          {/* ── View toggle + Chart / Heatmap ── */}
          <Card>
            {/* Section header with toggle */}
            <div className="flex items-center justify-between mb-4 pb-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="font-mono font-semibold text-[13px]" style={{ color: "var(--text)" }}>
                  {viewMode === "monthly" ? "Monthly Overview" : "Weekly Breakdown"}
                </p>
                <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text3)" }}>
                  {viewMode === "monthly"
                    ? "Daily bar chart + calendar heatmap"
                    : "Performance breakdown by week"}
                </p>
              </div>
              {/* View mode toggle */}
              <div className="flex items-center rounded-xl p-0.5"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <button onClick={() => setViewMode("monthly")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none cursor-pointer font-mono text-[11px] transition-all"
                  style={{
                    background: viewMode === "monthly" ? "var(--accent)" : "transparent",
                    color:      viewMode === "monthly" ? "#fff" : "var(--text3)",
                  }}>
                  <Calendar size={11} /> Monthly
                </button>
                <button onClick={() => setViewMode("weekly")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-none cursor-pointer font-mono text-[11px] transition-all"
                  style={{
                    background: viewMode === "weekly" ? "var(--accent)" : "transparent",
                    color:      viewMode === "weekly" ? "#fff" : "var(--text3)",
                  }}>
                  <List size={11} /> Weekly
                </button>
              </div>
            </div>

            {viewMode === "monthly" ? (
              <div className="flex flex-col gap-5 lg:flex-row">
                {/* Bar chart — takes most space */}
                <div className="flex-1 min-w-0">
                  <SectionLabel>Daily Productive Hours</SectionLabel>
                  <BarChart days={data.dailyData} maxH={maxH} />
                  {/* Chart legend */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {[
                      { color: "#22d3a0",                   label: "On / over target" },
                      { color: "#7c6ef3",                   label: "Under target"     },
                      { color: "rgba(248,113,113,0.30)",    label: "Missed"           },
                      { color: "#fbbf24",                   label: "Holiday"          },
                      { color: "rgba(124,110,243,0.10)",    label: "Required (ghost)" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0 inline-block" style={{ background: color }} />
                        <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact heatmap — fixed width */}
                <div style={{ flexShrink: 0, width: "100%", maxWidth: "220px" }} className="mx-auto lg:mx-0">
                  <SectionLabel>Month Heatmap</SectionLabel>
                  <HeatmapCalendar
                    days={data.dailyData}
                    year={year}
                    month={month}
                    maxH={maxH}
                  />
                </div>
              </div>
            ) : (
              <WeeklyView weeks={weeks} maxH={maxH} />
            )}
          </Card>

          {/* ── Secondary Stats ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Timing card */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <Clock size={13} style={{ color: "var(--accent)" }} />
                <p className="font-mono font-semibold text-[12px]" style={{ color: "var(--text)" }}>Entry / Exit Timing</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Avg Entry"      value={to12h(data.avgEntryTime)}  color="#7c6ef3" />
                <Tile label="Avg Exit"       value={to12h(data.avgExitTime)}   color="#22d3a0" />
                <Tile label="Earliest In"    value={to12h(data.earliestEntry)} color="#fbbf24" />
                <Tile label="Latest Out"     value={to12h(data.latestExit)}    color="#f87171" />
              </div>
            </Card>

            {/* Highlights */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <Flame size={13} style={{ color: "#f87171" }} />
                <p className="font-mono font-semibold text-[12px]" style={{ color: "var(--text)" }}>Highlights</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Current Streak" value={`${data.currentStreak}d`} color="#f87171" />
                <Tile label="Longest Streak" value={`${data.longestStreak}d`} color="#fbbf24" />
                <Tile label="Best Day"
                  value={data.bestDay ? `${ordinal(data.bestDay.day)}` : "—"}
                  color="#22d3a0" />
                <Tile label="Best Hours"
                  value={data.bestDay ? fmtH(data.bestDay.productiveH) : "—"}
                  color="#22d3a0" />
              </div>
            </Card>

            {/* Breaks */}
            <Card>
              <div className="flex items-center gap-2 mb-3 pb-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <Coffee size={13} style={{ color: "#fbbf24" }} />
                <p className="font-mono font-semibold text-[12px]" style={{ color: "var(--text)" }}>Break Summary</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Tea / Coffee", count: data.breakBreakdown.tea.count,    h: data.breakBreakdown.tea.totalH,    color: "#fbbf24" },
                  { label: "Lunch",        count: data.breakBreakdown.lunch.count,  h: data.breakBreakdown.lunch.totalH,  color: "#22d3a0" },
                  { label: "Custom",       count: data.breakBreakdown.custom.count, h: data.breakBreakdown.custom.totalH, color: "#a78bfa" },
                ].map(b => {
                  const total = data.breakBreakdown.tea.count + data.breakBreakdown.lunch.count + data.breakBreakdown.custom.count;
                  return (
                    <div key={b.label}>
                      <div className="flex justify-between mb-1">
                        <span className="font-mono text-[11px]" style={{ color: "var(--text2)" }}>{b.label}</span>
                        <span className="font-mono text-[11px]" style={{ color: b.color }}>
                          {b.count}× · {fmtH(b.h)}
                        </span>
                      </div>
                      <PBar value={b.count} max={Math.max(total, 1)} color={b.color} height={3} />
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Tile label="Avg break"    value={`${data.avgBreakMins}m`} />
                  <Tile label="Longest"      value={`${data.longestBreakMins}m`} />
                </div>
              </div>
            </Card>
          </div>

          {/* ── Daily Log Table ── */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-3"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <BarChart2 size={13} style={{ color: "var(--accent)" }} />
              <p className="font-mono font-semibold text-[13px]" style={{ color: "var(--text)" }}>Daily Log</p>
              <span className="font-mono text-[10px] ml-auto" style={{ color: "var(--text4)" }}>
                sort by any column · 10 days / page
              </span>
            </div>
            <DailyLogTable days={data.dailyData} year={year} month={month} />
          </Card>
        </>
      )}
    </div>
  );
}