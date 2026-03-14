"use client";
// app/dashboard/typing/page.tsx

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type TypingMode =
  | "smallLetters" | "mixedLetters" | "punctuation"
  | "numbers"      | "numbersIncluded";

type TestState = "idle" | "running" | "finished";

interface TimerStats {
  highestWpm: number; accuracyAtHighestWpm: number;
  highestAccuracy: number; wpmAtHighestAccuracy: number;
  totalTests: number; averageWpm: number;
}
interface StatsResponse { stats: TimerStats; globalTotalTests: number; }
interface CustomTimer   { _id: string; duration: number; }
interface TestResult {
  wpm: number; effectiveWpm: number; accuracy: number;
  errors: number; totalKeystrokes: number;
  charactersTyped: number; duration: number;
}
interface WordToken {
  chars: string[];   // chars of word + trailing space
  startIdx: number;  // index in the global char array
}

// ─── Word bank ───────────────────────────────────────────────────────────────

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
const PUNCT  = [".", ",", ";", ":", "!", "?", "-"];
const NUMS   = ["1","2","3","4","5","6","7","8","9","0","12","23","45","67",
                "89","100","2024","42","99","15","500"];

function pickWord(mode: TypingMode): string {
  const base = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
  switch (mode) {
    case "mixedLetters":
      return base.split("").map(c => Math.random() > 0.6 ? c.toUpperCase() : c).join("");
    case "punctuation": {
      const w = base.toLowerCase();
      return Math.random() > 0.72 ? w + PUNCT[Math.floor(Math.random() * PUNCT.length)] : w;
    }
    case "numbers":
      return Math.random() > 0.5 ? NUMS[Math.floor(Math.random() * NUMS.length)] : base.toLowerCase();
    case "numbersIncluded":
      return Math.random() > 0.72 ? NUMS[Math.floor(Math.random() * NUMS.length)] : base.toLowerCase();
    default:
      return base.toLowerCase();
  }
}

