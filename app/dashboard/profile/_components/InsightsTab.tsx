// app/dashboard/profile/_components/InsightsTab.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Keyboard,
  Brain,
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

type QuizData = {
  totalXp: number;
  categories: { name: string; completedLevels: number; totalLevels: number }[];
};

type DiaryData = {
  totalEntries: number;
  dates: string[];
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
      {[1, 2, 3].map((s) => (
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

// ── Main component ────────────────────────────────────────────────────────────
export default function InsightsTab() {
  const [typing, setTyping]   = useState<TypingStats | null>(null);
  const [work,   setWork]     = useState<WorkData | null>(null);
  const [quiz,   setQuiz]     = useState<QuizData | null>(null);
  const [diary,  setDiary]    = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth() + 1;

      const [typingRes, xpRes, catRes, workRes, diaryRes] = await Promise.all([
        fetch("/api/typing/stats?timer=0").then((r) => r.json()),
        fetch("/api/quiz/xp").then((r) => r.json()),
        fetch("/api/quiz/categories").then((r) => r.json()),
        fetch(`/api/work/analysis?year=${year}&month=${month}`).then((r) => r.json()),
        fetch("/api/diary/meta").then((r) => r.json()),
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

      // quiz
      setQuiz({
        totalXp:    xpRes.success ? xpRes.totalXp : 0,
        categories: catRes.success ? catRes.categories : [],
      });

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
  const totalQuizLevels     = quiz?.categories.reduce((a, c) => a + c.totalLevels, 0) ?? 0;
  const completedQuizLevels = quiz?.categories.reduce((a, c) => a + c.completedLevels, 0) ?? 0;
  const quizProgress        = totalQuizLevels > 0 ? Math.round((completedQuizLevels / totalQuizLevels) * 100) : 0;

  // diary — entries this month
  const now         = new Date();
  const thisMonthPfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const diaryThisMonth = diary?.dates.filter((d) => d.startsWith(thisMonthPfx)).length ?? 0;

  // work consistency colour
  const consistencyColor =
    (work?.consistencyScore ?? 0) >= 80
      ? "var(--green)"
      : (work?.consistencyScore ?? 0) >= 50
      ? "var(--amber)"
      : "var(--danger)";

  return (
    <div className="space-y-7">

      {/* ════════════════════════════════════════════
          TYPING
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Keyboard} title="Typing" color="#60a5fa" />
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
          WORK HOURS (current month)
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Clock} title={`Work Hours — ${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`} color="var(--green)" />
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
              {work?.consistencyScore === 100
                ? "Perfect month! 🎉"
                : work?.consistencyScore ?? 0 >= 80
                ? "Great consistency"
                : work?.consistencyScore ?? 0 >= 50
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
          BRAIN QUIZ
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={Brain} title="Brain Quiz" color="var(--accent)" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <StatCard
            icon={Zap}
            label="Total XP"
            value={quiz?.totalXp.toLocaleString() ?? "0"}
            sub="brain XP earned"
            iconColor="var(--amber)"
            iconBg="rgba(245,158,11,0.12)"
          />
          <StatCard
            icon={CheckCircle2}
            label="Levels Done"
            value={completedQuizLevels}
            sub={`of ${totalQuizLevels} total`}
            iconColor="var(--green)"
            iconBg="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={Brain}
            label="Categories"
            value={quiz?.categories.length ?? 0}
            sub="available to explore"
            iconColor="var(--accent)"
            iconBg="rgba(124,110,243,0.12)"
          />
        </div>

        {/* per-category progress */}
        {(quiz?.categories.length ?? 0) > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border2)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
                Progress by category
              </p>
            </div>
            <div className="p-4 space-y-3">
              {quiz!.categories.map((cat) => {
                const pct = cat.totalLevels > 0
                  ? Math.round((cat.completedLevels / cat.totalLevels) * 100)
                  : 0;
                const color =
                  pct === 100 ? "var(--green)" : pct > 0 ? "var(--accent)" : "var(--border2)";
                return (
                  <div key={String(cat.name)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: "var(--text2)" }}>
                        {cat.name}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "var(--text3)" }}>
                        {cat.completedLevels}/{cat.totalLevels}
                      </span>
                    </div>
                    <ProgressBar value={pct} color={color} />
                  </div>
                );
              })}
            </div>

            {/* overall bar */}
            <div
              className="px-4 pb-4 pt-1"
              style={{ borderTop: "1px solid var(--border2)", marginTop: 4 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
                  Overall
                </span>
                <span className="text-xs font-bold font-mono" style={{ color: "var(--accent)" }}>
                  {quizProgress}%
                </span>
              </div>
              <ProgressBar value={quizProgress} color="var(--accent)" />
            </div>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════
          DIARY
      ════════════════════════════════════════════ */}
      <section>
        <SectionHeader icon={BookOpen} title="Diary" color="#f472b6" />
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
              if (!diary || diary.dates.length === 0) return 0;
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

      {/* ── Empty state — no activity at all ── */}
      {!typing?.totalTests && !work?.totalLoggedDays && !diary?.totalEntries && !quiz?.totalXp && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--surface2)", border: "1px dashed var(--border2)" }}
        >
          <p className="text-lg font-semibold" style={{ color: "var(--text)" }}>No activity yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
            Start logging work, taking quizzes, typing tests, or writing diary entries — your stats will appear here.
          </p>
        </div>
      )}

    </div>
  );
}