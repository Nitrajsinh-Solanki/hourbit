"use client";

// app/dashboard/typing/page.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────

type TypingMode =
  | "smallLetters"
  | "mixedLetters"
  | "punctuation"
  | "numbers"
  | "numbersIncluded";

type TestState = "idle" | "running" | "finished";

interface TimerStats {
  highestWpm: number;
  accuracyAtHighestWpm: number;
  highestAccuracy: number;
  wpmAtHighestAccuracy: number;
  totalTests: number;
  averageWpm: number;
}

interface StatsResponse {
  stats: TimerStats;
  globalTotalTests: number;
}

interface CustomTimer {
  _id: string;
  duration: number;
}

interface TestResult {
  wpm: number;
  accuracy: number;
  errors: number;
  totalKeystrokes: number;
  charactersTyped: number;
  duration: number;
}

// ─── Word Generator ─────────────────────────────────────────────

const COMMON_WORDS = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on",
  "with","he","as","you","do","at","this","but","his","by","from","they",
  "we","say","her","she","or","an","will","my","one","all","would","there",
  "their","what","so","up","out","if","about","who","get","which","go","me",
  "when","make","can","like","time","no","just","him","know","take","people",
  "into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back",
  "after","use","two","how","our","work","first","well","way","even","new",
  "want","because","any","these","give","day","most","us","great","between",
  "need","large","often","hand","high","place","hold","turn","where","much",
  "before","move","right","old","too","same","tell","does","set","three",
  "air","play","small","end","put","home","read","spell","add","land","here",
  "must","big","found","still","learn","should","show","form","around","help",
  "school","world","never","next","open","seem","together","always","white",
  "every","near","country","plant","last","keep","child","far","real","life",
  "few","easy","study","those","both","paper","example","light","voice",
  "power","town","fine","drive","common","stop","once","book","hear","sure",
  "watch","color","face","wood","main","level","walk","family","start","bring",
  "change","point","river","road","second","later","idea","body","music",
  "story","fact","door","black","short","class","wind","question","happen",
  "complete","ship","area","half","rock","order","fire","south","problem",
  "piece","told","knew","pass","since","top","whole","space","heard","best",
  "hour","better","during","hundred","five","remember","step","early","hold",
  "west","ground","interest","reach","fast","several","notice","whether",
  "leave","miles","grow","four","carry","state",
];

const PUNCTUATION_MARKS = [".", ",", ";", ":", "!", "?", "-"];
const NUMBERS_LIST = [
  "1","2","3","4","5","6","7","8","9","0",
  "12","23","45","67","89","100","2024","42","99","15","500",
];

function generateText(mode: TypingMode, wordCount = 120): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    let word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    switch (mode) {
      case "mixedLetters":
        word = word.split("").map(c => Math.random() > 0.6 ? c.toUpperCase() : c).join("");
        break;
      case "punctuation":
        word = word.toLowerCase();
        if (Math.random() > 0.72)
          word += PUNCTUATION_MARKS[Math.floor(Math.random() * PUNCTUATION_MARKS.length)];
        break;
      case "numbers":
        word = Math.random() > 0.5
          ? NUMBERS_LIST[Math.floor(Math.random() * NUMBERS_LIST.length)]
          : word.toLowerCase();
        break;
      case "numbersIncluded":
        word = Math.random() > 0.72
          ? NUMBERS_LIST[Math.floor(Math.random() * NUMBERS_LIST.length)]
          : word.toLowerCase();
        break;
      default:
        word = word.toLowerCase();
    }
    words.push(word);
  }
  return words.join(" ");
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

const EMPTY_STATS: TimerStats = {
  highestWpm: 0, accuracyAtHighestWpm: 0,
  highestAccuracy: 0, wpmAtHighestAccuracy: 0,
  totalTests: 0, averageWpm: 0,
};

// ─── Character colour classes ────────────────────────────────────
// Using className instead of inline style to avoid the
// textDecoration / textDecorationColor shorthand conflict that
// caused the React console error.
// Tailwind classes aren't available for CSS vars, so we inject a
// tiny <style> block once and reference stable class names.