function generateTokens(mode: TypingMode, count = 200): WordToken[] {
  const tokens: WordToken[] = [];
  let idx = 0;
  for (let i = 0; i < count; i++) {
    const w    = pickWord(mode);
    const full = i < count - 1 ? w + " " : w;
    tokens.push({ chars: full.split(""), startIdx: idx });
    idx += full.length;
  }
  return tokens;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

const EMPTY_STATS: TimerStats = {
  highestWpm:0, accuracyAtHighestWpm:0,
  highestAccuracy:0, wpmAtHighestAccuracy:0,
  totalTests:0, averageWpm:0,
};

// Module-level stats cache (survives re-renders, cleared on page unload)
const statsCache = new Map<number, StatsResponse>();

// ─── StatsCard ───────────────────────────────────────────────────────────────

function StatsCard({ title, primary, sub1, sub2, accent, loading }: {
  title: string; primary: string; sub1: string;
  sub2?: string; accent: string; loading?: boolean;
}) {
  if (loading)
    return (
      <div className="rounded-2xl p-4 sm:p-5 animate-pulse"
        style={{ background:"var(--surface)", border:"1px solid var(--border2)", minHeight:88 }} />
    );
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-1"
      style={{ background:"var(--surface)", border:"1px solid var(--border2)" }}>
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
        style={{ color:"var(--text3)" }}>{title}</div>
      <div className="text-xl sm:text-2xl font-bold font-mono leading-tight" style={{ color:accent }}>
        {primary}
      </div>
      <div className="text-xs" style={{ color:"var(--text2)" }}>{sub1}</div>
      {sub2 && <div className="text-[11px]" style={{ color:"var(--text3)" }}>{sub2}</div>}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const DEFAULT_TIMERS = [15, 30, 60, 120];

export default function TypingPage() {

  const [selectedTimer, setSelectedTimer] = useState(30);
  const [typingMode, setTypingMode]       = useState<TypingMode>("smallLetters");
  const [customTimers, setCustomTimers]   = useState<CustomTimer[]>([]);
  const [showAddTimer, setShowAddTimer]   = useState(false);
  const [newTimerDur, setNewTimerDur]     = useState("");
  const [addingTimer, setAddingTimer]     = useState(false);
  const [confirmDel, setConfirmDel]       = useState<CustomTimer | null>(null);
  const [deletingTimer, setDeletingTimer] = useState(false);

  const [statsData, setStatsData]       = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [testState, setTestState]   = useState<TestState>("idle");
  const [words, setWords]           = useState<WordToken[]>([]);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [timeLeft, setTimeLeft]     = useState(30);
  const [result, setResult]         = useState<TestResult | null>(null);
  const [isFocused, setIsFocused]   = useState(false);

  // ── scroll state stored ONLY in a ref to avoid stale closures ──
  // lineOffsetRef holds the current translateY value.
  // We set it synchronously and then call setScrollTick to trigger a re-render.
  const lineOffsetRef = useRef(0);
  const [scrollTick, setScrollTick] = useState(0); // just a render trigger

  // Mutable refs — never cause re-renders on their own
  const typedRef         = useRef<string[]>([]);
  const wordsRef         = useRef<WordToken[]>([]);
  const testStateRef     = useRef<TestState>("idle");
  const timerRef         = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef     = useRef<number>(0);
  const selectedTimerRef = useRef(30);
  const typingModeRef    = useRef<TypingMode>("smallLetters");
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const textBlockRef     = useRef<HTMLDivElement>(null);  // the flex-wrap word container
  const clipRef          = useRef<HTMLDivElement>(null);  // the overflow:hidden viewport
  const saveIdRef        = useRef("");
  const keystrokesRef    = useRef(0);
  const rawErrorsRef     = useRef(0);
  const wordElsRef       = useRef<(HTMLSpanElement | null)[]>([]);
  // Track which row we last scrolled to, to avoid re-scrolling on every keystroke
  const lastRowRef       = useRef(-1);

  useEffect(() => { selectedTimerRef.current = selectedTimer; }, [selectedTimer]);
  useEffect(() => { typingModeRef.current    = typingMode;    }, [typingMode]);

  // ── Stats fetch with session cache ───────────────────────────────────────

  const fetchStats = useCallback(async (timer: number, force = false) => {
    if (!force && statsCache.has(timer)) {
      setStatsData(statsCache.get(timer)!);
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    try {
      const res  = await fetch(`/api/typing/stats?timer=${timer}`);
      const data = await res.json();
      if (data.success) {
        const p: StatsResponse = { stats: data.stats, globalTotalTests: data.globalTotalTests };
        statsCache.set(timer, p);
        setStatsData(p);
      }
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

  // ── Scroll logic — THE KEY FIX ──────────────────────────────────────────
  //
  // PROBLEM: previously updateLineScroll closed over `lineOffset` state.
  //   On every keystroke React hadn't re-rendered yet, so lineOffset was stale
  //   (still 0 or previous value). The formula:
  //     elTopInContainer = elRect.top - containerRect.top - lineOffset   ← WRONG
  //   used the old lineOffset, computing a wrong delta, causing over-scroll.
  //
  // FIX: store the offset in lineOffsetRef (a ref — always current).
  //   Only call setScrollTick(n+1) to trigger the re-render AFTER we have
  //   already written the correct value to the ref.
  //   Formula: newOffset = -(activeWordTop - targetTop)  where both coords
  //   are measured in the UN-TRANSFORMED frame (we subtract current
  //   lineOffsetRef.current from the measured top to undo the transform).
  //
  // We also gate scrolling so it only moves when the CURSOR CHANGES ROW,
  // not on every single keystroke. This prevents jittery motion.

  const updateScroll = useCallback((cursorCharIdx: number) => {
    if (!clipRef.current || !textBlockRef.current) return;

    // Find which word the cursor is in
    const wTokens = wordsRef.current;
    let activeWi  = wTokens.length - 1;
    for (let i = 0; i < wTokens.length; i++) {
      const t = wTokens[i];
      if (cursorCharIdx >= t.startIdx && cursorCharIdx < t.startIdx + t.chars.length) {
        activeWi = i; break;
      }
    }

    const wordEl = wordElsRef.current[activeWi];
    if (!wordEl) return;

    // Measure the word's top relative to the clip container,
    // UNDOING the current transform so we're in layout-space coordinates.
    const clipRect  = clipRef.current.getBoundingClientRect();
    const wordRect  = wordEl.getBoundingClientRect();
    const wordTopInLayout = wordRect.top - clipRect.top - lineOffsetRef.current;

    // Determine which visual row this word is on (0-indexed from top of text block)
    const lineH = wordEl.offsetHeight || 40;
    const currentRow = Math.round(wordTopInLayout / lineH);

    // Only scroll when we move to a new row (gate prevents per-keystroke jitter)
    if (currentRow === lastRowRef.current) return;
    lastRowRef.current = currentRow;

    // We want row 0 to stay visible until the cursor reaches row 1,
    // then scroll so the active row is always the FIRST visible row.
    // i.e. targetTop = 0 (clip top) — cursor row should be at the top.
    // For the very first row (row 0) we don't scroll at all.
    if (currentRow <= 0) {
      lineOffsetRef.current = 0;
    } else {
      lineOffsetRef.current = -(currentRow * lineH);
    }

    setScrollTick(t => t + 1);
  }, []);

  // ── End test ─────────────────────────────────────────────────────────────

  const endTest = useCallback(async () => {
    const runId = `${Date.now()}-${Math.random()}`;
    if (saveIdRef.current === runId) return;
    saveIdRef.current = runId;
    if (timerRef.current) clearInterval(timerRef.current);

    const typed    = [...typedRef.current];
    const allChars = wordsRef.current.flatMap(w => w.chars);
    const dur      = selectedTimerRef.current;
    const mode     = typingModeRef.current;

    const chars      = typed.length;
    const elapsedSec = startTimeRef.current > 0
      ? (Date.now() - startTimeRef.current) / 1000
      : dur;
    const minutes    = elapsedSec / 60;
    const rawWpm     = minutes > 0 ? Math.round((chars / 5) / minutes) : 0;

    const totalKS      = keystrokesRef.current;
    const rawErr       = rawErrorsRef.current;
    const accuracy     = totalKS > 0 ? Math.round(((totalKS - rawErr) / totalKS) * 100) : 0;
    const effectiveWpm = Math.round(rawWpm * Math.pow(accuracy / 100, 2));

    const r: TestResult = {
      wpm: rawWpm, effectiveWpm, accuracy,
      errors: rawErr, totalKeystrokes: totalKS,
      charactersTyped: chars, duration: Math.round(elapsedSec),
    };

    testStateRef.current = "finished";
    setTestState("finished");
    setResult(r);

    try {
      await fetch("/api/typing/result", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timerDuration: dur, typingMode: mode,
          wpm: effectiveWpm, accuracy,
          errors: rawErr, charactersTyped: chars,
        }),
      });
      await fetchStats(dur, true);
    } catch { /* silent */ }
  }, [fetchStats]);

  // ── Init / restart ───────────────────────────────────────────────────────

  const initTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    saveIdRef.current     = "";
    lineOffsetRef.current = 0;
    lastRowRef.current    = -1;

    const tokens         = generateTokens(typingModeRef.current, 200);
    wordsRef.current     = tokens;
    typedRef.current     = [];
    wordElsRef.current   = [];
    keystrokesRef.current = 0;
    rawErrorsRef.current  = 0;

    setWords(tokens);
    setTypedChars([]);
    setTimeLeft(selectedTimerRef.current);
    setResult(null);
    setScrollTick(0);
    testStateRef.current = "idle";
    setTestState("idle");
    startTimeRef.current = 0;

    requestAnimationFrame(() => requestAnimationFrame(() => wrapperRef.current?.focus()));
  }, []);

  useEffect(() => { initTest(); }, [selectedTimer, typingMode]); // eslint-disable-line

  // ── Keyboard handler ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Tab") { e.preventDefault(); initTest(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (testStateRef.current === "finished") {
        if (e.key === "Enter") { e.preventDefault(); initTest(); }
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") { initTest(); return; }

      if (e.key === "Backspace") {
        typedRef.current = typedRef.current.slice(0, -1);
        const next = [...typedRef.current];
        setTypedChars(next);
        updateScroll(next.length);
        return;
      }
      if (e.key.length !== 1) return;

      // Start timer
      if (testStateRef.current === "idle") {
        startTimeRef.current = Date.now();
        testStateRef.current = "running";
        setTestState("running");
        let remaining = selectedTimerRef.current;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setTimeLeft(remaining);
          if (remaining <= 0) { clearInterval(timerRef.current!); endTest(); }
        }, 1000);
      }

      const allChars = wordsRef.current.flatMap(w => w.chars);
      const pos      = typedRef.current.length;
      keystrokesRef.current += 1;
      if (allChars[pos] !== e.key) rawErrorsRef.current += 1;

      typedRef.current = [...typedRef.current, e.key];
      const next = [...typedRef.current];
      setTypedChars(next);
      updateScroll(next.length);
    },
    [endTest, initTest, updateScroll],
  );

  // ── Char states ───────────────────────────────────────────────────────────

  const allChars = useMemo(() => words.flatMap(w => w.chars), [words]);

  type CS = "correct" | "incorrect" | "cursor" | "pending";
  const charStates = useMemo<CS[]>(() => {
    return allChars.map((_, i) => {
      if (i < typedChars.length) return typedChars[i] === allChars[i] ? "correct" : "incorrect";
      if (i === typedChars.length) return "cursor";
      return "pending";
    });
  }, [allChars, typedChars]);

  // ── Custom timer handlers ─────────────────────────────────────────────────

  const handleAddTimer = async () => {
    const dur = parseInt(newTimerDur, 10);
    if (!dur || dur < 1 || dur > 3600) { toast.error("Duration must be 1–3600 seconds"); return; }
    setAddingTimer(true);
    try {
      const res  = await fetch("/api/typing/timers", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ duration: dur }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomTimers(p => [...p, data.timer]);
        setNewTimerDur(""); setShowAddTimer(false);
        toast.success("Custom timer added");
      } else toast.error(data.message);
    } catch { toast.error("Failed to add timer"); }
    finally { setAddingTimer(false); }
  };

  const handleDeleteTimer = async () => {
    if (!confirmDel) return;
    setDeletingTimer(true);
    try {
      const res  = await fetch("/api/typing/timers", {
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ timerId: confirmDel._id, duration: confirmDel.duration }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomTimers(p => p.filter(t => t._id !== confirmDel._id));
        if (selectedTimer === confirmDel.duration) setSelectedTimer(30);
        setConfirmDel(null);
        toast.success("Timer deleted");
        statsCache.delete(confirmDel.duration);
        fetchStats(selectedTimerRef.current, true);
      } else toast.error(data.message);
    } catch { toast.error("Failed to delete timer"); }
    finally { setDeletingTimer(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const timerLabel  = fmtDur(selectedTimer);
  const s           = statsData?.stats ?? EMPTY_STATS;
  const globalTotal = statsData?.globalTotalTests ?? 0;

  const MODES: { key: TypingMode; label: string; title: string }[] = [
    { key:"smallLetters",    label:"abc", title:"Lowercase only"   },
    { key:"mixedLetters",    label:"Abc", title:"Mixed case"       },
    { key:"punctuation",     label:"!,.", title:"With punctuation" },
    { key:"numbers",         label:"123", title:"Numbers only"     },
    { key:"numbersIncluded", label:"ab1", title:"Words + numbers"  },
  ];

  const liveWpm = useMemo(() => {
    if (testState !== "running" || !startTimeRef.current) return null;
    const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60;
    if (elapsed < 0.05) return null;
    const raw = Math.round((typedChars.length / 5) / elapsed);
    const ks  = keystrokesRef.current;
    const re  = rawErrorsRef.current;
    const acc = ks > 0 ? (ks - re) / ks : 1;
    return Math.round(raw * acc * acc);
  }, [testState, typedChars.length]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col gap-4 sm:gap-6 pb-10"
      style={{ background:"var(--bg)", color:"var(--text)" }}>

      {/* ── Injected styles ── */}
      <style>{`
        /* Character colours */
        .tc-p  { color: var(--tc-p,  #7a7a8c); }
        .tc-ok { color: var(--tc-ok, var(--green, #22d3a0)); }
        .tc-er {
          color: var(--tc-er, var(--danger, #f87171));
          text-decoration-line: underline;
          text-decoration-style: wavy;
          text-decoration-color: var(--tc-er, #f87171);
        }
        body[data-theme="light"] { --tc-p: #55556a; }
        @media (prefers-color-scheme: light) { :root { --tc-p: #55556a; } }

        /* Cursor blink */
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Word token — never breaks mid-word */
        .wt {
          display: inline-flex;
          white-space: nowrap;
          flex-shrink: 0;
          /* Slight letter-spacing inside each word for readability */
        }

        /* Typing text size — fluid */
        .ty-text {
          font-size: clamp(16px, 1.6vw + 8px, 24px);
          line-height: 2.4;
          letter-spacing: 0.02em;
        }

        /* Focus ring */
        .ty-focused { box-shadow: 0 0 0 2.5px rgba(124,110,243,.45); }
        .ty-panel   { border-radius: 16px; transition: box-shadow .2s; }

        /* Unfocused overlay */
        .ty-overlay {
          position:absolute; inset:0; border-radius:12px; z-index:20;
          display:flex; align-items:center; justify-content:center;
          background:rgba(0,0,0,.50);
          backdrop-filter:blur(3px);
          cursor:pointer;
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span style={{ color:"var(--accent)", fontSize:22 }}>⌨</span>
        <h1 className="text-lg sm:text-xl font-bold" style={{ color:"var(--text)" }}>Typing Practice</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full font-mono"
          style={{ background:"rgba(124,110,243,.15)", color:"var(--accent2)", border:"1px solid rgba(124,110,243,.25)" }}>
          {timerLabel}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] sm:text-xs font-mono"
          style={{ color:"var(--text3)" }}>
          <kbd className="px-1.5 py-0.5 rounded"
            style={{ background:"var(--surface2)", border:"1px solid var(--border2)" }}>Tab</kbd>
          restart
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatsCard title={`Best Speed · ${timerLabel}`} primary={`${s.highestWpm} WPM`}
          sub1={`${s.accuracyAtHighestWpm}% accuracy`} accent="var(--accent2)" loading={statsLoading} />
        <StatsCard title={`Best Accuracy · ${timerLabel}`} primary={`${s.highestAccuracy}%`}
          sub1={`${s.wpmAtHighestAccuracy} WPM`} accent="var(--green)" loading={statsLoading} />
        <StatsCard title="Tests Completed" primary={`${globalTotal}`}
          sub1={`${s.totalTests} on ${timerLabel}`} sub2="all timers · all time"
          accent="var(--amber)" loading={statsLoading} />
        <StatsCard title={`Avg WPM · ${timerLabel}`} primary={`${s.averageWpm}`}
          sub1={`${s.totalTests} test${s.totalTests !== 1 ? "s" : ""}`}
          accent="#38bdf8" loading={statsLoading} />
      </div>

      {/* ── Typing panel ── */}
      <div className="flex flex-col gap-3 sm:gap-5 p-4 sm:p-6 ty-panel"
        style={{ background:"var(--surface)", border:"1px solid var(--border2)" }}>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">

          {/* Timer buttons */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {DEFAULT_TIMERS.map(t => (
              <button key={t} onClick={() => setSelectedTimer(t)}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium transition-all"
                style={{
                  background: selectedTimer===t ? "var(--accent)"  : "var(--surface2)",
                  color:      selectedTimer===t ? "#fff"            : "var(--text2)",
                  border:     selectedTimer===t ? "1px solid var(--accent)" : "1px solid var(--border2)",
                }}>
                {fmtDur(t)}
              </button>
            ))}

            {customTimers.map(ct => (
              <div key={ct._id} className="relative group flex items-center">
                <button onClick={() => setSelectedTimer(ct.duration)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium transition-all pr-5"
                  style={{
                    background: selectedTimer===ct.duration ? "var(--accent)"  : "var(--surface2)",
                    color:      selectedTimer===ct.duration ? "#fff"            : "var(--text2)",
                    border:     selectedTimer===ct.duration ? "1px solid var(--accent)" : "1px solid var(--border2)",
                  }}>
                  {fmtDur(ct.duration)}
                </button>
                <button onClick={() => setConfirmDel(ct)}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-xs w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color:"var(--danger)" }}>×</button>
              </div>
            ))}

            {customTimers.length < 3 && (
              <button onClick={() => setShowAddTimer(!showAddTimer)}
                className="px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium"
                style={{ background:"transparent", color:"var(--text3)", border:"1px dashed var(--border2)" }}
                title="Add custom timer">+</button>
            )}

            {showAddTimer && (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                style={{ background:"var(--surface2)", border:"1px solid var(--border2)" }}>
                <input type="number" value={newTimerDur} onChange={e => setNewTimerDur(e.target.value)}
                  placeholder="sec" min={1} max={3600}
                  className="bg-transparent text-xs sm:text-sm w-14 outline-none font-mono"
                  style={{ color:"var(--text)" }}
                  onKeyDown={e => e.key==="Enter" && handleAddTimer()} />
                <button onClick={handleAddTimer} disabled={addingTimer}
                  className="text-xs font-medium disabled:opacity-50" style={{ color:"var(--accent)" }}>
                  {addingTimer ? "…" : "add"}
                </button>
                <button onClick={() => setShowAddTimer(false)} className="text-xs"
                  style={{ color:"var(--text3)" }}>×</button>
              </div>
            )}
          </div>

          {/* Mode */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {MODES.map(({ key, label, title }) => (
              <button key={key} onClick={() => setTypingMode(key)} title={title}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-medium transition-all"
                style={{
                  background: typingMode===key ? "rgba(124,110,243,.15)" : "transparent",
                  color:      typingMode===key ? "var(--accent2)"         : "var(--text3)",
                  border:     typingMode===key ? "1px solid rgba(124,110,243,.35)" : "1px solid transparent",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Timer + live stats row */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums transition-colors"
            style={{
              color: testState==="running" && timeLeft<=5
                ? "var(--danger)"
                : testState==="running"
                  ? "var(--accent2)"
                  : "var(--text3)",
            }}>
            {timeLeft}
          </span>

          {testState==="idle" && (
            <span className="text-xs sm:text-sm animate-pulse" style={{ color:"var(--text3)" }}>
              click the text and start typing
            </span>
          )}
          {testState==="running" && (
            <div className="flex items-center gap-3 font-mono text-xs sm:text-sm"
              style={{ color:"var(--text3)" }}>
              {liveWpm !== null && <span style={{ color:"var(--accent2)" }}>{liveWpm} wpm</span>}
              <span>{typedChars.length} chars</span>
            </div>
          )}
        </div>

        {/* ── THE TYPING AREA ─────────────────────────────────────────────── */}
        {/*
          Architecture:
            • wrapperRef  — focusable keyboard-capture div (outline:none)
            • clipRef     — overflow:hidden viewport; height = 4 lines
            • textBlockRef — the full text rendered with flex-wrap; shifted
                             via transform:translateY(lineOffsetRef.current)
            • word-tokens (.wt) — each word is inline-flex, never breaks

          Scroll algorithm (see updateScroll above):
            1. Find which word-element contains the cursor character.
            2. Undo the current transform to get the word's layout-space top.
            3. Determine which row (0-indexed) the word is on.
            4. If row hasn't changed since last keystroke, do nothing (no jitter).
            5. If row > 0, shift the entire block up by -(row * lineHeight).
            6. Row 0 = offset 0 (never over-scroll upward).
        */}
        <div
          ref={wrapperRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onClick={() => wrapperRef.current?.focus()}
          className={`relative outline-none select-none cursor-text ty-panel ${isFocused ? "ty-focused" : ""}`}
          aria-label="Typing area — click and start typing"
          style={{ outline: "none" }}
        >
          {/* ── Clip viewport — 4 lines tall ── */}
          <div
            ref={clipRef}
            className="overflow-hidden relative"
            style={{
              // Height = 4 × line-height of .ty-text
              // ty-text line-height = 2.4; font-size ≈ clamp(16px, ~, 24px)
              // We use em units so it scales with the font:
              // 4 lines × 2.4em line-height = 9.6em
              // Add 0.8em top+bottom padding so first/last line aren't clipped
              height: "calc(4 * 2.4 * clamp(16px, 1.6vw + 8px, 24px))",
              padding: "0.5em 0.5em",
              borderRadius: 12,
            }}>

            {/* Top fade mask */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none z-10"
              style={{ height:"2em", background:"linear-gradient(to bottom, var(--surface), transparent)" }} />
            {/* Bottom fade mask */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
              style={{ height:"2em", background:"linear-gradient(to top, var(--surface), transparent)" }} />

            {/* Click-to-focus overlay */}
            {!isFocused && testState !== "finished" && (
              <div className="ty-overlay" onClick={() => wrapperRef.current?.focus()}>
                <div className="flex flex-col items-center gap-2 text-white text-center px-4">
                  <span className="text-3xl">⌨️</span>
                  <span className="text-sm sm:text-base font-semibold">Click here to start typing</span>
                  <span className="text-[11px] opacity-70">or tap this box on mobile</span>
                </div>
              </div>
            )}

            {/* ── Text block — shifts up via transform ── */}
            <div
              ref={textBlockRef}
              className="ty-text font-mono"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
                transform: `translateY(${lineOffsetRef.current}px)`,
                transition: "transform 0.1s ease",
                paddingBottom: "4em",
                userSelect: "none",
              }}
            >
              {words.map((token, wi) => (
                <span
                  key={wi}
                  ref={el => { wordElsRef.current[wi] = el; }}
                  className="wt"
                >
                  {token.chars.map((ch, ci) => {
                    const gi    = token.startIdx + ci;
                    const state = charStates[gi] ?? "pending";
                    const isCur = state === "cursor";

                    return (
                      <span
                        key={ci}
                        className={
                          state === "correct"   ? "tc-ok" :
                          state === "incorrect" ? "tc-er" :
                          "tc-p"
                        }
                        style={isCur ? { color:"var(--text)", position:"relative" } : undefined}
                      >
                        {/* Cursor bar */}
                        {isCur && (
                          <span style={{
                            position:"absolute", left:-1, top:"15%", bottom:"10%",
                            width:2, borderRadius:1,
                            background:"var(--accent)",
                            animation:"blink 1s step-end infinite",
                          }} />
                        )}
                        {ch === " " ? "\u00A0" : ch}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Restart hint */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={initTest}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all"
            style={{ color:"var(--text3)", background:"transparent", border:"1px solid transparent" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color="var(--text2)"; el.style.background="var(--surface2)";
              el.style.border="1px solid var(--border2)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color="var(--text3)"; el.style.background="transparent";
              el.style.border="1px solid transparent";
            }}>
            <span style={{ fontSize:16 }}>↺</span> restart
          </button>
          <span className="text-[10px] sm:text-xs font-mono" style={{ color:"var(--text3)" }}>
            <kbd className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background:"var(--surface2)", border:"1px solid var(--border2)" }}>Tab</kbd>
            {" "}quick restart
          </span>
        </div>
      </div>

      {/* ── Result modal — bottom-sheet on mobile ── */}
      {testState === "finished" && result && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
          style={{ background:"rgba(0,0,0,.82)", backdropFilter:"blur(6px)" }}>
          <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 flex flex-col gap-5"
            style={{ background:"var(--surface)", border:"1px solid var(--border2)" }}>

            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color:"var(--text3)" }}>
                {timerLabel} · {typingMode}
              </div>
              <h2 className="text-lg sm:text-xl font-bold" style={{ color:"var(--text)" }}>
                Test Complete
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { label:"Effective WPM",  value:`${result.effectiveWpm}`, sub:"speed × accuracy²",     color:"var(--accent2)" },
                { label:"Accuracy",       value:`${result.accuracy}%`,    sub:`${result.totalKeystrokes} keystrokes`, color:"var(--green)"   },
                { label:"Raw WPM",        value:`${result.wpm}`,          sub:"before accuracy penalty",color:"#38bdf8"        },
                { label:"Errors Made",    value:`${result.errors}`,       sub:"incl. corrected",        color:"var(--danger)"  },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-xl p-3 sm:p-4 text-center"
                  style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
                  <div className="text-2xl sm:text-3xl font-bold font-mono" style={{ color }}>{value}</div>
                  <div className="text-[9px] sm:text-[10px] mt-1 uppercase tracking-widest font-semibold"
                    style={{ color:"var(--text3)" }}>{label}</div>
                  <div className="text-[9px] mt-0.5" style={{ color:"var(--text3)" }}>{sub}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {result.effectiveWpm > 0 && result.effectiveWpm >= s.highestWpm && s.highestWpm > 0 && (
                <div className="text-xs text-center font-semibold" style={{ color:"var(--accent2)" }}>
                  🎉 New best speed on {timerLabel}!
                </div>
              )}
              {result.accuracy > 0 && result.accuracy >= s.highestAccuracy && s.highestAccuracy > 0 && (
                <div className="text-xs text-center font-semibold" style={{ color:"var(--green)" }}>
                  🎯 New best accuracy on {timerLabel}!
                </div>
              )}
            </div>

            <button onClick={initTest}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background:"var(--accent)", color:"#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity=".85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="1"; }}>
              Next Test ↵
              <span className="ml-2 text-xs opacity-70 font-mono">or Tab / Enter</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Delete timer confirm ── */}
      {confirmDel && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
          style={{ background:"rgba(0,0,0,.72)", backdropFilter:"blur(6px)" }}>
          <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6"
            style={{ background:"var(--surface)", border:"1px solid var(--border2)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ color:"var(--text)" }}>
              Delete Custom Timer
            </h3>
            <p className="text-sm mb-5" style={{ color:"var(--text2)" }}>
              All history for the{" "}
              <span className="font-mono" style={{ color:"var(--text)" }}>{fmtDur(confirmDel.duration)}</span>{" "}
              timer will be <span style={{ color:"var(--danger)" }}>permanently deleted</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border2)" }}>
                Cancel
              </button>
              <button onClick={handleDeleteTimer} disabled={deletingTimer}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background:"rgba(248,113,113,.12)", color:"var(--danger)", border:"1px solid rgba(248,113,113,.3)" }}>
                {deletingTimer ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}