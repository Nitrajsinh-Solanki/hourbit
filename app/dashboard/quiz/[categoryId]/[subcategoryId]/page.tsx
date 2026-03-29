// app/dashboard/quiz/[categoryId]/[subcategoryId]/page.tsx
//
// CHANGES:
//  FIX 3 — Added a manual "Refresh" button in the header so users can
//           pull fresh level state without a full page reload.
//  FIX 4 — UX improvements:
//           • Skeleton loaders while fetching
//           • Better exhausted-level visual treatment
//           • Smooth focus/hover transitions on cards
//           • Progress bar on each card shows attempt utilisation
//           • Breadcrumb back button

// app/dashboard/quiz/[categoryId]/[subcategoryId]/page.tsx
//
// FIXES:
//  FIX 1 — "Unavailable" shown instead of "View Result" when attemptsRemaining === 0
//           but isExhausted DB flag not yet set. Added isEffectivelyExhausted which
//           treats a level as exhausted when attemptsRemaining === 0 && !isCompleted.
//  FIX 2 — XP consolation row now also shows for isEffectivelyExhausted levels.
//  FIX 3 — Manual Refresh button in header.
//  FIX 4 — UX: skeleton loaders, progress bars, exhausted border/icon treatment.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams }             from "next/navigation";
import {
  ChevronLeft, Lock, CheckCircle, Clock, Star,
  Zap, AlertTriangle, RotateCcw, RefreshCw,
  Trophy, Target,
} from "lucide-react";
import toast from "react-hot-toast";

type Level = {
  _id:                   string;
  levelNumber:           number;
  name:                  string;
  difficulty:            "easy" | "medium" | "hard" | "expert";
  xpReward:              number;
  penaltyXpMultiplier:   number;
  maxAttempts:           number;
  attemptsUsed:          number;
  attemptsRemaining:     number;
  questionCount:         number;
  timeLimitMinutes:      number;
  isUnlocked:            boolean;
  isCompleted:           boolean;
  isExhausted:           boolean;
  earnedXp:              number;
  bestScore:             number;
  unlockedViaExhaustion: boolean;
};

const DIFF_META = {
  easy:   { color: "var(--green)",  bg: "rgba(34,211,160,0.12)",  label: "Easy"   },
  medium: { color: "var(--amber)",  bg: "rgba(245,158,11,0.12)",  label: "Medium" },
  hard:   { color: "#f472b6",       bg: "rgba(244,114,182,0.12)", label: "Hard"   },
  expert: { color: "var(--danger)", bg: "rgba(248,113,113,0.12)", label: "Expert" },
};

function LevelSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl shrink-0"
          style={{ background: "var(--surface2)" }} />
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-4 rounded-lg w-48" style={{ background: "var(--surface2)" }} />
          <div className="h-3 rounded-lg w-64" style={{ background: "var(--surface2)" }} />
          <div className="h-2 rounded-lg w-32" style={{ background: "var(--surface2)" }} />
        </div>
        <div className="w-20 h-9 rounded-xl shrink-0" style={{ background: "var(--surface2)" }} />
      </div>
    </div>
  );
}

