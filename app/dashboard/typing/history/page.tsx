"use client";
// app/dashboard/typing/history/page.tsx
//
// Requires:  npm install recharts
// Place API files at:
//   app/api/typing/history/route.ts
//   app/api/typing/analysis/route.ts

import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = "history" | "analysis";

interface HistoryResult {
  _id: string;
  timerDuration: number;
  typingMode: string;
  wpm: number;
  accuracy: number;
  errors: number;
  charactersTyped: number;
  createdAt: string;
}

interface HistoryResponse {
  success: boolean;
  results: HistoryResult[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface TrendPoint {
  index: number;
  wpm: number;
  accuracy: number;
  errors: number;
  date: string;
  mode: string;
  timer: number;
}

interface ModeStats {
  _id: string;
  avgWpm: number;
  avgAccuracy: number;
  count: number;
  bestWpm: number;
}

interface DailyAvg {
  date: string;
  avgWpm: number;
  avgAccuracy: number;
  count: number;
  bestWpm: number;
}

interface WpmBucket {
  label: string;
  count: number;
}

interface AnalysisSummary {
  totalTests: number;
  avgWpm: number;
  avgAccuracy: number;
  bestWpm: number;
  bestAccuracy: number;
}

interface AnalysisResponse {
  success: boolean;
  trendData: TrendPoint[];
  byMode: ModeStats[];
  byTimer: ModeStats[];
  dailyAvg: DailyAvg[];
  wpmDistribution: WpmBucket[];
  summary: AnalysisSummary;
}

interface CustomTimer {
  _id: string;
  duration: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TIMERS = [15, 30, 60, 120];

const MODES_FILTER = [
  { key: "all",             label: "All",  title: "All modes"       },
  { key: "smallLetters",    label: "abc",  title: "Lowercase only"  },
  { key: "mixedLetters",    label: "Abc",  title: "Mixed case"      },
  { key: "punctuation",     label: "!,.",  title: "With punctuation"},
  { key: "numbers",         label: "123",  title: "Numbers only"    },
  { key: "numbersIncluded", label: "ab1",  title: "Words + numbers" },
];

const MODE_LABEL: Record<string, string> = {
  smallLetters: "abc", mixedLetters: "Abc",
  punctuation:  "!,.", numbers: "123", numbersIncluded: "ab1",
};

const C = {
  wpm:      "#a78bfa",
  accuracy: "#34d399",
  best:     "#fb923c",
  count:    "#38bdf8",
  errors:   "#f87171",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

// ─── Pagination helper ────────────────────────────────────────────────────────
// Always shows: first page, last page, current ±1, and ellipsis gaps.
// Max visible slots = 7 (1 … prev cur next … last)
function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 1) return [];

  // For small page counts, show everything — no ellipsis needed
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "…")[] = [];

  // Always include page 1
  pages.push(1);

  // Gap after 1 if current is far enough from start
  if (current > 3) {
    pages.push("…");
  }

  // Window around current: [current-1, current, current+1]
  // Clamped so we never overlap page 1 or last page
  const winStart = Math.max(2, current - 1);
  const winEnd   = Math.min(total - 1, current + 1);

  for (let p = winStart; p <= winEnd; p++) {
    pages.push(p);
  }

  // Gap before last if current is far enough from end
  if (current < total - 2) {
    pages.push("…");
  }

  // Always include last page
  pages.push(total);

  return pages;
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a1a2e",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <p style={{ color: "#9ca3af", marginBottom: 6, fontSize: 11, fontWeight: 600 }}>
        {typeof label === "number" ? `Test #${label}` : label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0", fontSize: 12 }}>
          {p.name}:{" "}
          <strong>
            {typeof p.value === "number"
              ? p.name === "accuracy" ? `${p.value.toFixed(1)}%`
              : p.name.toLowerCase().includes("accuracy") ? `${Math.round(p.value)}%`
              : Math.round(p.value)
              : p.value}
          </strong>
          {p.name === "wpm" || p.name === "Best WPM" || p.name === "Avg WPM" ? " wpm" : ""}
        </p>
      ))}
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <div className="animate-pulse rounded" style={{
            height: 14,
            width: i === 0 ? 32 : i === 1 ? 90 : 60,
            background: "rgba(255,255,255,0.07)",
          }} />
        </td>
      ))}
    </tr>
  );
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="animate-pulse rounded-2xl" style={{
      height, background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
    }} />
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  title, value, sub, accent, icon, loading,
}: {
  title: string; value: string; sub: string;
  accent: string; icon: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl" style={{
        background: "var(--surface)", border: "1px solid var(--border2)", minHeight: 90,
      }} />
    );
  }
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-1" style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
    }}>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text3)" }}>{title}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold font-mono leading-tight" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--text2)" }}>{sub}</div>
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, children, className = "",
}: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 flex flex-col gap-3 ${className}`} style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
    }}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</h3>
        {subtitle && (
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text3)" }}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16"
      style={{ color: "var(--text3)" }}>
      <span style={{ fontSize: 40, opacity: 0.5 }}>⌨️</span>
      <p className="text-sm font-medium">{message}</p>
      <Link href="/dashboard/typing"
        className="text-xs font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
        style={{ background: "rgba(124,110,243,.15)", color: "var(--accent2)", border: "1px solid rgba(124,110,243,.3)" }}>
        Start a test →
      </Link>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
      background: "rgba(124,110,243,.12)",
      color: "var(--accent2)",
      border: "1px solid rgba(124,110,243,.2)",
    }}>
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}

function TimerBadge({ duration }: { duration: number }) {
  return (
    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
      background: "rgba(56,189,248,.10)",
      color: "#38bdf8",
      border: "1px solid rgba(56,189,248,.22)",
    }}>
      {fmtDur(duration)}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TypingHistoryPage() {

  // ── Tab & filter state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<TabType>("history");
  const [selectedTimer, setSelectedTimer] = useState(0); // 0 = all timers
  const [selectedMode, setSelectedMode]   = useState("all");
  const [customTimers, setCustomTimers]   = useState<CustomTimer[]>([]);

  // ── History state ─────────────────────────────────────────────────────────
  const [historyData, setHistoryData]       = useState<HistoryResult[]>([]);
  const [historyTotal, setHistoryTotal]     = useState(0);
  const [historyPages, setHistoryPages]     = useState(1);
  const [currentPage, setCurrentPage]       = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Analysis state ────────────────────────────────────────────────────────
  const [analysis, setAnalysis]               = useState<AnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchCustomTimers = useCallback(async () => {
    try {
      const res  = await fetch("/api/typing/timers");
      const data = await res.json();
      if (data.success) setCustomTimers(data.timers);
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async (
    timer: number, mode: string, page: number,
  ) => {
    setHistoryLoading(true);
    try {
      const p = new URLSearchParams({
        timer: String(timer), mode, page: String(page), limit: "20",
      });
      const res  = await fetch(`/api/typing/history?${p}`);
      const data: HistoryResponse = await res.json();
      if (data.success) {
        setHistoryData(data.results);
        setHistoryTotal(data.total);
        setHistoryPages(data.pages);
      }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  const fetchAnalysis = useCallback(async (timer: number) => {
    setAnalysisLoading(true);
    try {
      const res  = await fetch(`/api/typing/analysis?timer=${timer}`);
      const data: AnalysisResponse = await res.json();
      if (data.success) setAnalysis(data);
    } catch { /* silent */ }
    finally { setAnalysisLoading(false); }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { fetchCustomTimers(); }, [fetchCustomTimers]);

  // When filter changes, reset to page 1 and re-fetch the active tab
  useEffect(() => {
    setCurrentPage(1);
    if (activeTab === "history")  fetchHistory(selectedTimer, selectedMode, 1);
    if (activeTab === "analysis") fetchAnalysis(selectedTimer);
  }, [selectedTimer, selectedMode, activeTab]); // eslint-disable-line

  // Pagination — only re-fetch when page changes (not on filter reset)
  const pageRef = React.useRef(currentPage);
  useEffect(() => {
    if (pageRef.current === currentPage) return;
    pageRef.current = currentPage;
    if (activeTab === "history") fetchHistory(selectedTimer, selectedMode, currentPage);
  }, [currentPage]); // eslint-disable-line

  // ── Derived ───────────────────────────────────────────────────────────────

  const allTimers = useMemo(
    () => [0, ...DEFAULT_TIMERS, ...customTimers.map(c => c.duration)],
    [customTimers],
  );

  const modeBarData = useMemo(() => {
    if (!analysis?.byMode) return [];
    return analysis.byMode.map(m => ({
      name:           MODE_LABEL[m._id] ?? m._id,
      "Avg WPM":      Math.round(m.avgWpm),
      "Best WPM":     m.bestWpm,
      "Avg Accuracy": Math.round(m.avgAccuracy),
      tests:          m.count,
    }));
  }, [analysis]);

  const timerBarData = useMemo(() => {
    if (!analysis?.byTimer) return [];
    return analysis.byTimer.map(t => ({
      name:           fmtDur(t._id as unknown as number),
      "Avg WPM":      Math.round(t.avgWpm),
      "Best WPM":     t.bestWpm,
      "Avg Accuracy": Math.round(t.avgAccuracy),
      tests:          t.count,
    }));
  }, [analysis]);

  // ── Pagination numbers — smart truncation ─────────────────────────────────
  // Pattern: 1 … [cur-1] [cur] [cur+1] … N
  // Never more than ~7 slots regardless of total pages.
  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, historyPages),
    [currentPage, historyPages],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col gap-4 sm:gap-6 pb-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}>

      <style>{`
        /* Scrollable table wrapper */
        .hist-table-wrap {
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid var(--border2);
        }
        .hist-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .hist-table th {
          padding: 10px 14px;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: var(--text3);
          background: var(--surface2);
          border-bottom: 1px solid var(--border2);
          white-space: nowrap;
        }
        .hist-table tr:not(:last-child) td {
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .hist-table td {
          padding: 12px 14px;
          white-space: nowrap;
          vertical-align: middle;
        }
        .hist-table tbody tr:hover td {
          background: rgba(255,255,255,.03);
        }
        /* Tab pill */
        .ht-tab {
          padding: 7px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 140ms, color 140ms;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text3);
        }
        .ht-tab:hover:not(.ht-tab--active) {
          color: var(--text2); background: var(--surface2);
        }
        .ht-tab--active {
          background: rgba(124,110,243,.15);
          color: var(--accent2);
          border-color: rgba(124,110,243,.35);
        }

        /* ── Pagination ── */
        .pg-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
          padding: 4px 0;
        }
        /* Nav arrows (‹ ›) */
        .pg-arrow {
          min-width: 34px;
          height: 34px;
          padding: 0 10px;
          border-radius: 9px;
          font-size: 16px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--border2);
          background: var(--surface2);
          color: var(--text2);
          transition: background 120ms, color 120ms, border-color 120ms, opacity 120ms;
          user-select: none;
          line-height: 1;
        }
        .pg-arrow:hover:not(:disabled) {
          background: var(--surface);
          color: var(--text);
          border-color: rgba(124,110,243,.4);
        }
        .pg-arrow:disabled {
          opacity: .3;
          cursor: not-allowed;
        }
        /* Number buttons */
        .pg-num {
          min-width: 34px;
          height: 34px;
          padding: 0 8px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          font-family: monospace;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--border2);
          background: var(--surface2);
          color: var(--text2);
          transition: background 120ms, color 120ms, border-color 120ms;
          user-select: none;
        }
        .pg-num:hover:not(.pg-num--active) {
          background: var(--surface);
          color: var(--text);
          border-color: rgba(124,110,243,.3);
        }
        .pg-num--active {
          background: rgba(124,110,243,.20);
          border-color: rgba(124,110,243,.55);
          color: var(--accent2);
          box-shadow: 0 0 0 1px rgba(124,110,243,.18);
        }
        /* Ellipsis */
        .pg-ellipsis {
          min-width: 28px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--text3);
          letter-spacing: .05em;
          user-select: none;
          cursor: default;
        }
        /* Page counter label e.g. "Page 3 of 47" */
        .pg-counter {
          font-size: 11px;
          font-weight: 600;
          font-family: monospace;
          color: var(--text3);
          padding: 0 6px;
          white-space: nowrap;
        }

        /* Recharts overrides — make grid lines subtle */
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke: rgba(255,255,255,.06) !important;
        }
        .recharts-text { fill: #6b7280 !important; font-size: 11px !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <Link href="/dashboard/typing"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{
            background: "var(--surface2)",
            color: "var(--text2)",
            border: "1px solid var(--border2)",
          }}>
          ← Typing
        </Link>
        <span style={{ color: "var(--accent)", fontSize: 20 }}>📊</span>
        <h1 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text)" }}>
          Typing History
        </h1>
      </div>

      {/* ── Timer filter row ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {allTimers.map(t => (
          <button key={t} onClick={() => setSelectedTimer(t)}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-semibold transition-all"
            style={{
              background:   selectedTimer === t ? "var(--accent)"          : "var(--surface)",
              color:        selectedTimer === t ? "#fff"                    : "var(--text2)",
              border:       selectedTimer === t ? "1px solid var(--accent)" : "1px solid var(--border2)",
            }}>
            {t === 0 ? "All" : fmtDur(t)}
          </button>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-2">
        {(["history", "analysis"] as TabType[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`ht-tab${activeTab === tab ? " ht-tab--active" : ""}`}>
            {tab === "history" ? "📋 History" : "📈 Analysis"}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          HISTORY TAB
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-4">

          {/* Mode filter */}
          <div className="flex flex-wrap items-center gap-1">
            {MODES_FILTER.map(({ key, label, title }) => (
              <button key={key} title={title}
                onClick={() => setSelectedMode(key)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-semibold transition-all"
                style={{
                  background: selectedMode === key ? "rgba(124,110,243,.15)" : "transparent",
                  color:      selectedMode === key ? "var(--accent2)"         : "var(--text3)",
                  border:     selectedMode === key ? "1px solid rgba(124,110,243,.35)" : "1px solid transparent",
                }}>
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs font-mono" style={{ color: "var(--text3)" }}>
              {historyTotal > 0 ? `${historyTotal} test${historyTotal !== 1 ? "s" : ""}` : ""}
            </span>
          </div>

          {/* Table */}
          <div className="hist-table-wrap">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Timer</th>
                  <th>Mode</th>
                  <th>WPM</th>
                  <th>Accuracy</th>
                  <th>Errors</th>
                  <th>Chars</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading
                  ? [...Array(10)].map((_, i) => <SkeletonRow key={i} />)
                  : historyData.length === 0
                    ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <EmptyState message={
                            historyTotal === 0
                              ? "No tests recorded yet"
                              : "No tests match these filters"
                          } />
                        </td>
                      </tr>
                    )
                    : historyData.map((r, i) => {
                        const rank = (currentPage - 1) * 20 + i + 1;
                        const accColor =
                          r.accuracy >= 98 ? C.accuracy :
                          r.accuracy >= 90 ? "#fbbf24" : C.errors;
                        return (
                          <tr key={r._id}>
                            <td style={{ color: "var(--text3)", fontSize: 11, fontFamily: "monospace" }}>
                              {rank}
                            </td>
                            <td style={{ color: "var(--text2)", fontSize: 12 }}>
                              {fmtDate(r.createdAt)}
                            </td>
                            <td style={{ color: "var(--text3)", fontSize: 11, fontFamily: "monospace" }}>
                              {fmtTime(r.createdAt)}
                            </td>
                            <td><TimerBadge duration={r.timerDuration} /></td>
                            <td><ModeBadge mode={r.typingMode} /></td>
                            <td>
                              <span className="font-mono font-bold" style={{ color: C.wpm, fontSize: 14 }}>
                                {r.wpm}
                              </span>
                              <span style={{ color: "var(--text3)", fontSize: 10 }}> wpm</span>
                            </td>
                            <td>
                              <span className="font-mono font-bold" style={{ color: accColor, fontSize: 14 }}>
                                {r.accuracy}%
                              </span>
                            </td>
                            <td>
                              <span className="font-mono" style={{
                                color: r.errors === 0 ? C.accuracy : r.errors > 10 ? C.errors : "#fbbf24",
                                fontWeight: 600, fontSize: 13,
                              }}>
                                {r.errors}
                              </span>
                            </td>
                            <td style={{ color: "var(--text2)", fontFamily: "monospace", fontSize: 12 }}>
                              {r.charactersTyped}
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {historyPages > 1 && !historyLoading && (
            <div className="flex flex-col items-center gap-2">

              {/* Page counter */}
              <span className="pg-counter">
                Page {currentPage} of {historyPages}
              </span>

              {/* Button bar */}
              <div className="pg-bar">

                {/* First page jump */}
                <button
                  className="pg-arrow"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  title="First page"
                  aria-label="First page"
                >
                  «
                </button>

                {/* Previous */}
                <button
                  className="pg-arrow"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  ‹
                </button>

                {/* Number slots */}
                {pageNumbers.map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="pg-ellipsis" aria-hidden="true">
                      ···
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={`pg-num${currentPage === p ? " pg-num--active" : ""}`}
                      onClick={() => setCurrentPage(p as number)}
                      aria-label={`Page ${p}`}
                      aria-current={currentPage === p ? "page" : undefined}
                    >
                      {p}
                    </button>
                  )
                )}

                {/* Next */}
                <button
                  className="pg-arrow"
                  disabled={currentPage === historyPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  title="Next page"
                  aria-label="Next page"
                >
                  ›
                </button>

                {/* Last page jump */}
                <button
                  className="pg-arrow"
                  disabled={currentPage === historyPages}
                  onClick={() => setCurrentPage(historyPages)}
                  title="Last page"
                  aria-label="Last page"
                >
                  »
                </button>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ANALYSIS TAB
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "analysis" && (
        <div className="flex flex-col gap-4 sm:gap-5">

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <SummaryCard
              title="Total Tests"
              value={String(analysis?.summary.totalTests ?? 0)}
              sub={selectedTimer === 0 ? "all timers" : `on ${fmtDur(selectedTimer)}`}
              accent="var(--accent2)" icon="🎯" loading={analysisLoading}
            />
            <SummaryCard
              title="Best WPM"
              value={`${analysis?.summary.bestWpm ?? 0}`}
              sub="all time peak"
              accent={C.wpm} icon="⚡" loading={analysisLoading}
            />
            <SummaryCard
              title="Avg WPM"
              value={`${analysis?.summary.avgWpm ?? 0}`}
              sub="across all tests"
              accent={C.count} icon="📈" loading={analysisLoading}
            />
            <SummaryCard
              title="Best Accuracy"
              value={`${analysis?.summary.bestAccuracy ?? 0}%`}
              sub="all time peak"
              accent={C.accuracy} icon="🎖" loading={analysisLoading}
            />
            <SummaryCard
              title="Avg Accuracy"
              value={`${analysis?.summary.avgAccuracy ?? 0}%`}
              sub="across all tests"
              accent="#fbbf24" icon="📊" loading={analysisLoading}
            />
          </div>

          {/* ── WPM & Accuracy trend ── */}
          {analysisLoading
            ? <ChartSkeleton height={280} />
            : !analysis?.trendData?.length
              ? null
              : (
                <ChartCard
                  title="Performance Trend"
                  subtitle={`Last ${analysis.trendData.length} tests — WPM and Accuracy over time`}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={analysis.trendData}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradWpm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.wpm}      stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.wpm}      stopOpacity={0}   />
                        </linearGradient>
                        <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.accuracy} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={C.accuracy} stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="index" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="wpm"
                        domain={[0, (max: number) => Math.max(max + 10, 60)]}
                        tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="acc" orientation="right"
                        domain={[0, 100]} tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Area yAxisId="wpm" type="monotone" dataKey="wpm"
                        name="wpm" stroke={C.wpm} fill="url(#gradWpm)"
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Area yAxisId="acc" type="monotone" dataKey="accuracy"
                        name="accuracy" stroke={C.accuracy} fill="url(#gradAcc)"
                        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )
          }

          {/* ── Daily performance (last 30 days) ── */}
          {analysisLoading
            ? <ChartSkeleton height={240} />
            : !analysis?.dailyAvg?.length
              ? null
              : (
                <ChartCard
                  title="Daily Performance"
                  subtitle="Average WPM and accuracy per day — last 30 days"
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analysis.dailyAvg}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date"
                        tickFormatter={(v: string) => fmtShortDate(v)}
                        tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="wpm"
                        domain={[0, (max: number) => Math.max(max + 10, 60)]}
                        tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="cnt" orientation="right"
                        tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />}
                        labelFormatter={(label) => fmtShortDate(label as string)} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar yAxisId="wpm" dataKey="avgWpm" name="Avg WPM"
                        fill={C.wpm} radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar yAxisId="wpm" dataKey="bestWpm" name="Best WPM"
                        fill={C.best} radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar yAxisId="cnt" dataKey="count" name="Tests"
                        fill={C.count} fillOpacity={0.5} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )
          }

          {/* ── Bottom grid: Mode performance | WPM Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

            {/* Mode performance */}
            {analysisLoading
              ? <ChartSkeleton height={220} />
              : !modeBarData.length
                ? null
                : (
                  <ChartCard
                    title="Performance by Mode"
                    subtitle="Avg and best WPM across typing modes"
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={modeBarData}
                        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="Avg WPM"  fill={C.wpm}  radius={[4,4,0,0]} maxBarSize={36} />
                        <Bar dataKey="Best WPM" fill={C.best} radius={[4,4,0,0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )
            }

            {/* WPM distribution histogram */}
            {analysisLoading
              ? <ChartSkeleton height={220} />
              : !analysis?.wpmDistribution?.length
                ? null
                : (
                  <ChartCard
                    title="WPM Distribution"
                    subtitle="How often you land in each speed range"
                  >
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analysis.wpmDistribution}
                        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Tests" radius={[4,4,0,0]} maxBarSize={40}>
                          {analysis.wpmDistribution.map((_, i) => (
                            <Cell key={i} fill={
                              ["#4b5563","#6b7280","#38bdf8","#60a5fa",
                               "#a78bfa","#c084fc","#f472b6","#fb923c"][i % 8]
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )
            }
          </div>

          {/* ── Per-timer breakdown table ── */}
          {!analysisLoading && timerBarData.length > 0 && (
            <ChartCard
              title="Performance by Timer"
              subtitle="Your average stats broken down by each timer duration"
            >
              <div className="hist-table-wrap" style={{ border: "none" }}>
                <table className="hist-table">
                  <thead>
                    <tr>
                      <th>Timer</th>
                      <th>Tests</th>
                      <th>Avg WPM</th>
                      <th>Best WPM</th>
                      <th>Avg Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timerBarData.map((row) => (
                      <tr key={row.name}>
                        <td><TimerBadge duration={
                          DEFAULT_TIMERS.find(t => fmtDur(t) === row.name) ??
                          customTimers.find(c => fmtDur(c.duration) === row.name)?.duration ??
                          0
                        } /></td>
                        <td style={{ color: "var(--text2)", fontFamily: "monospace" }}>
                          {row.tests}
                        </td>
                        <td>
                          <span className="font-mono font-bold" style={{ color: C.wpm }}>
                            {row["Avg WPM"]}
                          </span>
                          <span style={{ color: "var(--text3)", fontSize: 10 }}> wpm</span>
                        </td>
                        <td>
                          <span className="font-mono font-bold" style={{ color: C.best }}>
                            {row["Best WPM"]}
                          </span>
                          <span style={{ color: "var(--text3)", fontSize: 10 }}> wpm</span>
                        </td>
                        <td>
                          <span className="font-mono font-bold" style={{
                            color: row["Avg Accuracy"] >= 95 ? C.accuracy :
                                   row["Avg Accuracy"] >= 85 ? "#fbbf24" : C.errors,
                          }}>
                            {row["Avg Accuracy"]}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Empty analysis state */}
          {!analysisLoading && !analysis?.trendData?.length && (
            <EmptyState message="No data to analyse yet — complete some typing tests first" />
          )}

        </div>
      )}
    </div>
  );
}