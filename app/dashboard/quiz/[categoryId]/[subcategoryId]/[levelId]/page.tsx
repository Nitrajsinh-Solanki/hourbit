// app/dashboard/quiz/[categoryId]/[subcategoryId]/[levelId]/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams }                      from "next/navigation";
import {
  Clock, ChevronRight, ChevronLeft,
  AlertTriangle, CheckCircle, XCircle,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = "option" | "text";

// hintXpPenalty is included — it's not sensitive (just a cost number).
// hintText is NOT included — it would let users read hints for free before paying.
type Question = {
  _id:             string;
  questionType:    QuestionType;
  questionContent: string;
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  hintXpPenalty:   number;   // cost shown on button BEFORE clicking
  displayOrder:    number;
};

// Populated lazily: only hintText comes from the server on first "Show Hint" click
type HintData = {
  hintText:      string;
  hintXpPenalty: number;
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

  // hintCache: only stores hintText per questionId.
  // hintXpPenalty is already on each Question object from the session payload.
  const [hintCache,   setHintCache]   = useState<Map<string, string>>(new Map());
  const [hintLoading, setHintLoading] = useState(false);

  // totalXp fetched from DB — used for XP sufficiency check on hint button
  const [totalXp, setTotalXp] = useState<number>(0);
  const xpLoadedRef = useRef(false);

  const [timeLeft,     setTimeLeft]     = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result,       setResult]       = useState<ResultData | null>(null);
  const [review,       setReview]       = useState<ReviewQuestion[]>([]);
  const [reviewIdx,    setReviewIdx]    = useState(0);

  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef<number>(Date.now());
  const submitCalledRef  = useRef(false);

  // ── Fetch current XP from DB once on mount ────────────────────────────────
  // Used to show balance on hint button and block hint if insufficient.
  // Re-fetched after xp-updated (post submit).
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
    const handleUpdated = () => fetchTotalXp();
    window.addEventListener("xp-updated", handleUpdated);
    return () => window.removeEventListener("xp-updated", handleUpdated);
  }, [fetchTotalXp]);

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
          toast.error("This level is locked.");
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

      setResult(data.result);
      setReview(data.review);
      if (data.progress) setAttemptsRemaining(data.progress.attemptsRemaining ?? 0);
      setScreen("result");
      window.dispatchEvent(new CustomEvent("xp-updated"));
    } catch {
      toast.error("Submission failed. Please try again.");
      submitCalledRef.current = false;
      setIsSubmitting(false);
    }
  }, [questions, currentIdx, answers, sessionId]);

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
      setQuestions(data.questions);           // hintXpPenalty is in each question
      setAttemptsRemaining(data.attemptsRemaining);
      setCurrentIdx(0);
      setAnswers({});
      setHintCache(new Map());
      setHintLoading(false);
      questionStartRef.current = Date.now();

      if (data.level.timeLimitMinutes > 0) startTimer(data.level.timeLimitMinutes * 60);
      setScreen("quiz");
    } catch {
      toast.error("Failed to start quiz.");
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
  // hintXpPenalty is already known from the question object (sent by session route).
  // We only call the hint API to get hintText — the server records the usage and
  // deducts XP from DB at the same time.
  const handleShowHint = async () => {
    const q = questions[currentIdx];
    if (!q || hintCache.has(q._id) || hintLoading) return;

    const penalty = q.hintXpPenalty ?? 0;

    // Block if user doesn't have enough XP
    if (penalty > 0 && totalXp < penalty) {
      toast.error(`Not enough XP. You need ${penalty} XP but have ${totalXp} XP.`, { duration: 4000 });
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

      // Cache only hintText — hintXpPenalty is already on the question object
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

      // Instant visual deduction — DB already updated by hint route
      if (!data.alreadyUsed && penalty > 0) {
        setTotalXp(prev => Math.max(0, prev - penalty));
        window.dispatchEvent(new CustomEvent("xp-deduct", { detail: { amount: penalty } }));
        toast(`−${penalty} XP hint penalty`, { icon: "💡" });
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

  const fmtTime = (secs: number) =>
    `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="flex items-center justify-center min-h-[400px] flex-col gap-4">
        <AlertTriangle size={40} style={{ color: "var(--danger)" }} />
        <p className="font-mono text-[14px]" style={{ color: "var(--text3)" }}>
          Something went wrong. Please go back and try again.
        </p>
        <button onClick={() => router.back()}
          className="px-6 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
          style={{ background: "var(--accent)", color: "#fff" }}>
          Go Back
        </button>
      </div>
    );
  }

  // ── CONFIRM SCREEN ────────────────────────────────────────────────────────
  if (screen === "confirm" && levelInfo) {
    const penaltyPct   = Math.round((levelInfo.penaltyXpMultiplier ?? 0.30) * 100);
    const exhaustionXp = Math.floor(levelInfo.xpReward * (levelInfo.penaltyXpMultiplier ?? 0.30));

    return (
      <div className="max-w-[500px] mx-auto flex flex-col gap-5 py-8">
        <button onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-mono cursor-pointer border-none bg-transparent self-start transition-colors"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
        >
          <ChevronLeft size={15} /> Back
        </button>

        <div className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>

          <div className="text-center">
            <div className="text-[42px] mb-3">🧠</div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
              Level {levelInfo.levelNumber}{levelInfo.name ? ` — ${levelInfo.name}` : ""}
            </h1>
            <p className="text-[13px] mt-1 font-mono" style={{ color: "var(--text3)" }}>
              You must answer ALL questions correctly to pass.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Questions",     value: String(levelInfo.questionCount),
                color: "var(--accent)" },
              { label: "Time Limit",    value: levelInfo.timeLimitMinutes > 0
                ? `${levelInfo.timeLimitMinutes} min` : "No limit",
                color: "var(--amber)" },
              { label: "XP Reward",     value: `${levelInfo.xpReward} XP`,
                color: "var(--amber)" },
              { label: "Attempts Left", value: String(attemptsRemaining),
                color: attemptsRemaining <= 1 ? "var(--danger)" : "var(--green)" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-[20px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider mt-1"
                  style={{ color: "var(--text4)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-3 flex flex-col gap-1.5"
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
              style={{ color: "var(--danger)" }}>⚠ Quiz Rules</p>
            {[
              "Once started, this attempt is counted even if you close the browser.",
              "Copy, paste, right-click, and screenshots are disabled.",
              "All keyboard shortcuts (Ctrl+C, F12, etc.) are blocked.",
              levelInfo.timeLimitMinutes > 0
                ? `You have ${levelInfo.timeLimitMinutes} minutes. The quiz auto-submits when time runs out.`
                : "There is no time limit for this level.",
              "You must get ALL questions correct to pass.",
              attemptsRemaining === 1
                ? `⚠ Last attempt — failing awards ${penaltyPct}% XP (${exhaustionXp} XP) as consolation.`
                : "",
            ].filter(Boolean).map((rule, i) => (
              <p key={i} className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>• {rule}</p>
            ))}
          </div>

          <button onClick={handleStartQuiz}
            className="w-full py-3.5 rounded-xl text-[14px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 24px rgba(124,110,243,0.35)" }}>
            {levelInfo.attemptsUsed > 0 ? "Retry Quiz →" : "Start Quiz →"}
          </button>
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

    // hintText is in cache after first click; hintXpPenalty is always on the question
    const hintText    = hintCache.get(q._id);        // undefined = not yet revealed
    const hintPenalty = q.hintXpPenalty ?? 0;
    const canAffordHint = hintPenalty === 0 || totalXp >= hintPenalty;

    const timerPct   = levelInfo?.timeLimitMinutes
      ? (timeLeft / (levelInfo.timeLimitMinutes * 60)) * 100 : 100;
    const timerColor = timeLeft < 60 ? "var(--danger)" : timeLeft < 180 ? "var(--amber)" : "var(--green)";

    return (
      <div className="max-w-[780px] mx-auto flex flex-col gap-4 py-4"
        style={{ userSelect: "none", WebkitUserSelect: "none" }}>

        {/* Top bar */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[12px] font-mono font-semibold"
              style={{ color: "var(--text3)", whiteSpace: "nowrap" }}>
              {currentIdx + 1} / {questions.length}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width:      `${((currentIdx + 1) / questions.length) * 100}%`,
                  background: "linear-gradient(to right, var(--accent), var(--accent2))",
                }} />
            </div>
          </div>
          {levelInfo?.timeLimitMinutes && levelInfo.timeLimitMinutes > 0 ? (
            <div className="flex items-center gap-1.5 font-mono font-bold text-[14px]"
              style={{ color: timerColor }}>
              <Clock size={14} /> {fmtTime(timeLeft)}
            </div>
          ) : (
            <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>No limit</span>
          )}
        </div>

        {/* Timer bar */}
        {levelInfo?.timeLimitMinutes && levelInfo.timeLimitMinutes > 0 && (
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, background: timerColor }} />
          </div>
        )}

        {/* Question card */}
        <div className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "var(--text4)" }}>Question {currentIdx + 1}</p>
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
                    }}
                    onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.30)"; } }}
                    onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; } }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{ background: selected ? "var(--accent)" : "var(--surface)", color: selected ? "#fff" : "var(--text3)" }}>
                      {opt.key}
                    </span>
                    <span className="text-[14px]">{text}</span>
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
                onPaste={e => e.preventDefault()} onCopy={e => e.preventDefault()}
                onCut={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
                className="w-full px-4 py-3 rounded-xl text-[14px] font-mono border-none outline-none"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1.5px solid var(--border2)", userSelect: "text" }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.55)"; }}
                onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; }}
              />
            </div>
          )}

          {/* ── HINT SECTION ────────────────────────────────────────────────
              BEFORE CLICK:
                Button shows exact XP cost: "💡 Show Hint  −10 XP"
                Greyed + blocked if user can't afford it.
              AFTER CLICK:
                Reveals hintText from server response.
                Shows cost in header: "Hint (−10 XP deducted)".
              hintXpPenalty comes from question object (session payload).
              hintText comes from server on first click (hint route).
              No question has a hint if hintXpPenalty === 0 AND hintText is "".
          ─────────────────────────────────────────────────────────────────── */}
          {hintPenalty > 0 && (
            <div>
              {hintText !== undefined ? (
                /* Hint revealed */
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <span style={{ color: "var(--amber)", flexShrink: 0 }}>💡</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--amber)" }}>
                      Hint{" "}
                      <span style={{ color: "var(--text4)", fontWeight: 400 }}>
                        (−{hintPenalty} XP deducted)
                      </span>
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--text2)" }}>{hintText}</p>
                  </div>
                </div>
              ) : (
                /* Show hint button with exact cost */
                <button
                  onClick={handleShowHint}
                  disabled={hintLoading || !canAffordHint}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-mono font-semibold border-none cursor-pointer transition-all"
                  style={{
                    background: canAffordHint ? "rgba(245,158,11,0.08)" : "rgba(100,100,100,0.08)",
                    border:     canAffordHint ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(100,100,100,0.20)",
                    color:      canAffordHint ? "var(--amber)" : "var(--text4)",
                    opacity:    hintLoading ? 0.6 : 1,
                    cursor:     (!canAffordHint || hintLoading) ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => {
                    if (canAffordHint && !hintLoading) {
                      (e.currentTarget as HTMLElement).style.background   = "rgba(245,158,11,0.16)";
                      (e.currentTarget as HTMLElement).style.borderColor  = "rgba(245,158,11,0.40)";
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background  = canAffordHint ? "rgba(245,158,11,0.08)" : "rgba(100,100,100,0.08)";
                    (e.currentTarget as HTMLElement).style.borderColor = canAffordHint ? "rgba(245,158,11,0.22)" : "rgba(100,100,100,0.20)";
                  }}
                >
                  {hintLoading ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
                      Loading hint…
                    </>
                  ) : !canAffordHint ? (
                    <>🚫 Hint unavailable — need {hintPenalty} XP (you have {totalXp} XP)</>
                  ) : (
                    // Shows exact XP deduction on the button
                    <>💡 Show Hint <span style={{ opacity: 0.7, fontWeight: 400 }}>−{hintPenalty} XP</span></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => recordTimeAndGo("prev")} disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            <ChevronLeft size={15} /> Prev
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {questions.map((_, i) => {
              const a = answers[questions[i]._id]?.userAnswer ?? "";
              return (
                <button key={i}
                  onClick={() => { setCurrentIdx(i); questionStartRef.current = Date.now(); }}
                  className="w-2.5 h-2.5 rounded-full shrink-0 border-none cursor-pointer transition-all"
                  style={{
                    background: i === currentIdx ? "var(--accent)" : a.trim() ? "var(--green)" : "var(--border2)",
                    transform:  i === currentIdx ? "scale(1.35)" : "scale(1)",
                  }} />
              );
            })}
          </div>

          {isLast ? (
            <button onClick={() => handleSubmit(false)} disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--green)", color: "#fff", boxShadow: "0 0 16px rgba(34,211,160,0.30)" }}>
              {isSubmitting ? "Submitting…" : "Submit Quiz ✓"}
            </button>
          ) : (
            <button onClick={() => recordTimeAndGo("next")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "var(--accent)", color: "#fff" }}>
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN (fresh + past) ──────────────────────────────────────────
  const ResultView = ({ res, isPast }: { res: ResultData; isPast?: boolean }) => {
    const mins = Math.floor(res.timeTakenSecs / 60);
    const secs = res.timeTakenSecs % 60;

    const isExhaustionResult = !res.isPassing && res.earnedXp > 0;
    const isNoXpResult       = !res.isPassing && res.earnedXp === 0;
    const penaltyPct         = Math.round((res.penaltyMultiplier ?? 0) * 100);

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
        <div className="rounded-2xl p-6 text-center"
          style={{
            background: res.isPassing
              ? "linear-gradient(135deg, rgba(34,211,160,0.10), rgba(124,110,243,0.08))"
              : "linear-gradient(135deg, rgba(248,113,113,0.10), rgba(124,110,243,0.08))",
            border: res.isPassing
              ? "1px solid rgba(34,211,160,0.30)"
              : "1px solid rgba(248,113,113,0.25)",
          }}>
          {isPast && (
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider mb-2"
              style={{ color: "var(--text4)" }}>
              {res.isPassing ? "Level Completed" : "All Attempts Used"}
            </p>
          )}
          <div className="text-[52px] font-bold font-mono"
            style={{ color: res.isPassing ? "var(--green)" : "var(--danger)" }}>
            {res.score}%
          </div>
          <p className="text-[18px] font-semibold mt-1" style={{ color: "var(--text)" }}>
            {res.isPassing ? "🎉 All Correct — Level Passed!" : "❌ Not All Correct"}
          </p>
          <p className="text-[13px] font-mono mt-1" style={{ color: "var(--text3)" }}>
            {res.correctAnswers} / {res.totalQuestions} correct
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Correct",    value: String(res.correctAnswers), color: "var(--green)"  },
            { label: "Wrong",      value: String(res.wrongAnswers),   color: "var(--danger)" },
            { label: "Time Taken", value: `${mins}m ${secs}s`,        color: "var(--accent)" },
            { label: "XP Earned",  value: `+${res.earnedXp}`,         color: "var(--amber)"  },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
              <p className="text-[22px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider mt-1"
                style={{ color: "var(--text4)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* XP Breakdown — PASS with deductions */}
        {res.isPassing && (res.hintXpDeduction > 0 || res.wasExhaustionUnlock) && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
              XP Breakdown
            </p>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>Base XP</span>
              <span style={{ color: "var(--text)" }}>+{res.baseXp}</span>
            </div>
            {res.hintXpDeduction > 0 && (
              <div className="flex justify-between text-[13px] font-mono">
                <span style={{ color: "var(--text3)" }}>Hint Penalty</span>
                <span style={{ color: "var(--danger)" }}>−{res.hintXpDeduction}</span>
              </div>
            )}
            {res.wasExhaustionUnlock && (
              <div className="flex justify-between text-[13px] font-mono">
                <span style={{ color: "var(--text3)" }}>Exhaustion-Unlock Penalty (×{res.penaltyMultiplier})</span>
                <span style={{ color: "var(--amber)" }}>applied</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between text-[14px] font-bold font-mono"
              style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text)" }}>Total XP</span>
              <span style={{ color: "var(--amber)" }}>+{res.earnedXp}</span>
            </div>
          </div>
        )}

        {/* XP Breakdown — EXHAUSTION consolation (admin-configured %) */}
        {isExhaustionResult && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid rgba(245,158,11,0.30)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--amber)" }}>
              XP Breakdown — Consolation Award
            </p>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>Base XP (admin set)</span>
              <span style={{ color: "var(--text)" }}>+{res.baseXp}</span>
            </div>
            <div className="flex justify-between text-[13px] font-mono">
              <span style={{ color: "var(--text3)" }}>
                Consolation Rate ×{res.penaltyMultiplier} ({penaltyPct}%)
              </span>
              <span style={{ color: "var(--amber)" }}>applied</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-[14px] font-bold font-mono"
              style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text)" }}>Total XP ({penaltyPct}% of {res.baseXp})</span>
              <span style={{ color: "var(--amber)" }}>+{res.earnedXp}</span>
            </div>
            <p className="text-[11px] font-mono mt-1" style={{ color: "var(--text4)" }}>
              Hint penalties are not applied to consolation awards.
            </p>
          </div>
        )}

        {/* No XP — non-last fail */}
        {isNoXpResult && !isPast && (
          <div className="rounded-xl p-3"
            style={{ background: "rgba(124,110,243,0.06)", border: "1px solid rgba(124,110,243,0.18)" }}>
            <p className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>
              💡 No XP for failed attempts. Pass the level or use all attempts to earn XP.
            </p>
          </div>
        )}

        {/* Retry message */}
        {!res.isPassing && attemptsRemaining > 0 && !isPast && (
          <div className="rounded-xl p-3 text-center"
            style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.20)" }}>
            <p className="text-[13px] font-mono" style={{ color: "var(--accent)" }}>
              You need 100% to pass.{" "}
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining.
              {attemptsRemaining === 1 && levelInfo
                ? ` Last attempt awards ${Math.floor(levelInfo.xpReward * (levelInfo.penaltyXpMultiplier ?? 0.3))} XP (${Math.round((levelInfo.penaltyXpMultiplier ?? 0.3) * 100)}%) if failed.`
                : ""}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {res.canReview && (
            <button onClick={() => { setScreen("review"); setReviewIdx(0); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}>
              <BookOpen size={15} /> Review Answers
            </button>
          )}
          <button
            onClick={() => router.push(`/dashboard/quiz/${categoryId}/${subcategoryId}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "#fff" }}>
            {isPast ? "Back to Levels" : res.isPassing ? "Continue →" : "Try Again →"}
          </button>
        </div>
      </div>
    );
  };

  if (screen === "result"      && result) return <ResultView res={result} />;
  if (screen === "past_result" && result) return <ResultView res={result} isPast />;

  // ── REVIEW SCREEN ─────────────────────────────────────────────────────────
  if (screen === "review" && review.length > 0) {
    const q = review[reviewIdx];

    return (
      <div className="max-w-[680px] mx-auto flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setScreen(result?.submittedAt ? "past_result" : "result")}
            className="flex items-center gap-1.5 text-[13px] font-mono cursor-pointer border-none bg-transparent transition-colors"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
          >
            <ChevronLeft size={15} /> Back to Results
          </button>
          <span className="text-[12px] font-mono" style={{ color: "var(--text4)" }}>
            {reviewIdx + 1} / {review.length}
          </span>
        </div>

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
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.12)", color: "var(--amber)" }}>
                💡 Hint Used
              </span>
            )}
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
                      background: isCorrect ? "rgba(34,211,160,0.12)" : isWrong ? "rgba(248,113,113,0.10)" : "var(--surface2)",
                      border:     isCorrect ? "1.5px solid rgba(34,211,160,0.40)" : isWrong ? "1.5px solid rgba(248,113,113,0.30)" : "1.5px solid var(--border)",
                    }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{ background: isCorrect ? "var(--green)" : isWrong ? "var(--danger)" : "var(--surface)", color: (isCorrect || isWrong) ? "#fff" : "var(--text3)" }}>
                      {opt.key}
                    </span>
                    <span className="text-[13px]" style={{ color: "var(--text)" }}>{text}</span>
                    {isCorrect && <span className="ml-auto text-[11px]" style={{ color: "var(--green)" }}>✓ Correct</span>}
                    {isWrong   && <span className="ml-auto text-[11px]" style={{ color: "var(--danger)" }}>✗ Your answer</span>}
                  </div>
                );
              })}
            </div>
          )}

          {q.questionType === "text" && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl px-4 py-3"
                style={{ background: q.isCorrect ? "rgba(34,211,160,0.10)" : "rgba(248,113,113,0.08)", border: q.isCorrect ? "1px solid rgba(34,211,160,0.30)" : "1px solid rgba(248,113,113,0.25)" }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text4)" }}>Your Answer</p>
                <p className="text-[14px] font-mono" style={{ color: q.isCorrect ? "var(--green)" : "var(--danger)" }}>
                  {q.userAnswer || "(no answer)"}
                </p>
              </div>
              {!q.isCorrect && q.acceptedAnswers && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--green)" }}>Accepted Answers</p>
                  <p className="text-[13px] font-mono" style={{ color: "var(--text)" }}>{q.acceptedAnswers.join(" / ")}</p>
                </div>
              )}
            </div>
          )}

          {q.hintUsed && q.hintText && (
            <div className="rounded-xl p-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--amber)" }}>Hint You Used</p>
              <p className="text-[13px]" style={{ color: "var(--text2)" }}>{q.hintText}</p>
            </div>
          )}

          {q.explanation && (
            <div className="rounded-xl p-3"
              style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.20)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>Explanation</p>
              <p className="text-[13px] leading-[1.65]" style={{ color: "var(--text2)" }}>{q.explanation}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setReviewIdx(i => i - 1)} disabled={reviewIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}>
            <ChevronLeft size={15} /> Previous
          </button>
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