// app/dashboard/quiz/[categoryId]/[subcategoryId]/page.tsx
"use client";

import { useEffect, useState }  from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft, Lock, CheckCircle, Clock, Star,
  Zap, AlertTriangle, RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";

type Level = {
  _id:                  string;
  levelNumber:          number;
  name:                 string;
  difficulty:           "easy" | "medium" | "hard" | "expert";
  xpReward:             number;
  penaltyXpMultiplier:  number;
  maxAttempts:          number;
  attemptsUsed:         number;
  attemptsRemaining:    number;
  questionCount:        number;
  timeLimitMinutes:     number;
  isUnlocked:           boolean;
  isCompleted:          boolean;
  isExhausted:          boolean;
  earnedXp:             number;
  bestScore:            number;
  unlockedViaExhaustion:boolean;
};

const DIFF_META = {
  easy:   { color: "var(--green)",  bg: "rgba(34,211,160,0.12)",  label: "Easy"   },
  medium: { color: "var(--amber)",  bg: "rgba(245,158,11,0.12)",  label: "Medium" },
  hard:   { color: "#f472b6",       bg: "rgba(244,114,182,0.12)", label: "Hard"   },
  expert: { color: "var(--danger)", bg: "rgba(248,113,113,0.12)", label: "Expert" },
};

export default function LevelSelectionPage() {
  const router = useRouter();
  const { categoryId, subcategoryId } = useParams<{ categoryId: string; subcategoryId: string }>();

  const [levels,  setLevels]  = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLevels = () => {
    if (!subcategoryId) return;
    setLoading(true);
    fetch(`/api/quiz/levels?subcategoryId=${subcategoryId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setLevels(d.levels);
        else toast.error(d.message);
      })
      .catch(() => toast.error("Failed to load levels"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLevels(); }, [subcategoryId]);

  const handleStart = (level: Level) => {
    if (!level.isUnlocked) {
      toast.error("Complete the previous level to unlock this one.");
      return;
    }
    if (level.isCompleted) {
      toast("You already completed this level!", { icon: "✅" });
      return;
    }
    if (level.attemptsRemaining === 0) {
      toast.error("No attempts remaining for this level.");
      return;
    }
    router.push(`/dashboard/quiz/${categoryId}/${subcategoryId}/${level._id}`);
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Back + header */}
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

        <div className="rounded-2xl px-6 py-5"
          style={{
            background: "linear-gradient(135deg, rgba(124,110,243,0.10), rgba(245,158,11,0.06))",
            border:     "1px solid rgba(124,110,243,0.22)",
          }}>
          <h1 className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
            Select Level
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
            Complete levels in order. Each level unlocks the next.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl h-28 animate-pulse"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }} />
          ))}
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
            No levels available.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {levels.map(level => {
            const diff    = DIFF_META[level.difficulty] ?? DIFF_META.easy;
            const locked  = !level.isUnlocked;
            const canStart = level.isUnlocked && !level.isCompleted && level.attemptsRemaining > 0;

            return (
              <div
                key={level._id}
                className="rounded-2xl p-5 transition-all"
                style={{
                  background: locked ? "var(--surface)" : "var(--surface)",
                  border:     level.isCompleted
                    ? "1px solid rgba(34,211,160,0.35)"
                    : locked
                    ? "1px solid var(--border)"
                    : "1px solid var(--border2)",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Level number bubble */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-[15px]"
                      style={{
                        background: level.isCompleted
                          ? "rgba(34,211,160,0.15)"
                          : locked
                          ? "var(--surface2)"
                          : diff.bg,
                        color: level.isCompleted
                          ? "var(--green)"
                          : locked
                          ? "var(--text4)"
                          : diff.color,
                      }}
                    >
                      {locked
                        ? <Lock size={16} />
                        : level.isCompleted
                        ? <CheckCircle size={16} />
                        : level.levelNumber}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>
                          Level {level.levelNumber}
                          {level.name ? ` — ${level.name}` : ""}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: diff.color, background: diff.bg }}>
                          {diff.label}
                        </span>
                        {level.unlockedViaExhaustion && !level.isCompleted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: "var(--amber)", background: "rgba(245,158,11,0.12)" }}>
                            ⚠ 30% XP
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
                        {!locked && (
                          <div className="flex items-center gap-1.5">
                            <RotateCcw size={11} style={{ color: "var(--text4)" }} />
                            <span className="text-[11px] font-mono"
                              style={{
                                color: level.attemptsRemaining === 0
                                  ? "var(--danger)"
                                  : "var(--text3)",
                              }}>
                              {level.attemptsRemaining}/{level.maxAttempts} attempts left
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Best score + XP earned */}
                      {level.isCompleted && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--green)" }}>
                            ✓ Score: {level.bestScore}%
                          </span>
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--amber)" }}>
                            +{level.earnedXp} XP earned
                          </span>
                        </div>
                      )}

                      {/* Exhaustion warning */}
                      {level.isExhausted && !level.isCompleted && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <AlertTriangle size={11} style={{ color: "var(--danger)" }} />
                          <span className="text-[11px] font-mono"
                            style={{ color: "var(--danger)" }}>
                            All attempts used
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {locked ? (
                      <div className="px-4 py-2 rounded-xl text-[12px] font-mono"
                        style={{ color: "var(--text4)", background: "var(--surface2)" }}>
                        Locked
                      </div>
                    ) : level.isCompleted ? (
                      <button
                        onClick={() => handleStart(level)}
                        className="px-4 py-2 rounded-xl text-[12px] font-mono font-semibold border-none cursor-not-allowed"
                        style={{
                          color:      "var(--green)",
                          background: "rgba(34,211,160,0.12)",
                        }}
                        disabled
                      >
                        Completed ✓
                      </button>
                    ) :level.attemptsRemaining === 0 ? (
                        <button
                          onClick={() => router.push(`/dashboard/quiz/${categoryId}/${subcategoryId}/${level._id}`)}
                          className="px-4 py-2 rounded-xl text-[12px] font-mono font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
                          style={{ color: "var(--amber)", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                          View Result →
                        </button>
                    ) : (
                      <button
                        onClick={() => handleStart(level)}
                        className="px-5 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
                        style={{
                          background: "var(--accent)",
                          color:      "#fff",
                          boxShadow:  "0 0 16px rgba(124,110,243,0.30)",
                        }}
                      >
                        Start →
                      </button>
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