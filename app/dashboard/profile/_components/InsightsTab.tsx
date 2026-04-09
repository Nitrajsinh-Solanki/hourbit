// app/dashboard/profile/_components/InsightsTab.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Keyboard,
  Clock,
  BookOpen,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ListChecks,
  Wallet,
  DollarSign,
  CreditCard,
  ShoppingCart,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TypingStats = {
  highestWpm: number;
  highestAccuracy: number;
  totalTests: number;
  averageWpm: number;
};

type WorkData = {
  totalLoggedDays: number;
  totalProductiveH: number;
  totalRequiredH: number;
  consistencyScore: number;
  currentStreak: number;
  overtimeH: number;
  underworkH: number;
  avgEntryTime: string | null;
};

type DiaryData = {
  totalEntries: number;
  dates: string[];
};

type TodoData = {
  totalDays: number;
  totalTasks: number;
  completedTasks: number;
  todayTasks: number;
  todayCompleted: number;
};

type ExpenseData = {
  totalSpent: number;
  totalAdded: number;
  cashBalance: number;
  onlineBalance: number;
  totalBalance: number;
  biggestCategory: string;
  expenseCount: number;
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconColor,
  iconBg,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconColor: string;
  iconBg: string;
  badge?: { text: string; color: string; bg: string };
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        {badge && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}33` }}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--text4)" }}
        >
          {label}
        </p>
        <p className="text-2xl font-bold font-mono" style={{ color: iconColor }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <h3 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: "var(--text3)" }}>
        {title}
      </h3>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden w-full"
      style={{ background: "var(--surface2)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="space-y-3">
          <div className="h-4 w-32 rounded-lg animate-pulse" style={{ background: "var(--surface2)" }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((c) => (
              <div key={c} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Currency formatter ────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsightsTab() {
  const [typing,   setTyping]   = useState<TypingStats | null>(null);
  const [work,     setWork]     = useState<WorkData | null>(null);
  const [diary,    setDiary]    = useState<DiaryData | null>(null);
  const [todo,     setTodo]     = useState<TodoData | null>(null);
  const [expense,  setExpense]  = useState<ExpenseData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;

      const [typingRes, workRes, diaryRes, todoHistRes, expenseRes, walletRes] =
        await Promise.all([
          fetch("/api/typing/stats?timer=0").then((r) => r.json()),
          fetch(`/api/work/analysis?year=${year}&month=${month}`).then((r) => r.json()),
          fetch("/api/diary/meta").then((r) => r.json()),
          fetch("/api/todo/history?limit=90").then((r) => r.json()),
          fetch(`/api/expenses/analysis?month=${monthStr}`).then((r) => r.json()),
          fetch("/api/expenses/wallet").then((r) => r.json()),
        ]);

      // typing
      if (typingRes.success) {
        setTyping({
          highestWpm:      typingRes.stats.highestWpm,
          highestAccuracy: typingRes.stats.highestAccuracy,
          totalTests:      typingRes.globalTotalTests,
          averageWpm:      typingRes.stats.averageWpm,
        });
      }

      // work
      if (workRes.success) {
        const d = workRes.data;
        setWork({
          totalLoggedDays:  d.totalLoggedDays,
          totalProductiveH: d.totalProductiveH,
          totalRequiredH:   d.totalRequiredH,
          consistencyScore: d.consistencyScore,
          currentStreak:    d.currentStreak,
          overtimeH:        d.overtimeH,
          underworkH:       d.underworkH,
          avgEntryTime:     d.avgEntryTime,
        });
      }

      // diary
      if (diaryRes.dates) {
        setDiary({ totalEntries: diaryRes.totalPages, dates: diaryRes.dates });
      }

      // todo — aggregate from history
      if (todoHistRes.success) {
        const history: { totalTasks: number; completed: number }[] =
          todoHistRes.history ?? [];
        const total     = history.reduce((a, d) => a + d.totalTasks, 0);
        const completed = history.reduce((a, d) => a + d.completed, 0);

        // Today's tasks (separate call)
        let todayTasks = 0;
        let todayCompleted = 0;
        try {
          const todayRes = await fetch("/api/todo").then((r) => r.json());
          if (todayRes.success) {
            todayTasks     = (todayRes.tasks ?? []).length;
            todayCompleted = (todayRes.tasks ?? []).filter((t: any) => t.completed).length;
          }
        } catch { /* silent */ }

        setTodo({
          totalDays:      history.length,
          totalTasks:     total + todayTasks,
          completedTasks: completed + todayCompleted,
          todayTasks,
          todayCompleted,
        });
      }

      // expenses
      if (expenseRes.success) {
        const wallet = walletRes.success ? walletRes.wallet : null;
        setExpense({
          totalSpent:      expenseRes.summary.totalSpent,
          totalAdded:      expenseRes.summary.totalAdded,
          cashBalance:     wallet?.cashBalance   ?? 0,
          onlineBalance:   wallet?.onlineBalance ?? 0,
          totalBalance:    wallet?.totalBalance  ?? 0,
          biggestCategory: expenseRes.summary.biggestCategory,
          expenseCount:    expenseRes.summary.expenseCount,
        });
      }

    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) return <Skeleton />;

  // ── error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <AlertCircle size={32} style={{ color: "var(--danger)" }} />
        <div>
          <p className="font-semibold" style={{ color: "var(--text)" }}>Failed to load insights</p>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Check your connection and try again.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer border-none"
          style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // ── derived values ────────────────────────────────────────────────────────
  const now          = new Date();
  const thisMonthPfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const diaryThisMonth = diary?.dates.filter((d) => d.startsWith(thisMonthPfx)).length ?? 0;

  const consistencyColor =
    (work?.consistencyScore ?? 0) >= 80
      ? "var(--green)"
      : (work?.consistencyScore ?? 0) >= 50
      ? "var(--amber)"
      : "var(--danger)";

  const todoCompletionPct =
    (todo?.totalTasks ?? 0) > 0
      ? Math.round(((todo?.completedTasks ?? 0) / (todo?.totalTasks ?? 1)) * 100)
      : 0;

  const todoTodayPct =
    (todo?.todayTasks ?? 0) > 0
      ? Math.round(((todo?.todayCompleted ?? 0) / (todo?.todayTasks ?? 1)) * 100)
      : 0;

  return (
    <div className="space-y-7">

      {/* ════════════════════════════════════════════
          WORK LOGS (current month)
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Clock}
          title={`Work Logs — ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`}
          color="var(--green)"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatCard
            icon={Clock}
            label="Productive"
            value={`${work?.totalProductiveH ?? 0}h`}
            sub={`of ${work?.totalRequiredH ?? 0}h required`}
            iconColor="var(--green)"
            iconBg="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={Calendar}
            label="Days Logged"
            value={work?.totalLoggedDays ?? 0}
            sub="this month"
            iconColor="#60a5fa"
            iconBg="rgba(96,165,250,0.12)"
          />
          <StatCard
            icon={Flame}
            label="Streak"
            value={`${work?.currentStreak ?? 0}d`}
            sub="current streak"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
            badge={
              (work?.currentStreak ?? 0) >= 5
                ? { text: "🔥 Hot", color: "var(--amber)", bg: "rgba(245,158,11,0.10)" }
                : undefined
            }
          />
          <StatCard
            icon={(work?.overtimeH ?? 0) > 0 ? TrendingUp : TrendingDown}
            label={(work?.overtimeH ?? 0) > 0 ? "Overtime" : "Underwork"}
            value={`${(work?.overtimeH ?? 0) > 0 ? work!.overtimeH : (work?.underworkH ?? 0)}h`}
            sub={(work?.overtimeH ?? 0) > 0 ? "extra this month" : "below target"}
            iconColor={(work?.overtimeH ?? 0) > 0 ? "var(--green)" : "var(--danger)"}
            iconBg={
              (work?.overtimeH ?? 0) > 0
                ? "rgba(34,211,160,0.12)"
                : "rgba(248,113,113,0.12)"
            }
          />
        </div>

        {/* consistency bar */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} style={{ color: consistencyColor }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Consistency Score
              </span>
            </div>
            <span className="text-sm font-bold font-mono" style={{ color: consistencyColor }}>
              {work?.consistencyScore ?? 0}%
            </span>
          </div>
          <ProgressBar value={work?.consistencyScore ?? 0} color={consistencyColor} />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs" style={{ color: "var(--text4)" }}>
              {(work?.consistencyScore ?? 0) === 100
                ? "Perfect month! 🎉"
                : (work?.consistencyScore ?? 0) >= 80
                ? "Great consistency"
                : (work?.consistencyScore ?? 0) >= 50
                ? "Room to improve"
                : "Getting started"}
            </p>
            {work?.avgEntryTime && (
              <p className="text-xs" style={{ color: "var(--text4)" }}>
                Avg entry: <span style={{ color: "var(--text2)" }}>{work.avgEntryTime}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          DIARY ENTRIES
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={BookOpen} title="Diary Entries" color="#f472b6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            icon={BookOpen}
            label="Total Entries"
            value={diary?.totalEntries ?? 0}
            sub="all time"
            iconColor="#f472b6"
            iconBg="rgba(244,114,182,0.12)"
          />
          <StatCard
            icon={Calendar}
            label="This Month"
            value={diaryThisMonth}
            sub={`entries in ${now.toLocaleString("default", { month: "long" })}`}
            iconColor="var(--accent)"
            iconBg="rgba(124,110,243,0.12)"
            badge={
              diaryThisMonth >= 10
                ? { text: "Active", color: "#f472b6", bg: "rgba(244,114,182,0.10)" }
                : undefined
            }
          />
          <StatCard
            icon={Flame}
            label="Writing Streak"
            value={(() => {
              if (!diary || diary.dates.length === 0) return "0d";
              const sorted = [...diary.dates].sort().reverse();
              let streak = 0;
              const d = new Date();
              for (const date of sorted) {
                const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                if (date === expected) {
                  streak++;
                  d.setDate(d.getDate() - 1);
                } else break;
              }
              return `${streak}d`;
            })()}
            sub="consecutive days"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          TO-DO LISTS
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={ListChecks} title="To-Do Lists" color="#22d3a0" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatCard
            icon={ListChecks}
            label="Total Tasks"
            value={todo?.totalTasks ?? 0}
            sub="across all days"
            iconColor="var(--green)"
            iconBg="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={todo?.completedTasks ?? 0}
            sub={`${todoCompletionPct}% completion rate`}
            iconColor="#60a5fa"
            iconBg="rgba(96,165,250,0.12)"
            badge={
              todoCompletionPct >= 80
                ? { text: "🎯 Great", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" }
                : undefined
            }
          />
          <StatCard
            icon={Calendar}
            label="Days Tracked"
            value={todo?.totalDays ?? 0}
            sub="days with todos"
            iconColor="var(--accent)"
            iconBg="rgba(124,110,243,0.12)"
          />
          <StatCard
            icon={Zap}
            label="Today"
            value={`${todo?.todayCompleted ?? 0}/${todo?.todayTasks ?? 0}`}
            sub="tasks done today"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
            badge={
              (todo?.todayTasks ?? 0) > 0 && todo?.todayCompleted === todo?.todayTasks
                ? { text: "✓ Done", color: "var(--green)", bg: "rgba(34,211,160,0.10)" }
                : undefined
            }
          />
        </div>

        {/* Overall completion bar */}
        {(todo?.totalTasks ?? 0) > 0 && (
          <div
            className="rounded-2xl px-5 py-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 size={14} style={{ color: "var(--green)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Overall Completion
                </span>
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: "var(--green)" }}>
                {todoCompletionPct}%
              </span>
            </div>
            <ProgressBar value={todoCompletionPct} color="var(--green)" />
            {(todo?.todayTasks ?? 0) > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "var(--text4)" }}>Today's progress</span>
                  <span className="text-xs font-mono" style={{ color: "var(--amber)" }}>
                    {todoTodayPct}%
                  </span>
                </div>
                <ProgressBar value={todoTodayPct} color="var(--amber)" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════
          TYPING TEST
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Keyboard} title="Typing Test" color="#60a5fa" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Zap}
            label="Best Speed"
            value={`${typing?.highestWpm ?? 0}`}
            sub="WPM — all-time high"
            iconColor="#60a5fa"
            iconBg="rgba(96,165,250,0.12)"
            badge={
              (typing?.highestWpm ?? 0) >= 60
                ? { text: "Fast", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" }
                : undefined
            }
          />
          <StatCard
            icon={Target}
            label="Best Accuracy"
            value={`${typing?.highestAccuracy ?? 0}%`}
            sub="highest ever"
            iconColor="var(--green)"
            iconBg="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Speed"
            value={`${typing?.averageWpm ?? 0}`}
            sub="WPM — overall avg"
            iconColor="var(--accent)"
            iconBg="rgba(124,110,243,0.12)"
          />
          <StatCard
            icon={BarChart2}
            label="Tests Done"
            value={typing?.totalTests ?? 0}
            sub="all time"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
          />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          EXPENSES (current month)
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Wallet}
          title={`Expenses — ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`}
          color="var(--accent)"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatCard
            icon={ShoppingCart}
            label="Total Spent"
            value={fmtCurrency(expense?.totalSpent ?? 0)}
            sub={`${expense?.expenseCount ?? 0} transactions`}
            iconColor="var(--danger)"
            iconBg="rgba(248,113,113,0.12)"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Added"
            value={fmtCurrency(expense?.totalAdded ?? 0)}
            sub="money added this month"
            iconColor="var(--green)"
            iconBg="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={DollarSign}
            label="Cash Balance"
            value={fmtCurrency(expense?.cashBalance ?? 0)}
            sub="available in cash"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
          />
          <StatCard
            icon={CreditCard}
            label="Online Balance"
            value={fmtCurrency(expense?.onlineBalance ?? 0)}
            sub="available online"
            iconColor="#60a5fa"
            iconBg="rgba(96,165,250,0.12)"
          />
        </div>

        {/* Wallet summary bar */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Wallet Overview
              </span>
            </div>
            <span className="text-sm font-bold font-mono" style={{ color: "var(--accent)" }}>
              {fmtCurrency(expense?.totalBalance ?? 0)} total
            </span>
          </div>

          {/* Cash vs Online split bars */}
          {(expense?.totalBalance ?? 0) > 0 && (
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text4)" }}>Cash</span>
                  <span className="text-xs font-mono" style={{ color: "var(--amber)" }}>
                    {Math.round(((expense?.cashBalance ?? 0) / (expense?.totalBalance ?? 1)) * 100)}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.round(((expense?.cashBalance ?? 0) / (expense?.totalBalance ?? 1)) * 100)}
                  color="var(--amber)"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text4)" }}>Online</span>
                  <span className="text-xs font-mono" style={{ color: "#60a5fa" }}>
                    {Math.round(((expense?.onlineBalance ?? 0) / (expense?.totalBalance ?? 1)) * 100)}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.round(((expense?.onlineBalance ?? 0) / (expense?.totalBalance ?? 1)) * 100)}
                  color="#60a5fa"
                />
              </div>
            </div>
          )}

          {expense?.biggestCategory && expense.biggestCategory !== "None" && (
            <p className="text-xs mt-3" style={{ color: "var(--text4)" }}>
              Top category this month:{" "}
              <span style={{ color: "var(--text2)", fontWeight: 600 }}>
                {expense.biggestCategory}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* ── Empty state — no activity at all ── */}
      {!typing?.totalTests &&
        !work?.totalLoggedDays &&
        !diary?.totalEntries &&
        !(todo?.totalTasks) &&
        !(expense?.expenseCount) && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "var(--surface2)", border: "1px dashed var(--border2)" }}
          >
            <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              No activity yet
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
              Start logging work, typing tests, diary entries, to-do tasks, or expenses — your stats will appear here.
            </p>
          </div>
        )}
    </div>
  );
}