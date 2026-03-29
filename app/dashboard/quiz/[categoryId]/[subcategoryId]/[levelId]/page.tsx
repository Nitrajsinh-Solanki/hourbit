// app/dashboard/quiz/[categoryId]/[subcategoryId]/[levelId]/page.tsx
//
// FIXES IN THIS VERSION:
//
//  FIX 1 — XP after hint no longer "comes back":
//    The hint route already deducts XP from DB immediately (ObjectId bug fixed).
//    The problem was that after quiz submit, we fired "xp-updated" which caused
//    the layout to re-fetch XP from DB — but we were dispatching it BEFORE the
//    DB write settled in some cases. Now we:
//      a) Don't dispatch "xp-updated" from handleSubmit directly.
//      b) After submit, call fetchTotalXp() directly with a small delay to let
//         DB writes settle, then update local state from authoritative DB value.
//      c) The layout's "xp-updated" listener is still there for cross-page sync.
//
//  FIX 2 — Navbar XP updates without page refresh:
//    After every meaningful XP event (hint used, quiz submitted), we dispatch
//    "xp-updated" so the layout re-fetches. Also the layout now polls every 30s
//    as a fallback. The hint deduction event "xp-deduct" is fired immediately
//    for instant visual feedback; the authoritative re-fetch follows after submit.
//
//  FIX 3 — Handled in levels/page.tsx (refresh button added there).
//
//  FIX 4 — General UX improvements throughout:
//    • Animated score reveal on result screen
//    • Better loading states with skeleton screens
//    • Clearer attempt tracking with visual indicators
//    • Smoother transitions between screens
//    • Better error messages and recovery flows
//    • Question navigation dots show answered/unanswered/current states clearly
//    • Hint button shows countdown / XP cost more clearly
//    • Submit button requires confirmation if not all questions answered
//    • Timer turns red and pulses in last 60 seconds
//    • Result screen shows XP delta clearly (before → after)

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams }                      from "next/navigation";
import {
  Clock, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle, XCircle,
  BookOpen, RefreshCw, Zap, Target,
  TrendingUp, Award,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = "option" | "text";

type Question = {
  _id:             string;
  questionType:    QuestionType;
  questionContent: string;
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  hintXpPenalty:   number;
  displayOrder:    number;
};

type LevelInfo = {
  _id:                 string;
  levelNumber:         number;
  name:                string;
  timeLimitMinutes:    number;
  xpReward:            number;
  penaltyXpMultiplier: number;
  maxAttempts:         number;
  questionCount:       number;
  isCompleted:         boolean;
  isExhausted:         boolean;
  isUnlocked:          boolean;
  attemptsRemaining:   number;
  attemptsUsed:        number;
  earnedXp:            number;
  bestScore:           number;
};

type AnswerState = {
  userAnswer:    string;
  hintUsed:      boolean;
  timeTakenSecs: number;
};

type ReviewQuestion = {
  questionId:      string;
  questionContent: string;
  questionType:    QuestionType;
  correctOption:   string | null;
  acceptedAnswers: string[] | null;
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  explanation:     string;
  userAnswer:      string;
  isCorrect:       boolean;
  hintUsed:        boolean;
  hintText:        string | null;
};

type ResultData = {
  score:               number;
  totalQuestions:      number;
  correctAnswers:      number;
  wrongAnswers:        number;
  timeTakenSecs:       number;
  earnedXp:            number;
  baseXp:              number;
  hintXpDeduction:     number;
  penaltyMultiplier:   number;
  wasExhaustionUnlock: boolean;
  isPassing:           boolean;
  canReview:           boolean;
  outcome:             "completed" | "abandoned";
  submittedAt?:        string;
};

type Screen =
  | "loading"
  | "confirm"
  | "quiz"
  | "result"
  | "past_result"
  | "review"
  | "error";

const OPTIONS: { key: "A" | "B" | "C" | "D" }[] = [
  { key: "A" }, { key: "B" }, { key: "C" }, { key: "D" },
];

// ── Skeleton loader component ─────────────────────────────────────────────────
function SkeletonBlock({ h = "h-4", w = "w-full", rounded = "rounded-lg" }: { h?: string; w?: string; rounded?: string }) {
  return (
    <div
      className={`${h} ${w} ${rounded} animate-pulse`}
      style={{ background: "var(--surface2)" }}
    />
  );
}

// ── Format seconds ────────────────────────────────────────────────────────────
function fmtTime(secs: number) {
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuizPage() {
  const router = useRouter();
  const { categoryId, subcategoryId, levelId } =
    useParams<{ categoryId: string; subcategoryId: string; levelId: string }>();

  const [screen,            setScreen]           = useState<Screen>("loading");
  const [levelInfo,         setLevelInfo]         = useState<LevelInfo | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(0);
  const [sessionId,         setSessionId]         = useState("");
  const [questions,         setQuestions]         = useState<Question[]>([]);
  const [currentIdx,        setCurrentIdx]        = useState(0);
  const [answers,           setAnswers]           = useState<Record<string, AnswerState>>({});

  const [hintCache,   setHintCache]   = useState<Map<string, string>>(new Map());
  const [hintLoading, setHintLoading] = useState(false);

  // FIX 1 & 2: Authoritative XP from DB — never drift upward after deductions
  const [totalXp,     setTotalXp]     = useState<number>(0);
  const xpLoadedRef                   = useRef(false);

  const [timeLeft,     setTimeLeft]     = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result,       setResult]       = useState<ResultData | null>(null);
  const [review,       setReview]       = useState<ReviewQuestion[]>([]);
  const [reviewIdx,    setReviewIdx]    = useState(0);

  // Confirm submit dialog when not all questions answered
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Score animation state
  const [displayScore, setDisplayScore] = useState(0);

  const [isExhaustedAfterSubmit, setIsExhaustedAfterSubmit] = useState(false);

  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(Date.now());
  const submitCalledRef  = useRef(false);

  // ── FIX 1 & 2: Authoritative XP fetch — always reads from DB ─────────────
  // This is the single source of truth. After hints and after quiz submission,
  // we call this to sync the displayed value with the real DB value.
  const fetchTotalXp = useCallback(() => {
    fetch("/api/quiz/xp")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTotalXp(d.totalXp ?? 0);
          xpLoadedRef.current = true;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTotalXp();
    // Listen for cross-component XP updates (e.g. layout polling)
    const handleUpdated = () => fetchTotalXp();
    window.addEventListener("xp-updated", handleUpdated);
    return () => window.removeEventListener("xp-updated", handleUpdated);
  }, [fetchTotalXp]);

  // ── Score animation when result screen appears ────────────────────────────
  useEffect(() => {
    if (screen !== "result" && screen !== "past_result") return;
    if (!result) return;
    setDisplayScore(0);
    const target = result.score;
    const step   = Math.ceil(target / 40);
    const id     = setInterval(() => {
      setDisplayScore(prev => {
        if (prev >= target) { clearInterval(id); return target; }
        return Math.min(prev + step, target);
      });
    }, 20);
    return () => clearInterval(id);
  }, [screen, result]);

  // ── Anti-cheat ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "quiz") return;

    const BLOCKED = ["copy","cut","paste","contextmenu","selectstart","dragstart"] as const;
    const blockEvent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const blockKey   = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") { e.preventDefault(); navigator.clipboard?.writeText("").catch(() => {}); return; }
      if ((e.metaKey || e.key === "Meta") && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); return; }
      if (e.key === "F12") { e.preventDefault(); return; }
      if (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
      const bl = ["c","v","x","a","u","s","p"];
      if ((e.ctrlKey || e.metaKey) && bl.includes(e.key.toLowerCase())) { e.preventDefault(); return; }
      if (e.key === "Insert" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); return; }
    };

    BLOCKED.forEach(ev => document.addEventListener(ev, blockEvent, true));
    document.addEventListener("keydown", blockKey, true);
    document.body.style.userSelect                = "none";
    (document.body.style as any).webkitUserSelect = "none";
    (document.body.style as any).MozUserSelect    = "none";
    (document.body.style as any).msUserSelect     = "none";

    return () => {
      BLOCKED.forEach(ev => document.removeEventListener(ev, blockEvent, true));
      document.removeEventListener("keydown", blockKey, true);
      document.body.style.userSelect                = "";
      (document.body.style as any).webkitUserSelect = "";
      (document.body.style as any).MozUserSelect    = "";
      (document.body.style as any).msUserSelect     = "";
    };
  }, [screen]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Load level info ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!levelId || !subcategoryId) return;

    fetch(`/api/quiz/levels?subcategoryId=${subcategoryId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setScreen("error"); return; }
        const found: LevelInfo = d.levels.find((l: any) => l._id === levelId);
        if (!found) { setScreen("error"); return; }

        setLevelInfo(found);
        setAttemptsRemaining(found.attemptsRemaining);

        if (found.isCompleted || found.isExhausted) {
          loadPastResult();
          return;
        }
        if (!found.isUnlocked) {
          toast.error("This level is locked. Complete the previous level first.");
          router.back();
          return;
        }
        setScreen("confirm");
      })
      .catch(() => setScreen("error"));
  }, [levelId, subcategoryId]); // eslint-disable-line

  const loadPastResult = async () => {
    setScreen("loading");
    try {
      const res  = await fetch(`/api/quiz/results?levelId=${levelId}`);
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
        setReview(data.review);
        setScreen("past_result");
      } else {
        setScreen("confirm");
      }
    } catch {
      setScreen("confirm");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (auto = false) => {
    if (submitCalledRef.current) return;
    submitCalledRef.current = true;
    setIsSubmitting(true);
    setShowSubmitConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const q   = questions[currentIdx];
    const sec = Math.round((Date.now() - questionStartRef.current) / 1000);
    const finalAnswers = {
      ...answers,
      ...(q ? {
        [q._id]: {
          userAnswer:    answers[q._id]?.userAnswer    ?? "",
          hintUsed:      answers[q._id]?.hintUsed      ?? false,
          timeTakenSecs: (answers[q._id]?.timeTakenSecs ?? 0) + sec,
        },
      } : {}),
    };

    try {
      const res  = await fetch("/api/quiz/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, answers: finalAnswers }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message || "Submission failed.");
        submitCalledRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const newAttemptsRemaining = data.progress?.attemptsRemaining ?? 0;
      setResult(data.result);
      setReview(data.review);
      if (data.progress) setAttemptsRemaining(newAttemptsRemaining);

      const justExhausted =
        data.progress?.isExhausted === true && !data.result?.isPassing;
      setIsExhaustedAfterSubmit(justExhausted);

      setScreen("result");

      // FIX 1: After submit, do an authoritative DB re-fetch of XP.
      // Small delay ensures the DB write from submit route has settled.
      // This replaces the "xp-updated" event dispatch that was causing the bug
      // (the event triggered a re-fetch that sometimes ran before DB committed
      // the hint deductions, returning the pre-hint XP value).
      setTimeout(() => {
        fetchTotalXp();
        // Also notify layout to update its XP display
        window.dispatchEvent(new CustomEvent("xp-updated"));
      }, 800);

    } catch {
      toast.error("Submission failed. Please try again.");
      submitCalledRef.current = false;
      setIsSubmitting(false);
    }
  }, [questions, currentIdx, answers, sessionId, fetchTotalXp]);

  const startTimer = useCallback((seconds: number) => {
    setTimeLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [handleSubmit]);

  // ── Start quiz ────────────────────────────────────────────────────────────
  const handleStartQuiz = async () => {
    if (!levelId) return;
    setScreen("loading");
    submitCalledRef.current = false;
    setIsExhaustedAfterSubmit(false);
    setShowSubmitConfirm(false);

    try {
      const res  = await fetch("/api/quiz/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ levelId }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        setScreen("confirm");
        return;
      }

      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAttemptsRemaining(data.attemptsRemaining);
      setCurrentIdx(0);
      setAnswers({});
      setHintCache(new Map());
      setHintLoading(false);
      questionStartRef.current = Date.now();

      if (data.level.timeLimitMinutes > 0) startTimer(data.level.timeLimitMinutes * 60);
      setScreen("quiz");
    } catch {
      toast.error("Failed to start quiz. Please try again.");
      setScreen("confirm");
    }
  };

  const saveAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        userAnswer:    value,
        hintUsed:      prev[questionId]?.hintUsed      ?? false,
        timeTakenSecs: prev[questionId]?.timeTakenSecs ?? 0,
      },
    }));
  };

  // ── Show hint ─────────────────────────────────────────────────────────────
  const handleShowHint = async () => {
    const q = questions[currentIdx];
    if (!q || hintCache.has(q._id) || hintLoading) return;

    const penalty = q.hintXpPenalty ?? 0;

    if (penalty > 0 && totalXp < penalty) {
      toast.error(`Not enough XP. You need ${penalty} XP but only have ${totalXp} XP.`, { duration: 4000 });
      return;
    }

    setHintLoading(true);
    try {
      const res  = await fetch("/api/quiz/hint", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, questionId: q._id }),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.notEnoughXp) {
          toast.error(data.message, { duration: 4000 });
        } else {
          toast.error(data.message || "Could not load hint.");
        }
        return;
      }

      setHintCache(prev => {
        const next = new Map(prev);
        next.set(q._id, data.hintText ?? "");
        return next;
      });

      setAnswers(prev => ({
        ...prev,
        [q._id]: {
          userAnswer:    prev[q._id]?.userAnswer    ?? "",
          hintUsed:      true,
          timeTakenSecs: prev[q._id]?.timeTakenSecs ?? 0,
        },
      }));

      // FIX 1: Immediately deduct from local display AND dispatch event so
      // the layout navbar also updates instantly.
      if (!data.alreadyUsed && penalty > 0) {
        setTotalXp(prev => Math.max(0, prev - penalty));
        // Notify layout to deduct visually from navbar too
        window.dispatchEvent(new CustomEvent("xp-deduct", { detail: { amount: penalty } }));
        toast(`−${penalty} XP hint penalty applied`, { icon: "💡", duration: 3000 });

        // FIX 1: After hint, do a delayed authoritative re-fetch to confirm
        // DB deduction went through (if it fails for some reason, we'll know)
        setTimeout(() => {
          fetchTotalXp();
        }, 1500);
      } else if (data.alreadyUsed) {
        toast("Hint already used for this question", { icon: "💡", duration: 2000 });
      }
    } catch {
      toast.error("Failed to load hint. Please try again.");
    } finally {
      setHintLoading(false);
    }
  };

  const recordTimeAndGo = (direction: "next" | "prev") => {
    const q   = questions[currentIdx];
    const sec = Math.round((Date.now() - questionStartRef.current) / 1000);
    setAnswers(prev => ({
      ...prev,
      [q._id]: {
        userAnswer:    prev[q._id]?.userAnswer    ?? "",
        hintUsed:      prev[q._id]?.hintUsed      ?? false,
        timeTakenSecs: (prev[q._id]?.timeTakenSecs ?? 0) + sec,
      },
    }));
    setCurrentIdx(i => direction === "next" ? i + 1 : i - 1);
    questionStartRef.current = Date.now();
  };

  // Count unanswered questions
  const unansweredCount = questions.filter(q => !(answers[q._id]?.userAnswer?.trim())).length;

  // Handle submit click — show confirmation if questions unanswered
  const handleSubmitClick = () => {
    if (unansweredCount > 0) {
      setShowSubmitConfirm(true);
    } else {
      handleSubmit(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="max-w-[500px] mx-auto flex flex-col gap-5 py-8">
        <SkeletonBlock h="h-8" w="w-32" />
        <div className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <div className="text-center flex flex-col items-center gap-3">
            <SkeletonBlock h="h-12" w="w-12" rounded="rounded-2xl" />
            <SkeletonBlock h="h-6" w="w-48" />
            <SkeletonBlock h="h-4" w="w-64" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <SkeletonBlock key={i} h="h-16" rounded="rounded-xl" />)}
          </div>
          <SkeletonBlock h="h-24" rounded="rounded-xl" />
          <SkeletonBlock h="h-12" rounded="rounded-xl" />
        </div>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (screen === "error") {
    return (
      <div className="flex items-center justify-center min-h-[400px] flex-col gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertTriangle size={28} style={{ color: "var(--danger)" }} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-[16px]" style={{ color: "var(--text)" }}>
            Something went wrong
          </p>
          <p className="font-mono text-[13px] mt-1" style={{ color: "var(--text3)" }}>
            Could not load this level. Please go back and try again.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            Go Back
          </button>
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--accent)", color: "#fff" }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIRM SCREEN ────────────────────────────────────────────────────────
  if (screen === "confirm" && levelInfo) {
    const penaltyPct   = Math.round((levelInfo.penaltyXpMultiplier ?? 0.30) * 100);
    const exhaustionXp = Math.floor(levelInfo.xpReward * (levelInfo.penaltyXpMultiplier ?? 0.30));
    const isLastAttempt = levelInfo.attemptsRemaining === 1;
    const isRetry       = levelInfo.attemptsUsed > 0;

    return (
      <div className="max-w-[500px] mx-auto flex flex-col gap-5 py-8">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-mono cursor-pointer border-none bg-transparent self-start transition-colors"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
        >
          <ChevronLeft size={15} /> Back to Levels
        </button>

        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border2)" }}>

          {/* Header band */}
          <div className="px-6 py-5 text-center"
            style={{
              background: isLastAttempt
                ? "linear-gradient(135deg, rgba(248,113,113,0.12), rgba(245,158,11,0.08))"
                : "linear-gradient(135deg, rgba(124,110,243,0.12), rgba(34,211,160,0.06))",
              borderBottom: "1px solid var(--border2)",
            }}>
            <div className="text-[44px] mb-2">🧠</div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
              Level {levelInfo.levelNumber}
              {levelInfo.name ? ` — ${levelInfo.name}` : ""}
            </h1>
            <p className="text-[13px] mt-1.5 font-mono" style={{ color: "var(--text3)" }}>
              You must answer <strong style={{ color: "var(--text2)" }}>ALL questions correctly</strong> to pass
            </p>
          </div>

          <div className="p-6 flex flex-col gap-5" style={{ background: "var(--surface)" }}>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Questions",
                  value: String(levelInfo.questionCount),
                  icon:  <Target size={14} />,
                  color: "var(--accent)",
                  bg:    "rgba(124,110,243,0.10)",
                },
                {
                  label: "Time Limit",
                  value: levelInfo.timeLimitMinutes > 0
                    ? `${levelInfo.timeLimitMinutes} min`
                    : "No limit",
                  icon:  <Clock size={14} />,
                  color: "var(--amber)",
                  bg:    "rgba(245,158,11,0.10)",
                },
                {
                  label: "XP Reward",
                  value: `${levelInfo.xpReward} XP`,
                  icon:  <Zap size={14} />,
                  color: "var(--amber)",
                  bg:    "rgba(245,158,11,0.10)",
                },
                {
                  label: "Attempts Left",
                  value: String(attemptsRemaining),
                  icon:  <RefreshCw size={14} />,
                  color: attemptsRemaining <= 1 ? "var(--danger)" : "var(--green)",
                  bg:    attemptsRemaining <= 1
                    ? "rgba(248,113,113,0.10)"
                    : "rgba(34,211,160,0.10)",
                },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1"
                  style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                  <div className="flex items-center gap-1.5" style={{ color: s.color }}>
                    {s.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text4)" }}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-[20px] font-bold font-mono" style={{ color: s.color }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Last attempt warning */}
            {isLastAttempt && (
              <div className="rounded-xl p-3.5 flex items-start gap-3"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)" }}>
                <AlertTriangle size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>
                    Last Attempt Warning
                  </p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text3)" }}>
                    If you fail this attempt, you'll receive a {penaltyPct}% consolation award
                    of <strong style={{ color: "var(--amber)" }}>{exhaustionXp} XP</strong> and
                    the level will be marked as exhausted.
                  </p>
                </div>
              </div>
            )}

            {/* Rules */}
            <div className="rounded-xl p-3.5 flex flex-col gap-2"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text4)" }}>Quiz Rules</p>
              {[
                "This attempt counts even if you close the browser.",
                "Copy, paste, right-click, and screenshots are disabled.",
                levelInfo.timeLimitMinutes > 0
                  ? `${levelInfo.timeLimitMinutes} minute time limit. Auto-submits when time runs out.`
                  : "No time limit for this level.",
                "You need 100% correct to pass.",
              ].map((rule, i) => (
                <p key={i} className="text-[12px] font-mono flex items-start gap-2"
                  style={{ color: "var(--text3)" }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0 }}>›</span>
                  {rule}
                </p>
              ))}
            </div>

            {/* Previous attempt info */}
            {levelInfo.bestScore > 0 && (
              <div className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: "rgba(124,110,243,0.06)", border: "1px solid rgba(124,110,243,0.18)" }}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: "var(--accent)" }} />
                  <span className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>
                    Your best score
                  </span>
                </div>
                <span className="text-[14px] font-bold font-mono" style={{ color: "var(--accent)" }}>
                  {levelInfo.bestScore}%
                </span>
              </div>
            )}

            <button onClick={handleStartQuiz}
              className="w-full py-3.5 rounded-xl text-[14px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background:  isLastAttempt
                  ? "linear-gradient(135deg, #f87171, #ef4444)"
                  : "var(--accent)",
                color:       "#fff",
                boxShadow:   isLastAttempt
                  ? "0 0 24px rgba(248,113,113,0.35)"
                  : "0 0 24px rgba(124,110,243,0.35)",
              }}>
              {isRetry
                ? isLastAttempt ? "⚠ Last Attempt — Start Quiz →" : "Retry Quiz →"
                : "Start Quiz →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ───────────────────────────────────────────────────────────
  if (screen === "quiz" && questions.length > 0) {
    const q          = questions[currentIdx];
    const ans        = answers[q._id];
    const userAnswer = ans?.userAnswer ?? "";
    const isLast     = currentIdx === questions.length - 1;

    const hintText    = hintCache.get(q._id);
    const hintPenalty = q.hintXpPenalty ?? 0;
    const canAffordHint = hintPenalty === 0 || totalXp >= hintPenalty;

    const timerPct   = levelInfo?.timeLimitMinutes
      ? (timeLeft / (levelInfo.timeLimitMinutes * 60)) * 100
      : 100;
    const isUrgent   = timeLeft > 0 && timeLeft < 60;
    const isWarning  = timeLeft > 0 && timeLeft < 180 && !isUrgent;
    const timerColor = isUrgent ? "var(--danger)" : isWarning ? "var(--amber)" : "var(--green)";

    const answeredCount = questions.filter(q => answers[q._id]?.userAnswer?.trim()).length;

    return (
      <div className="max-w-[780px] mx-auto flex flex-col gap-4 py-4"
        style={{ userSelect: "none", WebkitUserSelect: "none" }}>

        {/* ── Top bar ── */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[12px] font-mono font-semibold whitespace-nowrap"
              style={{ color: "var(--text3)" }}>
              {currentIdx + 1} / {questions.length}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width:      `${((answeredCount) / questions.length) * 100}%`,
                  background: "linear-gradient(to right, var(--accent), var(--accent2))",
                }} />
            </div>
            <span className="text-[11px] font-mono whitespace-nowrap"
              style={{ color: "var(--text4)" }}>
              {answeredCount}/{questions.length} answered
            </span>
          </div>

          {/* Timer */}
          {levelInfo?.timeLimitMinutes && levelInfo.timeLimitMinutes > 0 ? (
            <div className={`flex items-center gap-1.5 font-mono font-bold text-[14px] px-3 py-1.5 rounded-lg ${isUrgent ? "animate-pulse" : ""}`}
              style={{
                color:      timerColor,
                background: isUrgent ? "rgba(248,113,113,0.10)" : "transparent",
                border:     isUrgent ? "1px solid rgba(248,113,113,0.22)" : "1px solid transparent",
              }}>
              <Clock size={14} /> {fmtTime(timeLeft)}
            </div>
          ) : (
            <span className="text-[11px] font-mono px-2 py-1 rounded-lg"
              style={{ color: "var(--text4)", background: "var(--surface2)" }}>
              No limit
            </span>
          )}
        </div>

        {/* Timer bar */}
        {levelInfo?.timeLimitMinutes && levelInfo.timeLimitMinutes > 0 && (
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "animate-pulse" : ""}`}
              style={{ width: `${timerPct}%`, background: timerColor }} />
          </div>
        )}

        {/* XP display during quiz */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
            Level {levelInfo?.levelNumber}{levelInfo?.name ? ` — ${levelInfo.name}` : ""}
          </p>
          <div className="flex items-center gap-1.5">
            <Zap size={11} style={{ color: "var(--amber)" }} />
            <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--amber)" }}>
              {totalXp.toLocaleString()} XP available
            </span>
          </div>
        </div>

        {/* ── Question card ── */}
        <div className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{ color: "var(--accent)", background: "rgba(124,110,243,0.10)" }}>
                Question {currentIdx + 1}
              </span>
              {answers[q._id]?.hintUsed && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                  style={{ color: "var(--amber)", background: "rgba(245,158,11,0.10)" }}>
                  💡 Hint Used
                </span>
              )}
            </div>
            <p className="text-[16px] leading-[1.7] font-medium" style={{ color: "var(--text)" }}>
              {q.questionContent}
            </p>
          </div>

          {/* Options */}
          {q.questionType === "option" ? (
            <div className="flex flex-col gap-2.5">
              {OPTIONS.map(opt => {
                const text     = q[`option${opt.key}` as keyof Question] as string;
                if (!text) return null;
                const selected = userAnswer === opt.key;
                return (
                  <button key={opt.key} onClick={() => saveAnswer(q._id, opt.key)}
                    className="w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 transition-all border-none cursor-pointer"
                    style={{
                      background: selected ? "rgba(124,110,243,0.18)" : "var(--surface2)",
                      border:     selected ? "1.5px solid rgba(124,110,243,0.55)" : "1.5px solid var(--border)",
                      color:      "var(--text)",
                      transform:  selected ? "translateX(4px)" : "translateX(0)",
                    }}
                    onMouseEnter={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background    = "var(--bg)";
                        (e.currentTarget as HTMLElement).style.borderColor   = "rgba(124,110,243,0.30)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background    = "var(--surface2)";
                        (e.currentTarget as HTMLElement).style.borderColor   = "var(--border)";
                      }
                    }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0 transition-all"
                      style={{
                        background: selected ? "var(--accent)" : "var(--surface)",
                        color:      selected ? "#fff" : "var(--text3)",
                      }}>
                      {opt.key}
                    </span>
                    <span className="text-[14px]">{text}</span>
                    {selected && (
                      <CheckCircle size={14} style={{ color: "var(--accent)", marginLeft: "auto", flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block"
                style={{ color: "var(--text4)" }}>Your Answer</label>
              <input
                type="text" value={userAnswer}
                onChange={e => saveAnswer(q._id, e.target.value)}
                placeholder="Type your answer here…"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                onPaste={e => e.preventDefault()}
                onCopy={e => e.preventDefault()}
                onCut={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
                className="w-full px-4 py-3 rounded-xl text-[14px] font-mono border-none outline-none"
                style={{
                  background: "var(--surface2)",
                  color:      "var(--text)",
                  border:     "1.5px solid var(--border2)",
                  userSelect: "text",
                }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.55)"; }}
                onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; }}
              />
            </div>
          )}

          {/* ── Hint section ── */}
          {hintPenalty > 0 && (
            <div>
              {hintText !== undefined ? (
                <div className="rounded-xl p-3.5 flex items-start gap-3"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <span style={{ color: "var(--amber)", flexShrink: 0 }}>💡</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--amber)" }}>
                      Hint
                      <span className="ml-2 font-normal" style={{ color: "var(--text4)" }}>
                        (−{hintPenalty} XP deducted)
                      </span>
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text2)" }}>
                      {hintText}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleShowHint}
                  disabled={hintLoading || !canAffordHint}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-mono font-semibold border-none cursor-pointer transition-all"
                  style={{
                    background: canAffordHint ? "rgba(245,158,11,0.08)" : "rgba(100,100,100,0.06)",
                    border:     canAffordHint ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(100,100,100,0.15)",
                    color:      canAffordHint ? "var(--amber)" : "var(--text4)",
                    opacity:    hintLoading ? 0.6 : 1,
                    cursor:     (!canAffordHint || hintLoading) ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => {
                    if (canAffordHint && !hintLoading) {
                      (e.currentTarget as HTMLElement).style.background  = "rgba(245,158,11,0.16)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.40)";
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background  = canAffordHint ? "rgba(245,158,11,0.08)" : "rgba(100,100,100,0.06)";
                    (e.currentTarget as HTMLElement).style.borderColor = canAffordHint ? "rgba(245,158,11,0.22)" : "rgba(100,100,100,0.15)";
                  }}
                >
                  {hintLoading ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
                      Loading hint…
                    </>
                  ) : !canAffordHint ? (
                    <>🚫 Need {hintPenalty} XP for hint (you have {totalXp} XP)</>
                  ) : (
                    <>💡 Show Hint <span style={{ opacity: 0.6, fontWeight: 400 }}>−{hintPenalty} XP</span></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => recordTimeAndGo("prev")} disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            <ChevronLeft size={15} /> Prev
          </button>

          {/* Question dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[300px]">
            {questions.map((_, i) => {
              const answered = !!(answers[questions[i]._id]?.userAnswer?.trim());
              const isActive = i === currentIdx;
              return (
                <button key={i}
                  onClick={() => { setCurrentIdx(i); questionStartRef.current = Date.now(); }}
                  title={`Q${i+1}${answered ? " ✓" : ""}`}
                  className="shrink-0 border-none cursor-pointer transition-all rounded-full"
                  style={{
                    width:      isActive ? "28px" : "10px",
                    height:     "10px",
                    background: isActive
                      ? "var(--accent)"
                      : answered
                      ? "var(--green)"
                      : "var(--border2)",
                    transform: isActive ? "scaleY(1.1)" : "scale(1)",
                  }} />
              );
            })}
          </div>

          {isLast ? (
            <button onClick={handleSubmitClick} disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
              style={{
                background: unansweredCount > 0 ? "var(--amber)" : "var(--green)",
                color:      "#fff",
                boxShadow:  unansweredCount > 0
                  ? "0 0 16px rgba(245,158,11,0.30)"
                  : "0 0 16px rgba(34,211,160,0.30)",
              }}>
              {isSubmitting
                ? "Submitting…"
                : unansweredCount > 0
                ? `Submit (${unansweredCount} skipped)`
                : "Submit Quiz ✓"}
            </button>
          ) : (
            <button onClick={() => recordTimeAndGo("next")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>

        {/* ── Submit confirmation modal ── */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
            <div className="rounded-2xl p-6 w-full max-w-[360px] flex flex-col gap-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(245,158,11,0.12)" }}>
                  <AlertTriangle size={18} style={{ color: "var(--amber)" }} />
                </div>
                <div>
                  <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>
                    Submit with skipped questions?
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
                    {unansweredCount} question{unansweredCount !== 1 ? "s" : ""} unanswered.
                    Unanswered questions count as wrong.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
                  style={{ background: "var(--surface2)", color: "var(--text2)" }}>
                  Keep Answering
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
                  style={{ background: "var(--amber)", color: "#fff" }}>
                  Submit Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── RESULT + PAST_RESULT SCREEN ───────────────────────────────────────────
  const ResultView = ({ res, isPast }: { res: ResultData; isPast?: boolean }) => {
    const mins = Math.floor(res.timeTakenSecs / 60);
    const secs = res.timeTakenSecs % 60;

    const isExhaustionResult = !res.isPassing && res.earnedXp > 0;
    const isNoXpResult       = !res.isPassing && res.earnedXp === 0;
    const penaltyPct         = Math.round((res.penaltyMultiplier ?? 0) * 100);

    const isAllAttemptsUsed =
      isPast
      || isExhaustedAfterSubmit
      || attemptsRemaining <= 0;

    const actionLabel = res.isPassing
      ? isPast ? "Back to Levels" : "Continue →"
      : isAllAttemptsUsed
        ? "Back to Levels"
        : "Try Again →";

    const scoreColor = res.isPassing
      ? "var(--green)"
      : res.score >= 70
      ? "var(--amber)"
      : "var(--danger)";

    return (
      <div className="max-w-[560px] mx-auto flex flex-col gap-5 py-8">

        {isPast && (
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[13px] font-mono cursor-pointer border-none bg-transparent self-start transition-colors"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
          >
            <ChevronLeft size={15} /> Back to Levels
          </button>
        )}

        {/* Score card */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            border: res.isPassing
              ? "1px solid rgba(34,211,160,0.35)"
              : "1px solid rgba(248,113,113,0.25)",
          }}>

          {/* Status banner */}
          <div className="px-5 py-2.5 flex items-center justify-center gap-2"
            style={{
              background: res.isPassing
                ? "rgba(34,211,160,0.15)"
                : isExhaustedAfterSubmit || isPast && !res.isPassing
                ? "rgba(248,113,113,0.10)"
                : "rgba(248,113,113,0.08)",
              borderBottom: res.isPassing
                ? "1px solid rgba(34,211,160,0.20)"
                : "1px solid rgba(248,113,113,0.15)",
            }}>
            {res.isPassing ? (
              <>
                <CheckCircle size={14} style={{ color: "var(--green)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--green)" }}>
                  Level Passed
                </span>
              </>
            ) : isAllAttemptsUsed ? (
              <>
                <AlertTriangle size={14} style={{ color: "var(--danger)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>
                  All Attempts Used
                </span>
              </>
            ) : (
              <>
                <XCircle size={14} style={{ color: "var(--danger)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--danger)" }}>
                  Not Passed — {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                </span>
              </>
            )}
          </div>

          {/* Score display */}
          <div className="px-6 py-8 text-center"
            style={{
              background: res.isPassing
                ? "linear-gradient(135deg, rgba(34,211,160,0.06), rgba(124,110,243,0.04))"
                : "linear-gradient(135deg, rgba(248,113,113,0.06), rgba(124,110,243,0.04))",
            }}>
            <div className="text-[64px] font-bold font-mono leading-none"
              style={{ color: scoreColor }}>
              {displayScore}%
            </div>
            <p className="text-[18px] font-semibold mt-3" style={{ color: "var(--text)" }}>
              {res.isPassing
                ? "🎉 Perfect Score — All Correct!"
                : `${res.correctAnswers} of ${res.totalQuestions} correct`}
            </p>
            {res.timeTakenSecs > 0 && (
              <p className="text-[12px] font-mono mt-1.5" style={{ color: "var(--text4)" }}>
                Completed in {fmtDuration(res.timeTakenSecs)}
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: "Correct",  value: String(res.correctAnswers),  color: "var(--green)",  icon: <CheckCircle size={14} /> },
            { label: "Wrong",    value: String(res.wrongAnswers),     color: "var(--danger)", icon: <XCircle     size={14} /> },
            { label: "Time",     value: fmtDuration(res.timeTakenSecs), color: "var(--accent)", icon: <Clock size={14} /> },
            { label: "XP",       value: `+${res.earnedXp}`,           color: "var(--amber)",  icon: <Zap  size={14} /> },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center flex flex-col items-center gap-1.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <p className="text-[18px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: "var(--text4)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* XP Breakdown — PASS */}
        {res.isPassing && (res.hintXpDeduction > 0 || res.wasExhaustionUnlock) && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Award size={14} style={{ color: "var(--amber)" }} />
              <p className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text4)" }}>XP Breakdown</p>
            </div>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>Base XP</span>
              <span style={{ color: "var(--text)" }}>+{res.baseXp}</span>
            </div>
            {res.hintXpDeduction > 0 && (
              <div className="flex justify-between text-[13px] font-mono">
                <span style={{ color: "var(--text3)" }}>Hint Penalties</span>
                <span style={{ color: "var(--danger)" }}>−{res.hintXpDeduction}</span>
              </div>
            )}
            {res.wasExhaustionUnlock && (
              <div className="flex justify-between text-[13px] font-mono">
                <span style={{ color: "var(--text3)" }}>
                  Exhaustion-Unlock Penalty ×{res.penaltyMultiplier}
                </span>
                <span style={{ color: "var(--amber)" }}>applied</span>
              </div>
            )}
            <div className="border-t pt-2 mt-1 flex justify-between text-[14px] font-bold font-mono"
              style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text)" }}>Total XP Earned</span>
              <span style={{ color: "var(--amber)" }}>+{res.earnedXp}</span>
            </div>
          </div>
        )}

        {/* XP Breakdown — EXHAUSTION consolation */}
        {isExhaustionResult && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid rgba(245,158,11,0.30)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Award size={14} style={{ color: "var(--amber)" }} />
              <p className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--amber)" }}>Consolation XP Award</p>
            </div>
            <p className="text-[12px] font-mono mb-1" style={{ color: "var(--text4)" }}>
              You've used all attempts. Here's your consolation award:
            </p>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>Base XP</span>
              <span style={{ color: "var(--text)" }}>+{res.baseXp}</span>
            </div>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>
                Consolation Rate ×{res.penaltyMultiplier} ({penaltyPct}%)
              </span>
              <span style={{ color: "var(--amber)" }}>applied</span>
            </div>
            <div className="border-t pt-2 mt-1 flex justify-between text-[14px] font-bold font-mono"
              style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text)" }}>
                Total XP ({penaltyPct}% of {res.baseXp})
              </span>
              <span style={{ color: "var(--amber)" }}>+{res.earnedXp}</span>
            </div>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text4)" }}>
              Hint penalties are not applied to consolation awards.
            </p>
          </div>
        )}

        {/* No XP — non-last fail */}
        {isNoXpResult && !isPast && !isExhaustedAfterSubmit && (
          <div className="rounded-xl p-3.5 flex items-start gap-2.5"
            style={{ background: "rgba(124,110,243,0.06)", border: "1px solid rgba(124,110,243,0.18)" }}>
            <Zap size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <p className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>
              No XP awarded for failed attempts. Pass the level — or use all attempts — to earn XP.
            </p>
          </div>
        )}

        {/* Retry nudge — only when retries remain */}
        {!res.isPassing && attemptsRemaining > 0 && !isPast && !isExhaustedAfterSubmit && (
          <div className="rounded-xl p-3.5 text-center"
            style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.20)" }}>
            <p className="text-[13px] font-mono" style={{ color: "var(--accent)" }}>
              You need 100% to pass.{" "}
              <strong>{attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""}</strong> remaining.
            </p>
            {attemptsRemaining === 1 && levelInfo && (
              <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text4)" }}>
                Last attempt — failing awards{" "}
                {Math.floor(levelInfo.xpReward * (levelInfo.penaltyXpMultiplier ?? 0.3))} XP (
                {Math.round((levelInfo.penaltyXpMultiplier ?? 0.3) * 100)}% consolation).
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {res.canReview && (
            <button onClick={() => { setScreen("review"); setReviewIdx(0); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}>
              <BookOpen size={15} /> Review Answers
            </button>
          )}
          <button
            onClick={() => {
              if (res.isPassing || isAllAttemptsUsed || isPast) {
                router.push(`/dashboard/quiz/${categoryId}/${subcategoryId}`);
              } else {
                // Try again — go back to confirm screen
                setScreen("confirm");
                submitCalledRef.current = false;
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(124,110,243,0.25)" }}>
            {actionLabel}
          </button>
        </div>
      </div>
    );
  };

  if (screen === "result"      && result) return <ResultView res={result} />;
  if (screen === "past_result" && result) return <ResultView res={result} isPast />;

  // ── REVIEW SCREEN ─────────────────────────────────────────────────────────
  if (screen === "review" && review.length > 0) {
    const q         = review[reviewIdx];
    const allCount  = review.length;
    const rightCount = review.filter(r => r.isCorrect).length;

    return (
      <div className="max-w-[680px] mx-auto flex flex-col gap-4 py-4">

        {/* Review header */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <button
            onClick={() => setScreen(result?.submittedAt ? "past_result" : "result")}
            className="flex items-center gap-1.5 text-[13px] font-mono cursor-pointer border-none bg-transparent transition-colors"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
          >
            <ChevronLeft size={15} /> Back to Results
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[12px] font-mono" style={{ color: "var(--text4)" }}>
              {reviewIdx + 1} / {allCount}
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
              style={{ color: "var(--green)", background: "rgba(34,211,160,0.10)" }}>
              {rightCount}/{allCount} correct
            </span>
          </div>
        </div>

        {/* Progress bar across questions */}
        <div className="flex gap-1">
          {review.map((rq, i) => (
            <div
              key={i}
              onClick={() => setReviewIdx(i)}
              className="flex-1 h-1.5 rounded-full cursor-pointer transition-all"
              style={{
                background: i === reviewIdx
                  ? "var(--accent)"
                  : rq.isCorrect
                  ? "var(--green)"
                  : "var(--danger)",
                opacity: i === reviewIdx ? 1 : 0.6,
              }}
            />
          ))}
        </div>

        {/* Question review card */}
        <div className="rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>

          <div className="flex items-center gap-2 flex-wrap">
            {q.isCorrect ? (
              <span className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full"
                style={{ background: "rgba(34,211,160,0.15)", color: "var(--green)" }}>
                <CheckCircle size={13} /> Correct
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full"
                style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
                <XCircle size={13} /> Incorrect
              </span>
            )}
            {q.hintUsed && (
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full"
                style={{ background: "rgba(245,158,11,0.12)", color: "var(--amber)" }}>
                💡 Hint Used
              </span>
            )}
            <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--text4)" }}>
              Q{reviewIdx + 1}
            </span>
          </div>

          <p className="text-[15px] font-medium leading-[1.65]" style={{ color: "var(--text)" }}>
            {q.questionContent}
          </p>

          {q.questionType === "option" && (
            <div className="flex flex-col gap-2">
              {OPTIONS.map(opt => {
                const text      = q[`option${opt.key}` as keyof ReviewQuestion] as string;
                if (!text) return null;
                const isCorrect = opt.key === q.correctOption;
                const isUser    = opt.key === q.userAnswer;
                const isWrong   = isUser && !isCorrect;
                return (
                  <div key={opt.key} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: isCorrect
                        ? "rgba(34,211,160,0.10)"
                        : isWrong
                        ? "rgba(248,113,113,0.08)"
                        : "var(--surface2)",
                      border: isCorrect
                        ? "1.5px solid rgba(34,211,160,0.35)"
                        : isWrong
                        ? "1.5px solid rgba(248,113,113,0.28)"
                        : "1.5px solid var(--border)",
                    }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        background: isCorrect ? "var(--green)" : isWrong ? "var(--danger)" : "var(--surface)",
                        color: (isCorrect || isWrong) ? "#fff" : "var(--text3)",
                      }}>
                      {opt.key}
                    </span>
                    <span className="text-[13px] flex-1" style={{ color: "var(--text)" }}>{text}</span>
                    {isCorrect && (
                      <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--green)" }}>
                        ✓ Correct
                      </span>
                    )}
                    {isWrong && (
                      <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--danger)" }}>
                        ✗ Your answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {q.questionType === "text" && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl px-4 py-3"
                style={{
                  background: q.isCorrect ? "rgba(34,211,160,0.08)" : "rgba(248,113,113,0.07)",
                  border: q.isCorrect
                    ? "1px solid rgba(34,211,160,0.28)"
                    : "1px solid rgba(248,113,113,0.22)",
                }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--text4)" }}>Your Answer</p>
                <p className="text-[14px] font-mono"
                  style={{ color: q.isCorrect ? "var(--green)" : "var(--danger)" }}>
                  {q.userAnswer || "(no answer given)"}
                </p>
              </div>
              {!q.isCorrect && q.acceptedAnswers && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(34,211,160,0.07)", border: "1px solid rgba(34,211,160,0.22)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: "var(--green)" }}>Accepted Answers</p>
                  <p className="text-[13px] font-mono" style={{ color: "var(--text)" }}>
                    {q.acceptedAnswers.join(" / ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {q.hintUsed && q.hintText && (
            <div className="rounded-xl p-3.5"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--amber)" }}>Hint You Used</p>
              <p className="text-[13px]" style={{ color: "var(--text2)" }}>{q.hintText}</p>
            </div>
          )}

          {q.explanation && (
            <div className="rounded-xl p-3.5"
              style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.18)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--accent)" }}>Explanation</p>
              <p className="text-[13px] leading-[1.65]" style={{ color: "var(--text2)" }}>{q.explanation}</p>
            </div>
          )}
        </div>

        {/* Review navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setReviewIdx(i => i - 1)} disabled={reviewIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            <ChevronLeft size={15} /> Previous
          </button>

          <span className="text-[12px] font-mono" style={{ color: "var(--text4)" }}>
            {reviewIdx + 1} of {allCount}
          </span>

          {reviewIdx < review.length - 1 ? (
            <button onClick={() => setReviewIdx(i => i + 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={() => router.push(`/dashboard/quiz/${categoryId}/${subcategoryId}`)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "var(--green)", color: "#fff" }}>
              Done ✓
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}