const CHAR_STYLE_TAG = `
  .tc-pending   { color: var(--tc-pending);   }
  .tc-correct   { color: var(--tc-correct);   }
  .tc-incorrect { color: var(--tc-incorrect); text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: var(--tc-incorrect); }
  .tc-cursor    { color: var(--tc-cursor);    }
`;

// ─── Stats Card ──────────────────────────────────────────────────

function StatsCard({
  title, primary, sub1, sub2, accent, loading,
}: {
  title: string; primary: string; sub1: string;
  sub2?: string; accent: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 animate-pulse"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", minHeight: 96 }}
      />
    );
  }
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text3)" }}>
        {title}
      </div>
      <div className="text-2xl font-bold font-mono leading-tight" style={{ color: accent }}>
        {primary}
      </div>
      <div className="text-xs" style={{ color: "var(--text2)" }}>{sub1}</div>
      {sub2 && <div className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>{sub2}</div>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

const DEFAULT_TIMERS = [15, 30, 60, 120];

export default function TypingPage() {

  // ── Config
  const [selectedTimer, setSelectedTimer] = useState(30);
  const [typingMode, setTypingMode]       = useState<TypingMode>("smallLetters");
  const [customTimers, setCustomTimers]   = useState<CustomTimer[]>([]);

  // ── Custom timer add UI
  const [showAddTimer, setShowAddTimer]         = useState(false);
  const [newTimerDuration, setNewTimerDuration] = useState("");
  const [addingTimer, setAddingTimer]           = useState(false);

  // ── Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<CustomTimer | null>(null);
  const [deletingTimer, setDeletingTimer] = useState(false);

  // ── Stats
  const [statsData, setStatsData]       = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Test state (drives renders)
  const [testState, setTestState]   = useState<TestState>("idle");
  const [text, setText]             = useState<string[]>([]);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [timeLeft, setTimeLeft]     = useState(30);
  const [result, setResult]         = useState<TestResult | null>(null);

  // ── Refs (mutated during typing — zero re-renders)
  const typedRef         = useRef<string[]>([]);
  const textRef          = useRef<string[]>([]);
  const testStateRef     = useRef<TestState>("idle");
  const timerRef         = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef     = useRef<number>(0);
  const selectedTimerRef = useRef(30);
  const typingModeRef    = useRef<TypingMode>("smallLetters");
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const charEls          = useRef<(HTMLSpanElement | null)[]>([]);
  const saveIdRef        = useRef<string>("");

  // ── ACCURACY FIX: track every keystroke ever pressed, including
  // ones the user backspaced over. A corrected error still counts
  // as an error — identical to how Monkeytype measures accuracy.
  //   accuracy = (correct_keystrokes / total_keystrokes) * 100
  // where correct_keystrokes = total_keystrokes - error_keystrokes
  // and error_keystrokes are keystrokes where typed[i] !== text[i]
  // AT THE MOMENT OF PRESSING (before any backspace correction).
  const keystrokesRef    = useRef(0); // every non-backspace key pressed
  const rawErrorsRef     = useRef(0); // wrong chars pressed (even if later fixed)

  // Keep refs in sync with state
  useEffect(() => { selectedTimerRef.current = selectedTimer; }, [selectedTimer]);
  useEffect(() => { typingModeRef.current    = typingMode;    }, [typingMode]);

  // ─── Fetch stats ──────────────────────────────────────────────

  const fetchStats = useCallback(async (timer?: number) => {
    const t = timer ?? selectedTimerRef.current;
    setStatsLoading(true);
    try {
      const res  = await fetch(`/api/typing/stats?timer=${t}`);
      const data = await res.json();
      if (data.success)
        setStatsData({ stats: data.stats, globalTotalTests: data.globalTotalTests });
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  const fetchCustomTimers = useCallback(async () => {
    try {
      const res  = await fetch("/api/typing/timers");
      const data = await res.json();
      if (data.success) setCustomTimers(data.timers);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStats(30); fetchCustomTimers(); }, [fetchStats, fetchCustomTimers]);
  useEffect(() => { fetchStats(selectedTimer); }, [selectedTimer, fetchStats]);

  // ─── End test ─────────────────────────────────────────────────

  const endTest = useCallback(async () => {
    // Unique run guard — prevents double-save on React 18 strict mode or
    // the rare case where the interval fires twice before clearing.
    const runId = `${Date.now()}`;
    if (saveIdRef.current === runId) return;
    saveIdRef.current = runId;

    if (timerRef.current) clearInterval(timerRef.current);

    const typed   = [...typedRef.current];
    const textArr = [...textRef.current];
    const dur     = selectedTimerRef.current;
    const mode    = typingModeRef.current;

    // ── WPM: based on characters actually typed divided by 5 ──
    const chars      = typed.length;
    const elapsedSec = startTimeRef.current > 0
      ? (Date.now() - startTimeRef.current) / 1000
      : dur;
    const minutes    = elapsedSec / 60;
    const wpm        = minutes > 0 ? Math.round((chars / 5) / minutes) : 0;

    // ── ACCURACY: raw errors / total keystrokes pressed ──
    // rawErrorsRef counts every wrong key AT TIME OF PRESS.
    // Backspacing and retyping correctly does NOT undo that error.
    const totalKS  = keystrokesRef.current;
    const rawErr   = rawErrorsRef.current;
    const accuracy = totalKS > 0
      ? Math.round(((totalKS - rawErr) / totalKS) * 100)
      : 0;

    // Final error count = positions still wrong at end (for display)
    let finalErrors = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] !== textArr[i]) finalErrors++;
    }

    const r: TestResult = {
      wpm,
      accuracy,
      errors:          rawErr,        // total mistakes made (including fixed ones)
      totalKeystrokes: totalKS,
      charactersTyped: chars,
      duration:        Math.round(elapsedSec),
    };

    testStateRef.current = "finished";
    setTestState("finished");
    setResult(r);

    try {
      await fetch("/api/typing/result", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          timerDuration: dur, typingMode: mode,
          wpm, accuracy,
          errors:          rawErr,
          charactersTyped: chars,
        }),
      });
      await fetchStats(dur);
    } catch { /* silent */ }
  }, [fetchStats]);

  // ─── Init / restart ───────────────────────────────────────────

  const initTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    saveIdRef.current = "";

    const arr       = generateText(typingModeRef.current, 120).split("");
    textRef.current = arr;
    typedRef.current = [];
    charEls.current  = [];
    keystrokesRef.current = 0;
    rawErrorsRef.current  = 0;

    setText(arr);
    setTypedChars([]);
    setTimeLeft(selectedTimerRef.current);
    setResult(null);
    testStateRef.current = "idle";
    setTestState("idle");
    startTimeRef.current = 0;

    setTimeout(() => wrapperRef.current?.focus(), 30);
  }, []);

  useEffect(() => {
    initTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimer, typingMode]);

  // ─── Keyboard handler ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Tab" || e.key === "Escape") return;
      if (testStateRef.current === "finished") return;

      e.preventDefault();

      if (e.key === "Backspace") {
        // Backspace never affects error count — damage is already counted
        typedRef.current = typedRef.current.slice(0, -1);
        setTypedChars([...typedRef.current]);
        return;
      }

      if (e.key.length !== 1) return;

      // Start timer on very first character
      if (testStateRef.current === "idle") {
        startTimeRef.current = Date.now();
        testStateRef.current = "running";
        setTestState("running");

        let remaining = selectedTimerRef.current;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            endTest();
          }
        }, 1000);
      }

      // Track keystroke and whether it was correct AT THIS MOMENT
      const pos     = typedRef.current.length;
      const correct = textRef.current[pos] === e.key;
      keystrokesRef.current += 1;
      if (!correct) rawErrorsRef.current += 1;

      typedRef.current = [...typedRef.current, e.key];
      setTypedChars([...typedRef.current]);

      // Scroll next char into view smoothly
      const nextIdx = typedRef.current.length;
      charEls.current[nextIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [endTest]
  );

  // ─── Char states (memoised) ───────────────────────────────────

  const charStates = useMemo<("correct" | "incorrect" | "cursor" | "pending")[]>(() => {
    return text.map((_, i) => {
      if (i < typedChars.length) return typedChars[i] === text[i] ? "correct" : "incorrect";
      if (i === typedChars.length) return "cursor";
      return "pending";
    });
  }, [text, typedChars]);

  // ─── Custom timer handlers ────────────────────────────────────

  const handleAddTimer = async () => {
    const dur = parseInt(newTimerDuration, 10);
    if (!dur || dur < 1 || dur > 3600) { toast.error("Duration must be 1–3600 seconds"); return; }
    setAddingTimer(true);
    try {
      const res  = await fetch("/api/typing/timers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: dur }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomTimers(prev => [...prev, data.timer]);
        setNewTimerDuration(""); setShowAddTimer(false);
        toast.success("Custom timer added");
      } else { toast.error(data.message); }
    } catch { toast.error("Failed to add timer"); }
    finally { setAddingTimer(false); }
  };

  const handleDeleteTimer = async () => {
    if (!confirmDelete) return;
    setDeletingTimer(true);
    try {
      const res  = await fetch("/api/typing/timers", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timerId: confirmDelete._id, duration: confirmDelete.duration }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomTimers(prev => prev.filter(t => t._id !== confirmDelete._id));
        if (selectedTimer === confirmDelete.duration) setSelectedTimer(30);
        setConfirmDelete(null);
        toast.success("Timer deleted");
        fetchStats(selectedTimerRef.current);
      } else { toast.error(data.message); }
    } catch { toast.error("Failed to delete timer"); }
    finally { setDeletingTimer(false); }
  };

  // ─── Derived values ───────────────────────────────────────────

  const timerLabel  = formatDuration(selectedTimer);
  const s           = statsData?.stats ?? EMPTY_STATS;
  const globalTotal = statsData?.globalTotalTests ?? 0;

  const MODES: { key: TypingMode; label: string; title: string }[] = [
    { key: "smallLetters",    label: "abc", title: "Lowercase only"   },
    { key: "mixedLetters",    label: "Abc", title: "Mixed case"       },
    { key: "punctuation",     label: "!,.", title: "With punctuation" },
    { key: "numbers",         label: "123", title: "Numbers only"     },
    { key: "numbersIncluded", label: "ab1", title: "Words + numbers"  },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col gap-6 pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>

      {/* Inject character colour vars + blink keyframe once */}
      <style>{`
        ${CHAR_STYLE_TAG}

        /* Pending chars: clearly readable but visually dimmer than typed.
           We use a fixed mid-grey so it works well in BOTH dark and light themes. */
        :root {
          --tc-pending:   #888899;
          --tc-correct:   var(--green);
          --tc-incorrect: var(--danger);
          --tc-cursor:    var(--text);
        }

        /* Light theme — pending needs to be darker so it's readable on white */
        @media (prefers-color-scheme: light) {
          :root { --tc-pending: #606070; }
        }

        /* Also honour the JS-toggled class the layout.tsx injects */
        body[data-theme="light"] { --tc-pending: #606070; }

        @keyframes typingCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      {/* ── Page title ── */}
      <div className="flex items-center gap-2 pt-1">
        <span style={{ color: "var(--accent)", fontSize: 22 }}>⌨</span>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Typing Practice</h1>
        <span
          className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full font-mono"
          style={{ background: "rgba(124,110,243,0.15)", color: "var(--accent2)", border: "1px solid rgba(124,110,243,0.25)" }}
        >
          {timerLabel}
        </span>
      </div>

      {/* ── Stats Cards — scoped to selected timer ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          title={`Best Speed · ${timerLabel}`}
          primary={`${s.highestWpm} WPM`}
          sub1={`${s.accuracyAtHighestWpm}% accuracy`}
          accent="var(--accent2)"
          loading={statsLoading}
        />
        <StatsCard
          title={`Best Accuracy · ${timerLabel}`}
          primary={`${s.highestAccuracy}%`}
          sub1={`${s.wpmAtHighestAccuracy} WPM`}
          accent="var(--green)"
          loading={statsLoading}
        />
        <StatsCard
          title="Tests Completed"
          primary={`${globalTotal}`}
          sub1={`${s.totalTests} on ${timerLabel} timer`}
          sub2="all timers · all time"
          accent="var(--amber)"
          loading={statsLoading}
        />
        <StatsCard
          title={`Avg WPM · ${timerLabel}`}
          primary={`${s.averageWpm}`}
          sub1={`${s.totalTests} test${s.totalTests !== 1 ? "s" : ""} on this timer`}
          accent="#38bdf8"
          loading={statsLoading}
        />
      </div>

      {/* ── Typing Panel ── */}
      <div
        className="rounded-2xl flex flex-col gap-4 p-5 sm:p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">

          {/* Timer selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {DEFAULT_TIMERS.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTimer(t)}
                className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-all duration-150"
                style={{
                  background: selectedTimer === t ? "var(--accent)"  : "var(--surface2)",
                  color:      selectedTimer === t ? "#fff"            : "var(--text2)",
                  border:     selectedTimer === t ? "1px solid var(--accent)" : "1px solid var(--border2)",
                }}
              >
                {formatDuration(t)}
              </button>
            ))}

            {customTimers.map(ct => (
              <div key={ct._id} className="relative group flex items-center">
                <button
                  onClick={() => setSelectedTimer(ct.duration)}
                  className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-all duration-150 pr-6"
                  style={{
                    background: selectedTimer === ct.duration ? "var(--accent)"  : "var(--surface2)",
                    color:      selectedTimer === ct.duration ? "#fff"            : "var(--text2)",
                    border:     selectedTimer === ct.duration ? "1px solid var(--accent)" : "1px solid var(--border2)",
                  }}
                >
                  {formatDuration(ct.duration)}
                </button>
                <button
                  onClick={() => setConfirmDelete(ct)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-xs w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--danger)" }}
                  title="Delete timer"
                >×</button>
              </div>
            ))}

            {customTimers.length < 3 && (
              <button
                onClick={() => setShowAddTimer(!showAddTimer)}
                className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-all"
                style={{ background: "transparent", color: "var(--text3)", border: "1px dashed var(--border2)" }}
                title="Add custom timer"
              >+</button>
            )}

            {showAddTimer && (
              <div
                className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
              >
                <input
                  type="number" value={newTimerDuration}
                  onChange={e => setNewTimerDuration(e.target.value)}
                  placeholder="sec" min={1} max={3600}
                  className="bg-transparent text-sm w-16 outline-none font-mono"
                  style={{ color: "var(--text)" }}
                  onKeyDown={e => e.key === "Enter" && handleAddTimer()}
                />
                <button onClick={handleAddTimer} disabled={addingTimer}
                  className="text-xs font-medium disabled:opacity-50"
                  style={{ color: "var(--accent)" }}>
                  {addingTimer ? "…" : "add"}
                </button>
                <button onClick={() => setShowAddTimer(false)} className="text-xs" style={{ color: "var(--text3)" }}>×</button>
              </div>
            )}
          </div>

          {/* Mode selector */}
          <div className="flex items-center gap-1">
            {MODES.map(({ key, label, title }) => (
              <button key={key} onClick={() => setTypingMode(key)} title={title}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-150"
                style={{
                  background: typingMode === key ? "rgba(124,110,243,0.15)" : "transparent",
                  color:      typingMode === key ? "var(--accent2)"         : "var(--text3)",
                  border:     typingMode === key ? "1px solid rgba(124,110,243,0.35)" : "1px solid transparent",
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Timer countdown */}
        <div className="flex items-center justify-between px-0.5 h-9">
          <span
            className="font-mono text-3xl font-bold tabular-nums transition-colors duration-300"
            style={{
              color: testState === "running" && timeLeft <= 5
                ? "var(--danger)"
                : testState === "running"
                  ? "var(--accent2)"
                  : "var(--text3)",
            }}
          >
            {timeLeft}
          </span>
          {testState === "idle" && (
            <span className="text-sm animate-pulse" style={{ color: "var(--text3)" }}>
              click here and start typing
            </span>
          )}
          {testState === "running" && (
            <span className="text-sm font-mono" style={{ color: "var(--text3)" }}>
              {typedChars.length} chars
            </span>
          )}
        </div>

        {/* ── Typing area ── */}
        {/*
          Focusable div captures all keystrokes via onKeyDown.
          No hidden <input> — avoids onChange / backspace edge cases.
        */}
        <div
          ref={wrapperRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="relative outline-none select-none cursor-text"
          aria-label="Typing area — click and start typing"
        >
          {/* Focus ring */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-200"
            style={{
              boxShadow: testState === "running"
                ? "0 0 0 2px rgba(124,110,243,0.2)"
                : "0 0 0 2px transparent",
            }}
          />

          <div
            className="relative overflow-hidden rounded-xl"
            style={{ height: "7.5rem", padding: "0.6rem 0.4rem" }}
          >
            {/* Top fade */}
            <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none z-10"
              style={{ background: "linear-gradient(to bottom, var(--surface), transparent)" }} />
            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10"
              style={{ background: "linear-gradient(to top, var(--surface), transparent)" }} />

            {/* Characters — className only, no mixed shorthand/longhand style conflict */}
            <div className="flex flex-wrap font-mono text-xl leading-relaxed" style={{ gap: "0 1px" }}>
              {text.map((char, i) => {
                const state = charStates[i];
                return (
                  <span
                    key={i}
                    ref={el => { charEls.current[i] = el; }}
                    className={`relative transition-colors duration-[50ms] ${
                      state === "correct"   ? "tc-correct"   :
                      state === "incorrect" ? "tc-incorrect" :
                      state === "cursor"    ? "tc-cursor"    :
                      "tc-pending"
                    }`}
                  >
                    {/* Blinking vertical cursor line */}
                    {state === "cursor" && (
                      <span
                        className="absolute top-0 bottom-0"
                        style={{
                          left: -1, width: 2, borderRadius: 1,
                          background: "var(--accent)",
                          animation: "typingCursorBlink 1s step-end infinite",
                        }}
                      />
                    )}
                    {char === " " ? "\u00A0" : char}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Restart */}
        <div className="flex justify-center pt-1">
          <button
            onClick={initTest}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-all duration-150"
            style={{ color: "var(--text3)", background: "transparent", border: "1px solid transparent" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color      = "var(--text2)";
              (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
              (e.currentTarget as HTMLElement).style.border     = "1px solid var(--border2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color      = "var(--text3)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.border     = "1px solid transparent";
            }}
          >
            <span style={{ fontSize: 16 }}>↺</span> restart
          </button>
        </div>
      </div>

      {/* ── Result overlay ── */}
      {testState === "finished" && result && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col gap-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            {/* Header */}
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text3)" }}>
                {timerLabel} · {typingMode}
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>Test Complete</h2>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "WPM",         value: `${result.wpm}`,            color: "var(--accent2)" },
                { label: "Accuracy",    value: `${result.accuracy}%`,      color: "var(--green)"   },
                { label: "Keystrokes",  value: `${result.totalKeystrokes}`, color: "var(--amber)"   },
                { label: "Errors Made", value: `${result.errors}`,          color: "var(--danger)"  },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                >
                  <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
                  <div className="text-[10px] mt-1 uppercase tracking-widest font-semibold" style={{ color: "var(--text3)" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            

            {/* New record badges */}
            <div className="flex flex-col gap-1.5">
              {result.wpm > 0 && result.wpm >= s.highestWpm && s.highestWpm > 0 && (
                <div className="text-xs text-center font-semibold" style={{ color: "var(--accent2)" }}>
                  🎉 New best speed on {timerLabel}!
                </div>
              )}
              {result.accuracy > 0 && result.accuracy >= s.highestAccuracy && s.highestAccuracy > 0 && (
                <div className="text-xs text-center font-semibold" style={{ color: "var(--green)" }}>
                  🎯 New best accuracy on {timerLabel}!
                </div>
              )}
            </div>

            {/* Next test button */}
            <button
              onClick={initTest}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity duration-150"
              style={{ background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              Next Test ↵
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full mx-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Delete Custom Timer</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text2)" }}>
              All typing history and scores for the{" "}
              <span className="font-mono" style={{ color: "var(--text)" }}>{formatDuration(confirmDelete.duration)}</span>{" "}
              timer will be <span style={{ color: "var(--danger)" }}>permanently deleted</span>. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
              >Cancel</button>
              <button
                onClick={handleDeleteTimer} disabled={deletingTimer}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.3)" }}
              >{deletingTimer ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}