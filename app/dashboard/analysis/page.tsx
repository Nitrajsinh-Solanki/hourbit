// app/dashboard/analysis/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, Cell,
} from "recharts";
import {
  ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
  ArrowUpDown, TrendingUp, TrendingDown, CheckCircle2,
  CalendarDays, Clock, Coffee, BarChart2,
  Zap, Target, Award, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayData {
  day: number; dow: number;
  isWeekend: boolean; isFuture: boolean; isHoliday: boolean; hasEntry: boolean;
  productiveH: number; officeH: number; breakH: number; requiredH: number;
  entryTimeLocal: string | null; exitTimeLocal: string | null;
  notes: string; breaks: { type: string; duration: number }[];
}
interface WeekSummary { weekNum: number; days: DayData[]; totalProductiveH: number; totalRequiredH: number; }
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

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ROWS_PER_PAGE = 8;
const ACCENT = "#7c6ef3";
const GREEN  = "#22d3a0";
const AMBER  = "#f59e0b";
const DANGER = "#f87171";
const BLUE   = "#38bdf8";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
function fmtH(h: number): string {
  if (!h || h <= 0) return "—";
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
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
function fmtMins(m: number) {
  const h = Math.floor(m / 60), min = m % 60;
  if (h === 0) return `${min}m`;
  return `${h}:${pad2(min)}`;
}

// ─── Month Nav ────────────────────────────────────────────────────────────────
function MonthNav({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const now = new Date(), ty = now.getFullYear(), tm = now.getMonth() + 1;
  const canNext = year < ty || (year === ty && month < tm);
  function nav(delta: number) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (y > ty || (y === ty && m > tm)) return;
    onChange(y, m);
  }
  return (
    <div className="flex items-center gap-1 rounded-xl px-1.5 py-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
      <button onClick={() => nav(-1)}
        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none transition-all"
        style={{ background: "transparent", color: "var(--text3)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT; (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text3)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <ChevronLeft size={14} />
      </button>
      <span className="font-mono font-bold text-[13px] min-w-[132px] text-center select-none"
        style={{ color: "var(--text)" }}>
        {MONTHS[month - 1]} {year}
      </span>
      <button onClick={() => canNext && nav(1)} disabled={!canNext}
        className="w-8 h-8 rounded-lg flex items-center justify-center border-none transition-all"
        style={{ background: "transparent", color: canNext ? "var(--text3)" : "var(--text4)", cursor: canNext ? "pointer" : "not-allowed", opacity: canNext ? 1 : 0.3 }}
        onMouseEnter={e => { if (canNext) { (e.currentTarget as HTMLElement).style.color = ACCENT; (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.1)"; } }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = canNext ? "var(--text3)" : "var(--text4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2.5" style={{
      background: "var(--surface)",
      border: "1px solid var(--border2)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      {label && <p className="font-mono text-[11px] mb-1.5 font-semibold" style={{ color: "var(--text3)" }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color || p.fill }} />
          <span className="font-mono text-[11px]" style={{ color: "var(--text2)" }}>
            {p.name && <span style={{ color: "var(--text3)" }}>{p.name}: </span>}
            <span style={{ color: "var(--text)", fontWeight: 700 }}>
              {formatter ? formatter(p.value, p.name) : p.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden flex flex-col gap-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, ${color}00, ${color}cc, ${color}00)` }} />
      <div className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${color}18 0%, transparent 70%)` }} />
      <div className="flex items-start justify-between relative">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text4)" }}>{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, border: `1px solid ${color}25` }}>
            <Icon size={13} style={{ color }} />
          </div>
        )}
      </div>
      <p className="font-mono font-black text-[28px] sm:text-[32px] leading-none tracking-tight relative"
        style={{ color, letterSpacing: "-0.02em" }}>{value}</p>
      {sub && (
        <div className="flex items-center gap-2 relative">
          <p className="font-mono text-[11px] leading-snug flex-1" style={{ color: "var(--text4)" }}>{sub}</p>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, sub, color = ACCENT }: {
  icon: React.ElementType; title: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}1a`, border: `1px solid ${color}28` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <p className="font-mono font-bold text-[13px]" style={{ color: "var(--text)" }}>{title}</p>
        {sub && <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text4)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", ...style }}>
      {children}
    </div>
  );
}

// ─── Radial Progress ──────────────────────────────────────────────────────────
function RadialProgress({ value, color, size = 84, label }: {
  value: number; color: string; size?: number; label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={{ width: size, height: size, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%"
            startAngle={90} endAngle={-270} data={[{ value }]}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: "var(--surface2)" }} dataKey="value" cornerRadius={8} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-black text-[14px]" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-widest text-center" style={{ color: "var(--text4)" }}>{label}</span>
    </div>
  );
}

// ─── Heatmap Calendar ─────────────────────────────────────────────────────────
function HeatmapCalendar({ days, year, month, maxH }: { days: DayData[]; year: number; month: number; maxH: number }) {
  const [hov, setHov] = useState<number | null>(null);
  const firstDow = new Date(year, month - 1, 1).getDay();
  function cellBg(d: DayData): string {
    if (d.isHoliday) return "rgba(245,158,11,0.55)";
    if (d.isWeekend) return "var(--surface2)";
    if (d.isFuture)  return "rgba(255,255,255,0.04)";
    if (!d.hasEntry) return "rgba(248,113,113,0.25)";
    const r = maxH > 0 ? d.productiveH / maxH : 0;
    if (r >= 0.9) return ACCENT;
    if (r >= 0.7) return "rgba(124,110,243,0.70)";
    if (r >= 0.4) return "rgba(124,110,243,0.40)";
    return "rgba(124,110,243,0.20)";
  }
  return (
    <div>
      <div className="grid grid-cols-7 mb-1.5" style={{ gap: 4 }}>
        {["S","M","T","W","T","F","S"].map((l, i) => (
          <div key={i} className="flex items-center justify-center h-5">
            <span className="font-mono text-[9px] font-bold" style={{ color: "var(--text4)" }}>{l}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gap: 4 }}>
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} className="h-7" />)}
        {days.map(d => {
          const isHov = hov === d.day;
          return (
            <div key={d.day}
              className="relative flex items-center justify-center rounded-lg select-none cursor-default"
              style={{
                height: 28, background: cellBg(d),
                border: isHov ? `1.5px solid ${ACCENT}` : "1.5px solid transparent",
                transform: isHov ? "scale(1.18)" : "scale(1)",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                zIndex: isHov ? 10 : 1,
                boxShadow: isHov ? `0 0 14px ${ACCENT}55` : "none",
              }}
              onMouseEnter={() => setHov(d.day)} onMouseLeave={() => setHov(null)}>
              <span className="font-mono leading-none"
                style={{ fontSize: "9px", fontWeight: 700, color: d.hasEntry && !d.isFuture ? "#fff" : "var(--text4)" }}>
                {d.day}
              </span>
              {isHov && (
                <div className="absolute z-30 bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 rounded-xl pointer-events-none"
                  style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 12px 32px rgba(0,0,0,0.4)", minWidth: 148, whiteSpace: "nowrap" }}>
                  <p className="font-mono text-[11px] font-bold" style={{ color: "var(--text)" }}>
                    {DOW_SHORT[d.dow]}, {MONTHS[month-1].slice(0,3)} {d.day}
                  </p>
                  <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text3)" }}>
                    {d.isHoliday ? "🎉 Holiday" : d.isWeekend ? "Weekend" : d.isFuture ? "Upcoming" : !d.hasEntry ? "❌ Not logged" : `✅ ${fmtH(d.productiveH)}`}
                  </p>
                  {d.hasEntry && !d.isHoliday && !d.isFuture && (
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text4)" }}>
                      {to12h(d.entryTimeLocal)} → {to12h(d.exitTimeLocal)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { color: ACCENT, label: "Full" },
          { color: "rgba(124,110,243,0.40)", label: "Partial" },
          { color: "rgba(248,113,113,0.25)", label: "Missed" },
          { color: "rgba(245,158,11,0.55)", label: "Holiday" },
          { color: "var(--surface2)", label: "Weekend" },
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

// ─── Daily Log Table ──────────────────────────────────────────────────────────
function DailyLogTable({ days, year, month }: { days: DayData[]; year: number; month: number }) {
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
      if (sort.key === "day")         { av = a.day;         bv = b.day; }
      if (sort.key === "productiveH") { av = a.productiveH; bv = b.productiveH; }
      if (sort.key === "breakH")      { av = a.breakH;      bv = b.breakH; }
      if (sort.key === "entryTime")   { av = timeToMins(a.entryTimeLocal); bv = timeToMins(b.entryTimeLocal); }
      if (sort.key === "exitTime")    { av = timeToMins(a.exitTimeLocal);  bv = timeToMins(b.exitTimeLocal); }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [days, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
  const rows = allRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => toggleSort(col)}
      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider cursor-pointer border-none bg-transparent"
      style={{ color: sort.key === col ? ACCENT : "var(--text4)" }}>
      {label}<ArrowUpDown size={9} style={{ opacity: sort.key === col ? 1 : 0.4 }} />
    </button>
  );

  const filterOpts: { k: RowFilter; label: string }[] = [
    { k: "all", label: "All" }, { k: "logged", label: "Logged" },
    { k: "missed", label: "Missed" }, { k: "overtime", label: "Overtime" },
    { k: "underwork", label: "Below target" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5 items-center">
        {filterOpts.map(o => (
          <button key={o.k} onClick={() => { setFilter(o.k); setPage(1); }}
            className="px-3 py-1.5 rounded-full font-mono text-[11px] cursor-pointer border-none transition-all"
            style={filter === o.k
              ? { background: ACCENT, color: "#fff", boxShadow: `0 0 12px ${ACCENT}55` }
              : { background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
            {o.label}
          </button>
        ))}
        <span className="font-mono text-[10px] ml-auto" style={{ color: "var(--text4)" }}>
          {allRows.length} day{allRows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                {[
                  { col: "day" as SortKey,         label: "Date"       },
                  { col: "entryTime" as SortKey,   label: "In"         },
                  { col: "exitTime" as SortKey,    label: "Out"        },
                  { col: "productiveH" as SortKey, label: "Productive" },
                  { col: "breakH" as SortKey,      label: "Break"      },
                ].map(({ col, label }) => (
                  <th key={col} className="px-4 py-3 text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                    <SortBtn col={col} label={label} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--text4)" }}>Status</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <p className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>No matching days</p>
                </td></tr>
              ) : rows.map((d, idx) => {
                const isOT = d.hasEntry && d.productiveH > d.requiredH;
                const isUW = d.hasEntry && d.productiveH < d.requiredH;
                const pct  = d.requiredH > 0 ? Math.min(100, (d.productiveH / d.requiredH) * 100) : 0;
                const dateStr = new Date(year, month - 1, d.day)
                  .toLocaleDateString("en-IN", { day: "2-digit", month: "short", weekday: "short" });
                return (
                  <tr key={d.day}
                    style={{ borderBottom: "1px solid var(--border)", background: idx % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.06)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 ? "rgba(255,255,255,0.015)" : "transparent"; }}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text)" }}>{dateStr}</p>
                      {d.isHoliday && <span className="font-mono text-[9px]" style={{ color: AMBER }}>Holiday</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px]" style={{ color: d.entryTimeLocal ? ACCENT : "var(--text4)" }}>{to12h(d.entryTimeLocal)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px]" style={{ color: d.exitTimeLocal ? GREEN : "var(--text4)" }}>{to12h(d.exitTimeLocal)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {d.hasEntry ? (
                        <div className="flex items-center gap-2.5">
                          <div className="rounded-full overflow-hidden" style={{ width: 48, height: 4, background: "var(--surface2)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isOT ? GREEN : ACCENT }} />
                          </div>
                          <span className="font-mono text-[12px] font-semibold" style={{ color: isOT ? GREEN : "var(--text2)" }}>
                            {fmtH(d.productiveH)}
                          </span>
                        </div>
                      ) : <span className="font-mono text-[12px]" style={{ color: "var(--text4)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px]" style={{ color: d.breakH > 0 ? AMBER : "var(--text4)" }}>{fmtH(d.breakH)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {!d.hasEntry && !d.isHoliday ? (
                        <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: "rgba(248,113,113,0.12)", color: DANGER }}>Missed</span>
                      ) : d.isHoliday ? (
                        <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: "rgba(245,158,11,0.12)", color: AMBER }}>Holiday</span>
                      ) : isOT ? (
                        <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: "rgba(34,211,160,0.12)", color: GREEN }}>+{fmtH(d.productiveH - d.requiredH)}</span>
                      ) : isUW ? (
                        <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: "rgba(248,113,113,0.08)", color: DANGER }}>−{fmtH(d.requiredH - d.productiveH)}</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold"
                          style={{ background: "rgba(34,211,160,0.10)", color: GREEN }}>On track</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <span className="font-mono text-[11px]" style={{ color: "var(--text4)" }}>
            Page {page} / {totalPages} · {(page-1)*ROWS_PER_PAGE+1}–{Math.min(page*ROWS_PER_PAGE,allRows.length)} of {allRows.length}
          </span>
          <div className="flex items-center gap-1">
            {[{ l:"«", a:()=>setPage(1), d:page===1 },{ l:"‹", a:()=>setPage(p=>Math.max(1,p-1)), d:page===1 }].map(({l,a,d})=>(
              <button key={l} onClick={a} disabled={d}
                className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer font-mono text-[12px]"
                style={{ background:"var(--surface2)", color: d?"var(--text4)":"var(--text2)", opacity:d?0.4:1 }}>{l}</button>
            ))}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages<=5) p=i+1;
              else if (page<=3) p=i+1;
              else if (page>=totalPages-2) p=totalPages-4+i;
              else p=page-2+i;
              return (
                <button key={p} onClick={()=>setPage(p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer font-mono text-[11px] transition-all"
                  style={{ background:page===p?ACCENT:"var(--surface2)", color:page===p?"#fff":"var(--text2)", boxShadow:page===p?`0 0 10px ${ACCENT}55`:"none" }}>
                  {p}
                </button>
              );
            })}
            {[{ l:"›", a:()=>setPage(p=>Math.min(totalPages,p+1)), d:page===totalPages },{ l:"»", a:()=>setPage(totalPages), d:page===totalPages }].map(({l,a,d})=>(
              <button key={l} onClick={a} disabled={d}
                className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer font-mono text-[12px]"
                style={{ background:"var(--surface2)", color:d?"var(--text4)":"var(--text2)", opacity:d?0.4:1 }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/work/analysis?year=${y}&month=${m}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message ?? "Failed to load");
    } catch { setError("Network error — please try again"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(year, month); }, [year, month, load]);

  const maxH = useMemo(() => {
    if (!data) return 10;
    return Math.max(...data.dailyData.map(d => Math.max(d.productiveH, d.requiredH)), 1);
  }, [data]);

  // Chart data
  const dailyChartData = useMemo(() => {
    if (!data) return [];
    return data.dailyData.filter(d => !d.isWeekend && !d.isFuture && !d.isHoliday).map(d => ({
      name: `${DOW_SHORT[d.dow]} ${d.day}`,
      productive: Math.round(d.productiveH * 100) / 100,
      required: Math.round(d.requiredH * 100) / 100,
      break: Math.round(d.breakH * 100) / 100,
      status: !d.hasEntry ? "missed" : d.productiveH >= d.requiredH ? "over" : "under",
    }));
  }, [data]);

  const weeklyChartData = useMemo(() => {
    if (!data) return [];
    const weeks = data.weeks?.length ? data.weeks : buildWeeks(data.dailyData);
    return weeks.map(w => ({
      name: `W${w.weekNum}`,
      productive: Math.round(w.totalProductiveH * 100) / 100,
      required: Math.round(w.totalRequiredH * 100) / 100,
      pct: w.totalRequiredH > 0 ? Math.round((w.totalProductiveH / w.totalRequiredH) * 100) : 0,
    }));
  }, [data]);

  const timingData = useMemo(() => {
    if (!data) return [];
    return data.dailyData.filter(d => d.hasEntry && !d.isHoliday && !d.isFuture).map(d => ({
      name: `${DOW_SHORT[d.dow]} ${d.day}`,
      entry: timeToMins(d.entryTimeLocal),
      exit: timeToMins(d.exitTimeLocal),
    }));
  }, [data]);

  function buildWeeks(days: DayData[]): WeekSummary[] {
    const wks: WeekSummary[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7);
      const wReq = slice.reduce((a, d) => {
        if (d.isFuture || d.isHoliday || (d.isWeekend && !d.hasEntry)) return a;
        return a + d.requiredH;
      }, 0);
      wks.push({ weekNum: wks.length + 1, days: slice, totalProductiveH: Math.round(slice.reduce((a,d)=>a+d.productiveH,0)*100)/100, totalRequiredH: Math.round(wReq*100)/100 });
    }
    return wks;
  }

  const attendancePct = data?.totalWorkDays ? Math.round((data.totalLoggedDays / data.totalWorkDays) * 100) : 0;
  const scoreColor = !data ? "var(--text)" : data.consistencyScore >= 90 ? GREEN : data.consistencyScore >= 75 ? ACCENT : data.consistencyScore >= 60 ? AMBER : DANGER;
  const isEmpty = !loading && !error && data && data.totalLoggedDays === 0;

  return (
    <div className="max-w-6xl mx-auto pb-16" style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <style>{`
        .ana-fade { animation: ana-fadein 0.4s ease both; }
        @keyframes ana-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .ana-d1 { animation-delay:0.04s; } .ana-d2 { animation-delay:0.10s; }
        .ana-d3 { animation-delay:0.16s; } .ana-d4 { animation-delay:0.22s; }
        .ana-d5 { animation-delay:0.28s; } .recharts-tooltip-wrapper { outline:none!important; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ana-fade">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background:`${ACCENT}18`, border:`1px solid ${ACCENT}28` }}>
            <Activity size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="font-mono font-black text-[22px] sm:text-[25px] tracking-tight"
              style={{ color:"var(--text)", letterSpacing:"-0.02em" }}>Work Analytics</h1>
            <p className="font-mono text-[11px]" style={{ color:"var(--text4)" }}>
              {MONTHS[month-1]} {year} · deep productivity insight
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthNav year={year} month={month} onChange={(y,m)=>{ setYear(y); setMonth(m); }} />
          <button onClick={()=>load(year,month)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[12px] cursor-pointer transition-all border-none"
            style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text3)" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=ACCENT;(e.currentTarget as HTMLElement).style.color=ACCENT;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--text3)";}}>
            <RefreshCw size={11} className={loading?"animate-spin":""} />Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl ana-fade"
          style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.22)" }}>
          <AlertCircle size={15} style={{ color:DANGER, flexShrink:0 }} />
          <p className="font-mono text-[12px]" style={{ color:DANGER }}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i=><div key={i} className="rounded-2xl animate-pulse" style={{ height:110, background:"var(--surface)" }} />)}
          </div>
          {[220,280,200].map((h,i)=><div key={i} className="rounded-2xl animate-pulse" style={{ height:h, background:"var(--surface)" }} />)}
        </div>
      )}

      {isEmpty && (
        <div className="rounded-2xl py-24 text-center" style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
          <BarChart2 size={40} style={{ color:"var(--text4)", margin:"0 auto 16px" }} />
          <p className="font-mono font-bold text-[17px]" style={{ color:"var(--text)" }}>No logs for {MONTHS[month-1]} {year}</p>
          <p className="font-mono text-[12px] mt-2" style={{ color:"var(--text3)" }}>Start tracking your work days to see analytics here.</p>
        </div>
      )}

      {!loading && !error && data && data.totalLoggedDays > 0 && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 ana-fade ana-d1">
            <KpiCard label="Attendance" value={`${attendancePct}%`}
              sub={`${data.totalLoggedDays} of ${data.totalWorkDays} days · ${data.totalMissingDays} missed`}
              color={attendancePct===100?GREEN:attendancePct>=80?ACCENT:DANGER} icon={CalendarDays} />
            <KpiCard label="Productive Hours" value={fmtH(data.totalProductiveH)}
              sub={`of ${fmtH(data.totalRequiredH)} required`} color={ACCENT} icon={Zap} />
            <KpiCard label="Consistency Score" value={`${data.consistencyScore}%`}
              sub={data.consistencyScore>=90?"Excellent ✦":data.consistencyScore>=75?"Good":data.consistencyScore>=60?"Needs work":"Below target"}
              color={scoreColor} icon={CheckCircle2} />
            <KpiCard
              label={data.overtimeH>0?"Overtime Banked":"Hours Shortfall"}
              value={fmtH(data.overtimeH>0?data.overtimeH:data.underworkH)}
              sub={data.overtimeH>0?"extra hours this month":"below target this month"}
              color={data.overtimeH>0?GREEN:data.underworkH>10?DANGER:AMBER}
              icon={data.overtimeH>0?TrendingUp:TrendingDown} />
          </div>

          {/* Daily Area Chart */}
          <Panel className="ana-fade ana-d2">
            <SectionHeader icon={BarChart2} title="Daily Productive Hours" sub="Each work day vs your required target" />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChartData} margin={{ top:10, right:8, left:-20, bottom:0 }}>
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:"var(--text4)", fontSize:9, fontFamily:"monospace" }}
                  axisLine={false} tickLine={false} interval={Math.floor(dailyChartData.length/8)} />
                <YAxis tick={{ fill:"var(--text4)", fontSize:9, fontFamily:"monospace" }}
                  axisLine={false} tickLine={false} tickFormatter={v=>`${v}h`} />
                <Tooltip content={<ChartTooltip formatter={(v:number)=>`${v}h`} />} />
                <Area type="monotone" dataKey="required" name="Required" stroke={GREEN}
                  strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gReq)" dot={false} />
                <Area type="monotone" dataKey="productive" name="Productive" stroke={ACCENT}
                  strokeWidth={2} fill="url(#gProd)"
                  dot={(props:any)=>{
                    const {cx,cy,payload} = props;
                    if (!payload.productive) return <circle key={props.key} cx={cx} cy={cy} r={0}/>;
                    const c = payload.status==="over"?GREEN:payload.status==="missed"?DANGER:ACCENT;
                    return <circle key={props.key} cx={cx} cy={cy} r={3} fill={c} stroke="var(--surface)" strokeWidth={1.5}/>;
                  }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {[{color:ACCENT,label:"Productive"},{color:GREEN,label:"Required (target)"},{color:DANGER,label:"Missed"}].map(({color,label})=>(
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background:color }} />
                  <span className="font-mono text-[9px]" style={{ color:"var(--text4)" }}>{label}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Mid Row: Weekly + Radials + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 ana-fade ana-d3">

            {/* Weekly bars */}
            <Panel>
              <SectionHeader icon={Target} title="Weekly Summary" sub="Productive vs required per week" color={BLUE} />
              {weeklyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyChartData} margin={{ top:5, right:5, left:-24, bottom:0 }} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill:"var(--text4)", fontSize:10, fontFamily:"monospace" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:"var(--text4)", fontSize:9, fontFamily:"monospace" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}h`} />
                    <Tooltip content={<ChartTooltip formatter={(v:number)=>`${v}h`} />} />
                    <Bar dataKey="required" name="Required" fill="rgba(255,255,255,0.05)" radius={[4,4,0,0]} />
                    <Bar dataKey="productive" name="Productive" radius={[4,4,0,0]}>
                      {weeklyChartData.map((entry,i)=>(
                        <Cell key={i} fill={entry.pct>=100?GREEN:entry.pct>=75?ACCENT:DANGER}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="font-mono text-[11px]" style={{ color:"var(--text4)" }}>No week data</p>
                </div>
              )}
            </Panel>

            {/* Radials + streaks */}
            <Panel>
              <SectionHeader icon={Award} title="Performance" sub="Key scores at a glance" color={GREEN} />
              <div className="flex items-center justify-around py-2">
                <RadialProgress value={data.consistencyScore} color={scoreColor} label="Consistency" />
                <RadialProgress value={attendancePct} color={attendancePct>=90?GREEN:attendancePct>=75?ACCENT:DANGER} label="Attendance" />
                <RadialProgress value={data.totalRequiredH>0?Math.min(100,Math.round((data.totalProductiveH/data.totalRequiredH)*100)):0} color={BLUE} label="Hours met" />
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop:"1px solid var(--border)" }}>
                {[
                  { label:"Current Streak", val:data.currentStreak, color:DANGER, bg:"rgba(248,113,113,0.08)", bdr:"rgba(248,113,113,0.15)" },
                  { label:"Best Streak",    val:data.longestStreak,  color:AMBER,  bg:"rgba(245,158,11,0.08)",  bdr:"rgba(245,158,11,0.15)"  },
                ].map(({label,val,color,bg,bdr})=>(
                  <div key={label} className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background:bg, border:`1px solid ${bdr}` }}>
                    <p className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color:"var(--text4)" }}>{label}</p>
                    <p className="font-mono font-black text-[22px]" style={{ color }}>{val}</p>
                    <p className="font-mono text-[9px]" style={{ color:"var(--text4)" }}>days</p>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Heatmap */}
            <Panel>
              <SectionHeader icon={CalendarDays} title="Month Heatmap" sub="Intensity by calendar day" color={AMBER} />
              <HeatmapCalendar days={data.dailyData} year={year} month={month} maxH={maxH} />
            </Panel>
          </div>

          {/* Timing + Breaks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 ana-fade ana-d4">

            {/* Entry/Exit Line */}
            <Panel>
              <SectionHeader icon={Clock} title="Entry & Exit Timing" sub="When you start and finish each day" color={BLUE} />
              {timingData.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={timingData} margin={{ top:5, right:8, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill:"var(--text4)", fontSize:8, fontFamily:"monospace" }}
                        axisLine={false} tickLine={false} interval={Math.floor(timingData.length/6)} />
                      <YAxis tick={{ fill:"var(--text4)", fontSize:9, fontFamily:"monospace" }}
                        axisLine={false} tickLine={false} domain={["dataMin - 30","dataMax + 30"]} tickFormatter={fmtMins} />
                      <Tooltip content={<ChartTooltip formatter={(v:number)=>fmtMins(v)} />} />
                      <Line type="monotone" dataKey="entry" name="Entry" stroke={ACCENT} strokeWidth={2} dot={{ r:2.5, fill:ACCENT, strokeWidth:0 }} />
                      <Line type="monotone" dataKey="exit"  name="Exit"  stroke={GREEN}  strokeWidth={2} dot={{ r:2.5, fill:GREEN,  strokeWidth:0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop:"1px solid var(--border)" }}>
                    {[
                      { label:"Avg Entry",   value:to12h(data.avgEntryTime),  color:ACCENT },
                      { label:"Avg Exit",    value:to12h(data.avgExitTime),   color:GREEN  },
                      { label:"Earliest In", value:to12h(data.earliestEntry), color:AMBER  },
                      { label:"Latest Out",  value:to12h(data.latestExit),    color:DANGER },
                    ].map(({label,value,color})=>(
                      <div key={label} className="rounded-xl p-2.5 text-center" style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                        <p className="font-mono text-[8px] uppercase tracking-wider mb-1" style={{ color:"var(--text4)" }}>{label}</p>
                        <p className="font-mono font-bold text-[12px]" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="font-mono text-[11px]" style={{ color:"var(--text4)" }}>Not enough data yet</p>
                </div>
              )}
            </Panel>

            {/* Breaks */}
            <Panel>
              <SectionHeader icon={Coffee} title="Break Breakdown" sub="Rest time distribution this month" color={AMBER} />
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {[
                  { label:"Tea / Coffee", count:data.breakBreakdown.tea.count,    h:data.breakBreakdown.tea.totalH,    color:AMBER  },
                  { label:"Lunch",        count:data.breakBreakdown.lunch.count,  h:data.breakBreakdown.lunch.totalH,  color:GREEN  },
                  { label:"Custom",       count:data.breakBreakdown.custom.count, h:data.breakBreakdown.custom.totalH, color:ACCENT },
                ].map(b => {
                  const total = (data.breakBreakdown.tea.count + data.breakBreakdown.lunch.count + data.breakBreakdown.custom.count) || 1;
                  const pct = Math.round((b.count / total) * 100);
                  return (
                    <div key={b.label}>
                      <div className="flex justify-between mb-1.5">
                        <span className="font-mono text-[12px] font-semibold" style={{ color:"var(--text2)" }}>{b.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px]" style={{ color:b.color }}>{b.count}× · {fmtH(b.h)}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background:`${b.color}18`, color:b.color }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height:5, background:"var(--surface2)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width:`${pct}%`, background:`linear-gradient(90deg,${b.color},${b.color}99)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3" style={{ borderTop:"1px solid var(--border)" }}>
                {[
                  { label:"Total Break", value:fmtH(data.totalBreakH), color:AMBER },
                  { label:"Avg Break",   value:`${data.avgBreakMins}m`, color:"var(--text2)" },
                  { label:"Longest",     value:`${data.longestBreakMins}m`, color:DANGER },
                ].map(({label,value,color})=>(
                  <div key={label} className="rounded-xl p-2.5 text-center" style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                    <p className="font-mono text-[8px] uppercase tracking-wider mb-1" style={{ color:"var(--text4)" }}>{label}</p>
                    <p className="font-mono font-bold text-[13px]" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { label:"🏆 Best Day",  day:data.bestDay,  color:GREEN  },
                  { label:"📉 Worst Day", day:data.worstDay, color:DANGER },
                ].map(({label,day,color})=>(
                  <div key={label} className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                    style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                    <span className="font-mono text-[10px]" style={{ color:"var(--text4)" }}>{label}</span>
                    <div className="text-right">
                      <p className="font-mono font-bold text-[13px]" style={{ color }}>{day?ordinal(day.day):"—"}</p>
                      <p className="font-mono text-[9px]" style={{ color:"var(--text4)" }}>{day?fmtH(day.productiveH):""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Daily Log Table */}
          <Panel className="ana-fade ana-d5">
            <SectionHeader icon={BarChart2} title="Daily Log" sub="Sortable · filterable · 8 rows per page" />
            <DailyLogTable days={data.dailyData} year={year} month={month} />
          </Panel>
        </>
      )}
    </div>
  );
}