// app/admin/users/[id]/page.tsx
// Dedicated full-page view for a single employee's complete activity.
// NEW: Added "💰 Expenses" tab so admin can see employee expense data.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, Clock, Coffee, BookOpen, Keyboard,
  ChevronLeft, ChevronRight, Activity, TrendingUp,
  Zap, FileText, Target, AlertCircle, RefreshCw,
  Wallet, TrendingDown, BarChart2, CreditCard, DollarSign,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserProfile = {
  _id:         string;
  fullName:    string;
  email:       string;
  status:      "active" | "suspended" | "banned";
  companyName: string;
  createdAt:   string;
  lastLogin:   string | null;
};

type Overview = {
  totalWorkLogs:            number;
  totalDiaryEntries:        number;
  totalTypingTests:         number;
  totalProductiveHours:     number;
  totalBreakHours:          number;
  avgProductiveHoursPerDay: number;
  typingHighestWpm:         number;
  typingAvgWpm:             number;
  typingTotalTests:         number;
};

type WorkLog = {
  _id:             string;
  date:            string;
  entryTime:       string | null;
  exitTime:        string | null;
  totalOfficeTime: number;
  totalBreakTime:  number;
  productiveTime:  number;
  breaks:          { type: string; duration: number; startTime: string }[];
  isHoliday:       boolean;
  notes:           string;
};

type DiaryEntry = {
  _id:       string;
  entryDate: string;
  heading:   string;
  content:   string;
  mood:      string | null;
  editCount: number;
  isLocked:  boolean;
};

type TypingResult = {
  _id:           string;
  timerDuration: number;
  typingMode:    string;
  wpm:           number;
  accuracy:      number;
  errors:        number;
  createdAt:     string;
};

type TimerStat = {
  timerDuration:   number;
  highestWpm:      number;
  highestAccuracy: number;
  totalTests:      number;
  totalWpmSum:     number;
};

// Expense types
type Transaction = {
  _id:           string;
  type:          "expense" | "add_money";
  amount:        number;
  paymentMethod: "cash" | "online";
  category:      string;
  note:          string;
  date:          string;
  createdAt:     string;
};

type ExpenseSummary = {
  totalSpent:      number;
  totalAdded:      number;
  cashSpent:       number;
  onlineSpent:     number;
  expenseCount:    number;
  biggestCategory: string;
};

type WalletInfo = {
  cashBalance:   number;
  onlineBalance: number;
  totalBalance:  number;
};

type CategoryBreakdown = { category: string; amount: number }[];
type MonthlyTrend      = { month: string; amount: number }[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IST = "Asia/Kolkata";

function secsToHHMM(secs: number): string {
  if (!secs) return "0h 0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: IST,
    });
  } catch { return "—"; }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: IST,
    });
  } catch { return "—"; }
}

function fmtWorkTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch { return "—"; }
}

function fmtCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  active:    { text: "#22d3a0", bg: "rgba(34,211,160,0.12)",  border: "rgba(34,211,160,0.30)"  },
  suspended: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.30)"  },
  banned:    { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
};

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊", sad: "😢", angry: "😠", excited: "🤩", tired: "😴",
  stressed: "😰", calm: "😌", bored: "😑", motivated: "💪", anxious: "😬",
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-40">
      <div
        className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center mt-5">
      <button
        onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer disabled:opacity-30"
        style={{ background: "var(--surface2)", color: "var(--text3)" }}
      >
        <ChevronLeft size={14} />
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)}
          className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer text-[13px] font-mono"
          style={{
            background: p === page ? "var(--accent)" : "var(--surface2)",
            color:      p === page ? "#fff" : "var(--text3)",
            fontWeight: p === page ? 700 : 400,
          }}>
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(page + 1)} disabled={page >= totalPages}
        className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer disabled:opacity-30"
        style={{ background: "var(--surface2)", color: "var(--text3)" }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
      style={{
        background: active ? "rgba(232,67,147,0.15)" : "var(--surface2)",
        color:      active ? "var(--accent)" : "var(--text3)",
        border:     active ? "1px solid rgba(232,67,147,0.30)" : "1px solid transparent",
      }}>
      {label}
    </button>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: Overview }) {
  const items = [
    { label: "Avg Productive / Day",  value: `${overview.avgProductiveHoursPerDay}h`, color: "var(--green)"  },
    { label: "Total Break Hours",     value: `${overview.totalBreakHours}h`,           color: "var(--amber)"  },
    { label: "Typing Tests",          value: overview.typingTotalTests,                color: "#a78bfa"       },
    { label: "Average WPM",           value: overview.typingAvgWpm,                   color: "#60a5fa"       },
    { label: "Highest WPM",           value: overview.typingHighestWpm,               color: "var(--accent)" },
    { label: "Diary Entries",         value: overview.totalDiaryEntries,              color: "#f472b6"       },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-2xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text4)" }}>{label}</p>
          <p className="text-[22px] font-bold font-mono" style={{ color }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Work Logs Tab ────────────────────────────────────────────────────────────

function WorkLogsTab({ userId }: { userId: string }) {
  const [data,       setData]       = useState<WorkLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ section: "work", page: String(page), limit: "15" });
      if (from) p.set("from", from);
      if (to)   p.set("to",   to);
      const res  = await fetch(`/api/admin/users/${userId}/fulldata?${p}`);
      const json = await res.json();
      if (json.success) {
        setData(json.workLogs);
        setTotalPages(json.pagination.pages || 1);
      }
    } finally { setLoading(false); }
  }, [userId, page, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center">
        {[
          { label: "From", val: from, set: (v: string) => { setFrom(v); setPage(1); } },
          { label: "To",   val: to,   set: (v: string) => { setTo(v);   setPage(1); } },
        ].map(({ label, val, set }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--text4)" }}>{label}</span>
            <input type="date" value={val} onChange={e => set(e.target.value)}
              className="border-none rounded-xl px-3 py-2 text-[13px] font-mono"
              style={{ background: "var(--surface2)", color: "var(--text2)" }} />
          </div>
        ))}
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); setPage(1); }}
            className="px-3 py-1 rounded-lg text-[12px] border-none cursor-pointer"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
            Clear
          </button>
        )}
      </div>

      {loading ? <Spinner /> : data.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text4)" }}>No work logs found</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {data.map(log => (
              <div key={log._id} className="rounded-xl p-4"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} style={{ color: "var(--accent)" }} />
                    <span className="font-mono font-bold text-[14px]" style={{ color: "var(--text)" }}>
                      {fmtDate(log.date)}
                    </span>
                    {log.isHoliday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                        HOLIDAY
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] font-mono">
                    <span style={{ color: "var(--green)" }}>⏱ {secsToHHMM(log.productiveTime)}</span>
                    <span style={{ color: "var(--amber)" }}>☕ {secsToHHMM(log.totalBreakTime)}</span>
                  </div>
                </div>

                {!log.isHoliday && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {[
                      { label: "Entry",       value: fmtWorkTime(log.entryTime),      color: "#60a5fa" },
                      { label: "Exit",        value: fmtWorkTime(log.exitTime),        color: "#f472b6" },
                      { label: "Office Time", value: secsToHHMM(log.totalOfficeTime), color: "var(--amber)" },
                      { label: "Breaks",      value: `${log.breaks?.length ?? 0} taken`, color: "var(--text3)" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-lg px-3 py-2"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                          style={{ color: "var(--text4)" }}>{label}</div>
                        <div className="font-mono text-[13px] font-semibold" style={{ color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {log.breaks && log.breaks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {log.breaks.map((b, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-mono"
                        style={{
                          background: b.type === "lunch" ? "rgba(245,158,11,0.12)"
                            : b.type === "tea" ? "rgba(34,211,160,0.10)" : "rgba(167,139,250,0.10)",
                          color: b.type === "lunch" ? "var(--amber)" : b.type === "tea" ? "var(--green)" : "#a78bfa",
                        }}>
                        {b.type === "lunch" ? "🥗" : b.type === "tea" ? "☕" : "⏸"}{" "}
                        {b.type} · {Math.round((b.duration ?? 0) / 60)}m
                        {b.startTime ? ` · ${fmtWorkTime(b.startTime)}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                {log.notes && (
                  <div className="mt-2 text-[12px] px-3 py-2 rounded-lg"
                    style={{ background: "rgba(232,67,147,0.06)", color: "var(--text3)", border: "1px solid rgba(232,67,147,0.10)" }}>
                    📝 {log.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Diary Tab ────────────────────────────────────────────────────────────────

function DiaryTab({ userId }: { userId: string }) {
  const [data,       setData]       = useState<DiaryEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p   = new URLSearchParams({ section: "diary", page: String(page), limit: "20" });
      const res  = await fetch(`/api/admin/users/${userId}/fulldata?${p}`);
      const json = await res.json();
      if (json.success) {
        setData(json.diaryEntries);
        setTotalPages(json.pagination.pages || 1);
      }
    } finally { setLoading(false); }
  }, [userId, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3">
      {loading ? <Spinner /> : data.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text4)" }}>No diary entries found</div>
      ) : (
        <>
          {data.map(entry => (
            <div key={entry._id} className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(expanded === entry._id ? null : entry._id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
                    {fmtDate(entry.entryDate)}
                  </span>
                  {entry.mood && (
                    <span>{MOOD_EMOJI[entry.mood] || entry.mood}</span>
                  )}
                  {entry.heading && (
                    <span className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>
                      {entry.heading}
                    </span>
                  )}
                  {entry.isLocked && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                      🔒 Locked
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                  {entry.editCount} edit(s)
                </span>
              </div>
              {expanded === entry._id && entry.content && (
                <div className="px-4 pb-4">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--text2)" }}>
                    {entry.content}
                  </p>
                </div>
              )}
            </div>
          ))}
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Typing Tab ───────────────────────────────────────────────────────────────

function TypingTab({ userId }: { userId: string }) {
  const [results,    setResults]    = useState<TypingResult[]>([]);
  const [stats,      setStats]      = useState<TimerStat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p   = new URLSearchParams({ section: "typing", page: String(page), limit: "20" });
      const res  = await fetch(`/api/admin/users/${userId}/fulldata?${p}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.typingResults);
        setStats(json.timerStats || []);
        setTotalPages(json.pagination.pages || 1);
      }
    } finally { setLoading(false); }
  }, [userId, page]);

  useEffect(() => { load(); }, [load]);

  const fmtDuration = (secs: number) => {
    if (secs >= 60) return `${secs / 60}m`;
    return `${secs}s`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Per-timer stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.timerDuration} className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text4)" }}>
                {fmtDuration(s.timerDuration)} Mode
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold font-mono" style={{ color: "var(--accent)" }}>
                  {s.highestWpm}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text4)" }}>best wpm</span>
              </div>
              <p className="text-[12px] font-mono mt-0.5" style={{ color: "var(--text3)" }}>
                {s.totalTests} test{s.totalTests !== 1 ? "s" : ""} · {s.highestAccuracy}% best acc
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : results.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text4)" }}>No typing results found</div>
      ) : (
        <>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border2)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border2)" }}>
                  {["Timer", "Mode", "WPM", "Accuracy", "Errors", "Date"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-2.5 font-mono text-[13px]" style={{ color: "var(--text3)" }}>
                      {fmtDuration(r.timerDuration)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--text3)" }}>
                      {r.typingMode}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-[14px]" style={{ color: "var(--accent)" }}>
                      {r.wpm}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[13px]" style={{ color: "var(--green)" }}>
                      {r.accuracy}%
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[13px]" style={{ color: "#f87171" }}>
                      {r.errors}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: "var(--text4)" }}>
                      {fmtDate(r.createdAt)} {fmtTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── Expenses Tab (NEW) ───────────────────────────────────────────────────────

function ExpensesTab({ userId }: { userId: string }) {
  const now = new Date();
  const [monthStr, setMonthStr] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [loading,    setLoading]    = useState(true);
  const [summary,    setSummary]    = useState<ExpenseSummary | null>(null);
  const [wallet,     setWallet]     = useState<WalletInfo | null>(null);
  const [categories, setCategories] = useState<CategoryBreakdown>([]);
  const [trend,      setTrend]      = useState<MonthlyTrend>([]);
  const [txns,       setTxns]       = useState<Transaction[]>([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthStr, page: String(page), limit: "20" });
      const res    = await fetch(`/api/admin/users/${userId}/expenses?${params}`);
      const json   = await res.json();
      if (json.success) {
        setSummary(json.summary);
        setWallet(json.wallet);
        setCategories(json.categoryBreakdown || []);
        setTrend(json.monthlyTrend || []);
        setTxns(json.transactions || []);
        setTotalPages(json.pagination?.pages || 1);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [userId, monthStr, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const maxTrend = Math.max(...trend.map(t => t.amount), 1);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Month picker + refresh ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="month"
          value={monthStr}
          onChange={e => { setMonthStr(e.target.value); setPage(1); }}
          className="border-none rounded-xl px-3 py-2 text-[13px] font-mono"
          style={{ background: "var(--surface2)", color: "var(--text2)" }}
        />
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
          style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border2)" }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* ── Wallet balances ── */}
      {wallet && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Cash Balance",   value: wallet.cashBalance,   color: "#22d3a0",      bg: "rgba(34,211,160,0.10)" },
            { label: "Online Balance", value: wallet.onlineBalance, color: "#60a5fa",      bg: "rgba(96,165,250,0.10)" },
            { label: "Total Balance",  value: wallet.totalBalance,  color: "var(--accent)", bg: "rgba(232,67,147,0.10)" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Wallet size={13} style={{ color }} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>{label}</p>
              </div>
              <p className="font-mono font-bold text-[20px]" style={{ color }}>{fmtCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary stats ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Spent",    value: fmtCurrency(summary.totalSpent),    color: "#f87171",      icon: TrendingDown  },
            { label: "Total Added",    value: fmtCurrency(summary.totalAdded),    color: "#22d3a0",      icon: TrendingUp    },
            { label: "Cash Spent",     value: fmtCurrency(summary.cashSpent),     color: "#fbbf24",      icon: DollarSign    },
            { label: "Online Spent",   value: fmtCurrency(summary.onlineSpent),   color: "#60a5fa",      icon: CreditCard    },
            { label: "Transactions",   value: String(summary.expenseCount),       color: "#a78bfa",      icon: BarChart2     },
            { label: "Top Category",   value: summary.biggestCategory,            color: "var(--accent)", icon: Zap           },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} style={{ color }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>{label}</p>
              </div>
              <p className="font-mono font-bold text-[15px] truncate" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 6-month trend bar chart ── */}
      {trend.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text4)" }}>
            📈 6-Month Spending Trend
          </p>
          <div className="flex items-end gap-2 h-32">
            {trend.map(t => {
              const pct = maxTrend > 0 ? (t.amount / maxTrend) * 100 : 0;
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-[10px] font-mono" style={{ color: "var(--text4)" }}>
                    {fmtCurrency(t.amount).replace("₹", "₹").split(".")[0]}
                  </p>
                  <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{
                        height:     `${Math.max(pct, 2)}%`,
                        background: "var(--accent)",
                        opacity:    0.7,
                        minHeight:  t.amount > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                  <p className="text-[9px] font-mono text-center" style={{ color: "var(--text4)" }}>
                    {t.month}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

       {categories.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text4)" }}>
            📊 Category Breakdown
          </p>
          <div className="flex flex-col gap-2">
            {categories.slice(0, 8).map(c => {
              // ✅ FIX: extract totalSpent safely before using it
              const totalSpent = summary?.totalSpent ?? 0;
              const pct = totalSpent > 0 ? (c.amount / totalSpent) * 100 : 0;
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px]" style={{ color: "var(--text2)" }}>{c.category}</span>
                    <span className="text-[12px] font-mono font-semibold" style={{ color: "var(--accent)" }}>
                      {fmtCurrency(c.amount)}
                      <span className="text-[10px] font-normal ml-1" style={{ color: "var(--text4)" }}>
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)", opacity: 0.75 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
 

      {/* ── Transaction list ── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text4)" }}>
          💳 Transactions
        </p>
        {txns.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--text4)" }}>
            No transactions for this month
          </div>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border2)" }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border2)" }}>
                    {["Date", "Type", "Category", "Method", "Note", "Amount"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--text4)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t._id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-2.5 text-[12px] font-mono" style={{ color: "var(--text4)" }}>
                        {fmtDate(t.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{
                            background: t.type === "expense" ? "rgba(248,113,113,0.12)" : "rgba(34,211,160,0.12)",
                            color:      t.type === "expense" ? "#f87171" : "#22d3a0",
                          }}>
                          {t.type === "expense" ? "Expense" : "Added"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text2)" }}>
                        {t.category || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-mono capitalize" style={{ color: "var(--text3)" }}>
                        {t.paymentMethod}
                      </td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--text4)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.note || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-[13px]"
                        style={{ color: t.type === "expense" ? "#f87171" : "#22d3a0" }}>
                        {t.type === "expense" ? "−" : "+"}{fmtCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); }} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id: userId } = useParams<{ id: string }>();
  const router = useRouter();

  const [user,      setUser]      = useState<UserProfile | null>(null);
  const [overview,  setOverview]  = useState<Overview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "work" | "diary" | "typing" | "expenses">("overview");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/admin/users/${userId}/fulldata?section=overview`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUser(d.user as UserProfile);
          setOverview(d.overview);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle size={40} style={{ color: "var(--danger)" }} />
        <div className="text-[16px] font-semibold" style={{ color: "var(--text3)" }}>Employee not found</div>
        <button onClick={() => router.push("/admin")}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
          style={{ background: "var(--surface2)", color: "var(--text3)" }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const sc = STATUS_COLORS[user.status] || STATUS_COLORS.active;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-8 px-4">

      {/* ── Back button ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 self-start px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
        style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border2)" }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text3)"}
      >
        <ArrowLeft size={14} />
        Back to Users
      </button>

      {/* ── User profile header ── */}
      <div
        className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5"
        style={{
          background: "linear-gradient(135deg, rgba(232,67,147,0.10) 0%, rgba(96,165,250,0.07) 100%)",
          border:     "1px solid var(--border2)",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0"
          style={{ background: "rgba(232,67,147,0.15)", color: "var(--accent)" }}
        >
          {user.fullName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>{user.fullName}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {user.status?.toUpperCase()}
            </span>
          </div>
          <div className="text-[14px]" style={{ color: "var(--text3)" }}>
            {user.email}
            {user.companyName && (
              <span style={{ color: "var(--text4)" }}> · {user.companyName}</span>
            )}
          </div>
          <div className="flex gap-4 mt-1 text-[12px] font-mono flex-wrap" style={{ color: "var(--text4)" }}>
            <span className="flex items-center gap-1"><Calendar size={10} /> Joined {fmtDate(user.createdAt)}</span>
            <span className="flex items-center gap-1"><Activity size={10} /> Last login {fmtDate(user.lastLogin)}</span>
          </div>
        </div>
      </div>

      {/* ── Overview stat strip ── */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Work Days",     value: overview.totalWorkLogs,              icon: Calendar,   color: "#60a5fa",      bg: "rgba(96,165,250,0.12)"   },
            { label: "Prod. Hours",   value: `${overview.totalProductiveHours}h`, icon: TrendingUp, color: "var(--green)", bg: "rgba(34,211,160,0.12)"   },
            { label: "Break Hours",   value: `${overview.totalBreakHours}h`,      icon: Coffee,     color: "var(--amber)", bg: "rgba(245,158,11,0.12)"   },
            { label: "Diary Entries", value: overview.totalDiaryEntries,          icon: BookOpen,   color: "#f472b6",      bg: "rgba(244,114,182,0.12)"  },
            { label: "Best WPM",      value: overview.typingHighestWpm,           icon: Keyboard,   color: "#a78bfa",      bg: "rgba(167,139,250,0.12)"  },
            { label: "Typing Tests",  value: overview.typingTotalTests,           icon: Target,     color: "var(--accent)", bg: "rgba(232,67,147,0.12)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon size={11} style={{ color }} />
              </div>
              <div className="font-mono font-bold text-[18px]" style={{ color }}>{value}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text4)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section tabs ── */}
      <div className="flex gap-2 flex-wrap pb-1" style={{ borderBottom: "1px solid var(--border2)" }}>
        {(["overview", "work", "diary", "typing", "expenses"] as const).map(tab => (
          <TabBtn
            key={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            label={
              tab === "overview"  ? "🏠 Overview"
              : tab === "work"    ? "⏱ Work Logs"
              : tab === "diary"   ? "📔 Diary"
              : tab === "typing"  ? "⌨ Typing"
              : "💰 Expenses"
            }
          />
        ))}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === "overview"  && overview && <OverviewTab overview={overview} />}
        {activeTab === "work"                   && <WorkLogsTab userId={userId} />}
        {activeTab === "diary"                  && <DiaryTab    userId={userId} />}
        {activeTab === "typing"                 && <TypingTab   userId={userId} />}
        {activeTab === "expenses"               && <ExpensesTab userId={userId} />}
      </div>
    </div>
  );
}