export default function LevelSelectionPage() {
  const router = useRouter();
  const { categoryId, subcategoryId } =
    useParams<{ categoryId: string; subcategoryId: string }>();

  const [levels,     setLevels]     = useState<Level[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // FIX 3: Reusable fetch function exposed to both useEffect and Refresh button
  const fetchLevels = useCallback(async (showRefreshSpinner = false) => {
    if (!subcategoryId) return;
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);

    try {
      const res  = await fetch(`/api/quiz/levels?subcategoryId=${subcategoryId}`);
      const data = await res.json();
      if (data.success) {
        setLevels(data.levels);
      } else {
        toast.error(data.message || "Failed to load levels");
      }
    } catch {
      toast.error("Network error — could not load levels");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subcategoryId]);

  useEffect(() => {
    fetchLevels();
    // Re-fetch when user tabs back (e.g. after completing a quiz)
    const handleFocus = () => fetchLevels(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchLevels]);

  // Summary stats — use isEffectivelyExhausted for accuracy
  const completedCount = levels.filter(l => l.isCompleted).length;
  const exhaustedCount = levels.filter(l =>
    (l.isExhausted || (l.attemptsRemaining === 0 && !l.isCompleted)) && !l.isCompleted
  ).length;
  const totalCount  = levels.length;
  const earnedXpSum = levels.reduce((sum, l) => sum + (l.earnedXp ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Back + Header ── */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-mono mb-4 cursor-pointer border-none bg-transparent transition-colors"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
        >
          <ChevronLeft size={15} /> Back to Subcategories
        </button>

        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(124,110,243,0.10), rgba(245,158,11,0.06))",
            border:     "1px solid rgba(124,110,243,0.22)",
          }}
        >
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
              Select a Level
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              Complete levels in order — each one unlocks the next.
            </p>
          </div>

          {/* FIX 3: Manual refresh button */}
          <button
            onClick={() => fetchLevels(true)}
            disabled={refreshing || loading}
            title="Refresh levels"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: "rgba(124,110,243,0.12)",
              border:     "1px solid rgba(124,110,243,0.25)",
              color:      "var(--accent)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background  = "rgba(124,110,243,0.22)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.45)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background  = "rgba(124,110,243,0.12)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.25)";
            }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Progress summary bar ── */}
      {!loading && levels.length > 0 && (
        <div className="rounded-xl px-5 py-4 grid grid-cols-4 gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          {[
            {
              icon:  <CheckCircle size={14} />,
              label: "Passed",
              value: `${completedCount}/${totalCount}`,
              color: "var(--green)",
            },
            {
              icon:  <AlertTriangle size={14} />,
              label: "Exhausted",
              value: String(exhaustedCount),
              color: exhaustedCount > 0 ? "var(--danger)" : "var(--text4)",
            },
            {
              icon:  <Trophy size={14} />,
              label: "Completion",
              value: totalCount > 0
                ? `${Math.round((completedCount / totalCount) * 100)}%`
                : "0%",
              color: "var(--accent)",
            },
            {
              icon:  <Zap size={14} />,
              label: "XP Earned",
              value: `${earnedXpSum.toLocaleString()}`,
              color: "var(--amber)",
            },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <div style={{ color: s.color }}>{s.icon}</div>
              <p className="text-[16px] font-bold font-mono" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: "var(--text4)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Level list ── */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4].map(i => <LevelSkeleton key={i} />)}
        </div>
      ) : levels.length === 0 ? (
        <div
          className="rounded-2xl py-20 text-center flex flex-col items-center gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <Target size={36} style={{ color: "var(--text4)" }} />
          <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
            No levels available in this subcategory yet.
          </p>
          <button
            onClick={() => fetchLevels(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer mt-1"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {levels.map((level) => {
            const diff   = DIFF_META[level.difficulty] ?? DIFF_META.easy;
            const locked = !level.isUnlocked;

            // ── FIX 1: isEffectivelyExhausted covers the edge case where
            // attemptsRemaining hit 0 but the isExhausted DB flag wasn't flushed yet.
            const isEffectivelyExhausted =
              level.isExhausted || (level.attemptsRemaining === 0 && !level.isCompleted);

            const showViewResult = level.isCompleted || isEffectivelyExhausted;
            const canStart       = level.isUnlocked && !level.isCompleted && !isEffectivelyExhausted && level.attemptsRemaining > 0;
            const exhaustionXp   = Math.floor(level.xpReward * (level.penaltyXpMultiplier ?? 0.30));
            const attemptsPct    = level.maxAttempts > 0
              ? Math.round((level.attemptsUsed / level.maxAttempts) * 100)
              : 0;

            return (
              <div
                key={level._id}
                className="rounded-2xl p-5 transition-all"
                style={{
                  background: "var(--surface)",
                  border: level.isCompleted
                    ? "1px solid rgba(34,211,160,0.35)"
                    : isEffectivelyExhausted
                    ? "1px solid rgba(248,113,113,0.25)"
                    : locked
                    ? "1px solid var(--border)"
                    : "1px solid var(--border2)",
                  opacity: locked ? 0.55 : 1,
                }}
                onMouseEnter={e => {
                  if (!locked) {
                    (e.currentTarget as HTMLElement).style.borderColor = level.isCompleted
                      ? "rgba(34,211,160,0.55)"
                      : "rgba(124,110,243,0.35)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = level.isCompleted
                    ? "rgba(34,211,160,0.35)"
                    : isEffectivelyExhausted
                    ? "rgba(248,113,113,0.25)"
                    : locked
                    ? "var(--border)"
                    : "var(--border2)";
                }}
              >
                <div className="flex items-start justify-between gap-4">

                  {/* ── Left ── */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">

                    {/* Level number / status bubble */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-[15px]"
                      style={{
                        background: level.isCompleted
                          ? "rgba(34,211,160,0.15)"
                          : isEffectivelyExhausted
                          ? "rgba(248,113,113,0.12)"
                          : locked
                          ? "var(--surface2)"
                          : diff.bg,
                        color: level.isCompleted
                          ? "var(--green)"
                          : isEffectivelyExhausted
                          ? "var(--danger)"
                          : locked
                          ? "var(--text4)"
                          : diff.color,
                      }}
                    >
                      {locked
                        ? <Lock size={16} />
                        : level.isCompleted
                        ? <CheckCircle size={16} />
                        : isEffectivelyExhausted
                        ? <AlertTriangle size={15} />
                        : level.levelNumber}
                    </div>

                    <div className="flex-1 min-w-0">

                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>
                          Level {level.levelNumber}
                          {level.name ? ` — ${level.name}` : ""}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: diff.color, background: diff.bg }}
                        >
                          {diff.label}
                        </span>
                        {level.unlockedViaExhaustion && !level.isCompleted && !isEffectivelyExhausted && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: "var(--amber)", background: "rgba(245,158,11,0.12)" }}
                          >
                            ⚠ {Math.round((level.penaltyXpMultiplier ?? 0.30) * 100)}% XP if passed
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Zap size={11} style={{ color: "var(--amber)" }} />
                          <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                            {level.xpReward} XP
                          </span>
                        </div>
                        {level.timeLimitMinutes > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} style={{ color: "var(--text4)" }} />
                            <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                              {level.timeLimitMinutes}m
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Star size={11} style={{ color: "var(--text4)" }} />
                          <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                            {level.questionCount} questions
                          </span>
                        </div>
                        {!locked && !level.isCompleted && !isEffectivelyExhausted && (
                          <div className="flex items-center gap-1.5">
                            <RotateCcw size={11} style={{ color: "var(--text4)" }} />
                            <span
                              className="text-[11px] font-mono"
                              style={{
                                color: level.attemptsRemaining <= 1
                                  ? "var(--danger)"
                                  : "var(--text3)",
                              }}
                            >
                              {level.attemptsRemaining}/{level.maxAttempts} attempts left
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Completed: best score + XP */}
                      {level.isCompleted && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] font-mono font-semibold"
                            style={{ color: "var(--green)" }}>
                            ✓ Best score: {level.bestScore}%
                          </span>
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--amber)" }}>
                            +{level.earnedXp} XP earned
                          </span>
                        </div>
                      )}

                      {/* FIX 2: Exhausted — show consolation XP row for BOTH
                          isExhausted flag AND isEffectivelyExhausted edge case */}
                      {isEffectivelyExhausted && !level.isCompleted && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <AlertTriangle size={11} style={{ color: "var(--danger)" }} />
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--danger)" }}>
                            All {level.maxAttempts} attempts used
                          </span>
                          {level.earnedXp > 0 && (
                            <span className="text-[11px] font-mono"
                              style={{ color: "var(--amber)" }}>
                              · +{level.earnedXp} XP ({Math.round((level.penaltyXpMultiplier ?? 0.30) * 100)}% consolation)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Last attempt warning */}
                      {!locked && !level.isCompleted && !isEffectivelyExhausted && level.attemptsRemaining === 1 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <AlertTriangle size={11} style={{ color: "var(--amber)" }} />
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--amber)" }}>
                            Last attempt — fail awards {exhaustionXp} XP ({Math.round((level.penaltyXpMultiplier ?? 0.30) * 100)}%)
                          </span>
                        </div>
                      )}

                      {/* Attempt progress bar (in-progress levels only) */}
                      {!locked && !level.isCompleted && !isEffectivelyExhausted && level.attemptsUsed > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-mono"
                              style={{ color: "var(--text4)" }}>
                              Attempts used
                            </span>
                            <span className="text-[10px] font-mono"
                              style={{ color: "var(--text4)" }}>
                              {level.attemptsUsed}/{level.maxAttempts}
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden"
                            style={{ background: "var(--border)", maxWidth: "160px" }}>
                            <div className="h-full rounded-full"
                              style={{
                                width:      `${attemptsPct}%`,
                                background: level.attemptsRemaining <= 1
                                  ? "var(--danger)"
                                  : "var(--amber)",
                              }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Action button ── */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {locked ? (
                      <div
                        className="px-4 py-2 rounded-xl text-[12px] font-mono flex items-center gap-1.5"
                        style={{ color: "var(--text4)", background: "var(--surface2)" }}
                      >
                        <Lock size={11} /> Locked
                      </div>

                    ) : showViewResult ? (
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/quiz/${categoryId}/${subcategoryId}/${level._id}`
                          )
                        }
                        className="px-4 py-2 rounded-xl text-[12px] font-mono font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
                        style={{
                          color:      level.isCompleted ? "var(--green)" : "var(--amber)",
                          background: level.isCompleted
                            ? "rgba(34,211,160,0.12)"
                            : "rgba(245,158,11,0.12)",
                          border: level.isCompleted
                            ? "1px solid rgba(34,211,160,0.30)"
                            : "1px solid rgba(245,158,11,0.25)",
                        }}
                      >
                        {level.isCompleted ? "View Result ✓" : "View Result →"}
                      </button>

                    ) : canStart ? (
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/quiz/${categoryId}/${subcategoryId}/${level._id}`
                          )
                        }
                        className="px-5 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
                        style={{
                          background: level.attemptsRemaining === 1
                            ? "linear-gradient(135deg, #f87171, #ef4444)"
                            : "var(--accent)",
                          color:     "#fff",
                          boxShadow: level.attemptsRemaining === 1
                            ? "0 0 14px rgba(248,113,113,0.30)"
                            : "0 0 14px rgba(124,110,243,0.28)",
                        }}
                      >
                        {level.attemptsUsed > 0
                          ? level.attemptsRemaining === 1
                            ? "⚠ Last Retry →"
                            : "Retry →"
                          : "Start →"}
                      </button>

                    ) : (
                      <div
                        className="px-4 py-2 rounded-xl text-[12px] font-mono"
                        style={{ color: "var(--text4)", background: "var(--surface2)" }}
                      >
                        Unavailable
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}