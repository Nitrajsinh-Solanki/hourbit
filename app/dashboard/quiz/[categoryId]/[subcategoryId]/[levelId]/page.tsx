// app/dashboard/quiz/[categoryId]/[subcategoryId]/[levelId]/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams }                      from "next/navigation";
import {
  Clock, ChevronRight, ChevronLeft,
  Eye, AlertTriangle, CheckCircle, XCircle,
  BookOpen, RotateCcw,
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
  hintText:        string;
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
  isUnlocked:           boolean;   // ← ADD THIS
  attemptsRemaining:   number;
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

type Screen = "loading" | "confirm" | "quiz" | "result" | "review" | "error" | "past_result";

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
  const [hintVisible,       setHintVisible]       = useState(false);
  const [timeLeft,          setTimeLeft]          = useState(0);
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [result,            setResult]            = useState<ResultData | null>(null);
  const [review,            setReview]            = useState<ReviewQuestion[]>([]);
  const [reviewIdx,         setReviewIdx]         = useState(0);

  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef  = useRef<number>(Date.now());
  const submitCalledRef   = useRef(false);

  // ── Anti-cheat: disable copy/paste/screenshot/devtools ───────────────────
  // No mention of tab-switching to the user. Silently block what we can.
  useEffect(() => {
    if (screen !== "quiz") return;

    const BLOCKED = ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"] as const;

    const blockEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockKey = (e: KeyboardEvent) => {
      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard?.writeText("").catch(() => {});
        return;
      }
      // Win+Shift+S (Windows Snipping Tool) — block Shift+S when meta pressed
      if ((e.metaKey || e.key === "Meta") && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        return;
      }
      // F12 / DevTools shortcuts
      if (e.key === "F12") { e.preventDefault(); return; }
      if (e.ctrlKey && e.shiftKey && ["i","j","c"].includes(e.key.toLowerCase())) {
        e.preventDefault(); return;
      }
      // Copy / paste / cut / select all / view source / save / print
      const blocked = ["c","v","x","a","u","s","p"];
      if ((e.ctrlKey || e.metaKey) && blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
      // Win+PrtSc (Insert on some laptops acts as PrtSc)
      if (e.key === "Insert" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        return;
      }
    };

    BLOCKED.forEach(ev => document.addEventListener(ev, blockEvent, true));
    document.addEventListener("keydown", blockKey, true);

    // Disable text selection via CSS
    document.body.style.userSelect       = "none";
    (document.body.style as any).webkitUserSelect = "none";
    (document.body.style as any).MozUserSelect    = "none";
    (document.body.style as any).msUserSelect     = "none";

    return () => {
      BLOCKED.forEach(ev => document.removeEventListener(ev, blockEvent, true));
      document.removeEventListener("keydown", blockKey, true);
      document.body.style.userSelect       = "";
      (document.body.style as any).webkitUserSelect = "";
      (document.body.style as any).MozUserSelect    = "";
      (document.body.style as any).msUserSelect     = "";
    };
  }, [screen]);

  // ── On unmount during quiz: attempt is already counted server-side ────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

        // If already completed — show past result directly
        if (found.isCompleted) {
          loadPastResult();
          return;
        }

        if (!found.isUnlocked) {
          toast.error("This level is locked.");
          router.back();
          return;
        }
        if (found.attemptsRemaining === 0) {
          // Exhausted — show past result
          loadPastResult();
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

  // ── Timer ─────────────────────────────────────────────────────────────────
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
      setScreen("result");
       // Refresh navbar XP — dispatch a custom event that layout.tsx listens for
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
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
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
      setQuestions(data.questions);
      setAttemptsRemaining(data.attemptsRemaining);
      setCurrentIdx(0);
      setAnswers({});
      setHintVisible(false);
      questionStartRef.current = Date.now();

      if (data.level.timeLimitMinutes > 0) {
        startTimer(data.level.timeLimitMinutes * 60);
      }

      setScreen("quiz");
    } catch {
      toast.error("Failed to start quiz.");
      setScreen("confirm");
    }
  };

  // ── Answer helpers ────────────────────────────────────────────────────────
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

  const handleShowHint = async () => {
    const q = questions[currentIdx];
    if (!q?.hintText || hintVisible) return;

    // Persist hint usage to server immediately — survives browser close
    try {
      await fetch("/api/quiz/hint", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, questionId: q._id }),
      });
    } catch {
      // Silent — client-side state still updated
    }

    setHintVisible(true);
    setAnswers(prev => ({
      ...prev,
      [q._id]: {
        userAnswer:    prev[q._id]?.userAnswer    ?? "",
        hintUsed:      true,
        timeTakenSecs: prev[q._id]?.timeTakenSecs ?? 0,
      },
    }));
    toast(`−${q.hintXpPenalty} XP hint penalty`, { icon: "💡" });
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
    setHintVisible(false);
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
              Level {levelInfo.levelNumber}
              {levelInfo.name ? ` — ${levelInfo.name}` : ""}
            </h1>
            <p className="text-[13px] mt-1 font-mono" style={{ color: "var(--text3)" }}>
              You must answer ALL questions correctly to pass.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Questions",     value: String(levelInfo.questionCount),                                                         color: "var(--accent)"  },
              { label: "Time Limit",    value: levelInfo.timeLimitMinutes > 0 ? `${levelInfo.timeLimitMinutes} min` : "No limit",        color: "var(--amber)"   },
              { label: "XP Reward",     value: `${levelInfo.xpReward} XP`,                                                              color: "var(--amber)"   },
              { label: "Attempts Left", value: String(attemptsRemaining),                                                               color: attemptsRemaining <= 1 ? "var(--danger)" : "var(--green)" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <p className="text-[20px] font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider mt-1"
                  style={{ color: "var(--text4)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rules — no mention of tab-switch flagging */}
          <div className="rounded-xl p-3 flex flex-col gap-1.5"
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
              style={{ color: "var(--danger)" }}>
              ⚠ Quiz Rules
            </p>
            {[
              "Once started, this attempt is counted even if you close the browser.",
              "Copy, paste, right-click, and screenshots are disabled.",
              "All keyboard shortcuts (Ctrl+C, F12, etc.) are blocked.",
              levelInfo.timeLimitMinutes > 0
                ? `You have ${levelInfo.timeLimitMinutes} minutes. The quiz auto-submits when time runs out.`
                : "There is no time limit for this level.",
              "You must get ALL questions correct to pass.",
            ].map((rule, i) => (
              <p key={i} className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>
                • {rule}
              </p>
            ))}
          </div>

          <button
            onClick={handleStartQuiz}
            className="w-full py-3.5 rounded-xl text-[14px] font-semibold border-none cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 0 24px rgba(124,110,243,0.35)" }}>
            Start Quiz →
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
    const hintUsed   = ans?.hintUsed   ?? false;
    const isLast     = currentIdx === questions.length - 1;

    const timerPct   = levelInfo?.timeLimitMinutes
      ? (timeLeft / (levelInfo.timeLimitMinutes * 60)) * 100
      : 100;
    const timerColor = timeLeft < 60 ? "var(--danger)" : timeLeft < 180 ? "var(--amber)" : "var(--green)";

    return (
      <div className="max-w-[780px] mx-auto flex flex-col gap-4 py-4"
        // Prevent text selection visually
        style={{ userSelect: "none", WebkitUserSelect: "none" }}>

        {/* Top bar */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[12px] font-mono font-semibold"
              style={{ color: "var(--text3)", whiteSpace: "nowrap" }}>
              {currentIdx + 1} / {questions.length}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}>
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
              <Clock size={14} />
              {fmtTime(timeLeft)}
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
              style={{ color: "var(--text4)" }}>
              Question {currentIdx + 1}
            </p>
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
                  <button
                    key={opt.key}
                    onClick={() => saveAnswer(q._id, opt.key)}
                    className="w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-3 transition-all border-none cursor-pointer"
                    style={{
                      background: selected ? "rgba(124,110,243,0.18)" : "var(--surface2)",
                      border:     selected ? "1.5px solid rgba(124,110,243,0.55)" : "1.5px solid var(--border)",
                      color:      "var(--text)",
                    }}
                    onMouseEnter={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background   = "var(--bg)";
                        (e.currentTarget as HTMLElement).style.borderColor  = "rgba(124,110,243,0.30)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!selected) {
                        (e.currentTarget as HTMLElement).style.background   = "var(--surface2)";
                        (e.currentTarget as HTMLElement).style.borderColor  = "var(--border)";
                      }
                    }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        background: selected ? "var(--accent)" : "var(--surface)",
                        color:      selected ? "#fff" : "var(--text3)",
                      }}>
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
                style={{ color: "var(--text4)" }}>
                Your Answer
              </label>
              <input
                type="text"
                value={userAnswer}
                onChange={e => saveAnswer(q._id, e.target.value)}
                placeholder="Type your answer here…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onPaste={e => e.preventDefault()}
                onCopy={e => e.preventDefault()}
                onCut={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
                className="w-full px-4 py-3 rounded-xl text-[14px] font-mono border-none outline-none"
                style={{
                  background: "var(--surface2)",
                  color:      "var(--text)",
                  border:     "1.5px solid var(--border2)",
                  userSelect: "text", // allow typing but not selecting
                }}
                onFocus={e  => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.55)"; }}
                onBlur={e   => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; }}
              />
            </div>
          )}

          {/* Hint */}
          {q.hintText && (
            <div>
              {hintVisible ? (
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <span style={{ color: "var(--amber)", flexShrink: 0 }}>💡</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--amber)" }}>
                      Hint (−{q.hintXpPenalty} XP)
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--text2)" }}>{q.hintText}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleShowHint}
                  className="flex items-center gap-2 text-[12px] font-mono border-none cursor-pointer bg-transparent transition-colors"
                  style={{ color: "var(--text4)" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--amber)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text4)")}
                >
                  <Eye size={13} />
                  Show Hint (−{q.hintXpPenalty} XP penalty)
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

          {/* Question dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {questions.map((_, i) => {
              const a      = answers[questions[i]._id]?.userAnswer ?? "";
              const filled = a.trim() !== "";
              return (
                <button key={i}
                  onClick={() => { setCurrentIdx(i); setHintVisible(false); questionStartRef.current = Date.now(); }}
                  className="w-2.5 h-2.5 rounded-full shrink-0 border-none cursor-pointer transition-all"
                  style={{
                    background: i === currentIdx ? "var(--accent)" : filled ? "var(--green)" : "var(--border2)",
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
              Previous Attempt
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

        {(res.hintXpDeduction > 0 || res.wasExhaustionUnlock) && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text4)" }}>XP Breakdown</p>
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
                <span style={{ color: "var(--text3)" }}>Exhaustion Penalty (×{res.penaltyMultiplier})</span>
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

        {/* Retry message if not passing and attempts remain */}
        {!res.isPassing && attemptsRemaining > 0 && !isPast && (
          <div className="rounded-xl p-3 text-center"
            style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.20)" }}>
            <p className="text-[13px] font-mono" style={{ color: "var(--accent)" }}>
              You need 100% to pass. {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {/* Review button — only if canReview (100% or exhausted) */}
          {res.canReview && (
            <button
              onClick={() => { setScreen("review"); setReviewIdx(0); }}
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
          <button onClick={() => setScreen(result?.submittedAt ? "past_result" : "result")}
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

          {/* Status */}
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
                  <div key={opt.key}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: isCorrect ? "rgba(34,211,160,0.12)" : isWrong ? "rgba(248,113,113,0.10)" : "var(--surface2)",
                      border:     isCorrect ? "1.5px solid rgba(34,211,160,0.40)" : isWrong ? "1.5px solid rgba(248,113,113,0.30)" : "1.5px solid var(--border)",
                    }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                      style={{
                        background: isCorrect ? "var(--green)" : isWrong ? "var(--danger)" : "var(--surface)",
                        color:      (isCorrect || isWrong) ? "#fff" : "var(--text3)",
                      }}>
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
                style={{
                  background: q.isCorrect ? "rgba(34,211,160,0.10)" : "rgba(248,113,113,0.08)",
                  border:     q.isCorrect ? "1px solid rgba(34,211,160,0.30)" : "1px solid rgba(248,113,113,0.25)",
                }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text4)" }}>Your Answer</p>
                <p className="text-[14px] font-mono"
                  style={{ color: q.isCorrect ? "var(--green)" : "var(--danger)" }}>
                  {q.userAnswer || "(no answer)"}
                </p>
              </div>
              {!q.isCorrect && q.acceptedAnswers && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: "var(--green)" }}>Accepted Answers</p>
                  <p className="text-[13px] font-mono" style={{ color: "var(--text)" }}>
                    {q.acceptedAnswers.join(" / ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {q.hintUsed && q.hintText && (
            <div className="rounded-xl p-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "var(--amber)" }}>Hint You Used</p>
              <p className="text-[13px]" style={{ color: "var(--text2)" }}>{q.hintText}</p>
            </div>
          )}

          {q.explanation && (
            <div className="rounded-xl p-3"
              style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.20)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "var(--accent)" }}>Explanation</p>
              <p className="text-[13px] leading-[1.65]" style={{ color: "var(--text2)" }}>
                {q.explanation}
              </p>
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