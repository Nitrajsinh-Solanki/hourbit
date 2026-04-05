"use client";
// app/dashboard/typing/page.tsx — Performance-optimised (MonkeyType-style DOM updates)

import React, {
  useState, useEffect, useRef, useCallback,
  useLayoutEffect, useImperativeHandle, forwardRef,
} from "react";
import Link from "next/link";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type CursorStyle =
  | "minimal" | "laser" | "electric" | "poison" | "heartbeat";

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
interface WordToken { chars: string[]; startIdx: number; }

// ─── Cursor style config ─────────────────────────────────────────────────────

const CURSOR_STYLES: {
  key: CursorStyle; label: string; icon: string; title: string;
}[] = [
  { key: "minimal",   label: "Minimal",   icon: "▎",  title: "Minimal — clean classic caret"       },
  { key: "laser",     label: "Laser",     icon: "⚡", title: "Laser — precision neon beam"         },
  { key: "electric",  label: "Electric",  icon: "⚔",  title: "Electric Blade — sharp energy blade" },
  { key: "poison",    label: "Poison",    icon: "☠",  title: "Poison Needle — toxic neon spike"    },
  { key: "heartbeat", label: "Heartbeat", icon: "♥",  title: "Heartbeat — pulsing alive caret"     },
];

const CURSOR_LS_KEY    = "ty_cursor_style_v2";
const DEFAULT_CURSOR: CursorStyle = "minimal";

function safeReadCursor(): CursorStyle {
  try {
    const v = localStorage.getItem(CURSOR_LS_KEY) as CursorStyle | null;
    if (v && CURSOR_STYLES.some(c => c.key === v)) return v;
  } catch { /* unavailable */ }
  return DEFAULT_CURSOR;
}
function safeWriteCursor(v: CursorStyle) {
  try { localStorage.setItem(CURSOR_LS_KEY, v); } catch { /* unavailable */ }
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
const PUNCT = [".", ",", ";", ":", "!", "?", "-"];
const NUMS  = ["1","2","3","4","5","6","7","8","9","0","12","23","45","67",
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
      return Math.random() > 0.5
        ? NUMS[Math.floor(Math.random() * NUMS.length)]
        : base.toLowerCase();
    case "numbersIncluded":
      return Math.random() > 0.72
        ? NUMS[Math.floor(Math.random() * NUMS.length)]
        : base.toLowerCase();
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

function appendTokens(mode: TypingMode, count = 150, startOffset: number): WordToken[] {
  const tokens: WordToken[] = [];
  let idx = startOffset;
  for (let i = 0; i < count; i++) {
    const w = pickWord(mode) + " ";
    tokens.push({ chars: w.split(""), startIdx: idx });
    idx += w.length;
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
  highestWpm: 0, accuracyAtHighestWpm: 0,
  highestAccuracy: 0, wpmAtHighestAccuracy: 0,
  totalTests: 0, averageWpm: 0,
};
const statsCache = new Map<number, StatsResponse>();

// ─── StatsCard ───────────────────────────────────────────────────────────────

function StatsCard({ title, primary, sub1, sub2, accent, loading }: {
  title: string; primary: string; sub1: string;
  sub2?: string; accent: string; loading?: boolean;
}) {
  if (loading)
    return (
      <div className="rounded-2xl p-4 sm:p-5 animate-pulse"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", minHeight: 88 }} />
    );
  return (
    <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text3)" }}>{title}</div>
      <div className="text-xl sm:text-2xl font-bold font-mono leading-tight" style={{ color: accent }}>
        {primary}
      </div>
      <div className="text-xs" style={{ color: "var(--text2)" }}>{sub1}</div>
      {sub2 && <div className="text-[11px]" style={{ color: "var(--text3)" }}>{sub2}</div>}
    </div>
  );
}

// ─── TextDisplay — memoised, DOM-mutated text renderer ───────────────────────
//
// This component owns the character <span> refs and the single caret element.
// It re-renders ONLY when `words` (structure) or `lineOffset` (scroll) changes —
// never on individual keystrokes.
// The parent calls updateTyped() imperatively; we mutate classList directly.

interface TextDisplayHandle {
  /** Called by parent on every keystroke — zero React state changes. */
  updateTyped(typed: string[], prevLen: number): void;
}

interface TextDisplayProps {
  words:        WordToken[];
  lineOffset:   number;
  typedRef:     React.MutableRefObject<string[]>;
  wordElsRef:   React.MutableRefObject<(HTMLSpanElement | null)[]>;
  textBlockRef: React.MutableRefObject<HTMLDivElement | null>;
}

const TextDisplay = forwardRef<TextDisplayHandle, TextDisplayProps>(
  ({ words, lineOffset, typedRef, wordElsRef, textBlockRef }, handle) => {

    // Flat array: charSpanRefs[globalCharIndex] = the <span> DOM element
    const charSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);
    // Cached flat char array — rebuilt only when `words` changes
    const allCharsRef  = useRef<string[]>([]);
    // Single caret element that moves through the DOM (never recreated)
    const caretElRef   = useRef<HTMLSpanElement | null>(null);

    // ── After every render: re-sync DOM with logical state ──────────────────
    // Runs synchronously before paint → no flicker.
    // Triggered by: words extension OR lineOffset change (both are infrequent).
    // NOT triggered by keystrokes (no state changes on keystrokes).
    useLayoutEffect(() => {
      // Lazy-create the persistent caret element
      if (!caretElRef.current) {
        const c = document.createElement("span");
        c.className = "ty-caret";
        c.setAttribute("aria-hidden", "true");
        caretElRef.current = c;
      }

      // Rebuild flat char cache (O(n) but only on words change)
      const allChars: string[] = [];
      for (const t of words) for (const ch of t.chars) allChars.push(ch);
      allCharsRef.current = allChars;

      const typed  = typedRef.current;
      const refs   = charSpanRefs.current;
      const len    = typed.length;
      const caret  = caretElRef.current;

      // Reset every span to its correct class
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        el.style.cssText = "";
        if (i < len) {
          el.className = typed[i] === allChars[i] ? "tc-ok" : "tc-er";
        } else {
          el.className = "tc-p";
        }
      }

      // Place caret at cursor position
      const cursorEl = refs[len];
      if (cursorEl) {
        cursorEl.style.position = "relative";
        cursorEl.style.color    = "var(--text)";
        cursorEl.insertBefore(caret, cursorEl.firstChild);
      }
    }); // no deps → runs after every render of this component

    // ── Imperative update (hot path) ────────────────────────────────────────
    useImperativeHandle(handle, () => ({
      updateTyped(typed: string[], prevLen: number) {
        const allChars = allCharsRef.current;
        const caret    = caretElRef.current;
        if (!caret) return;

        const newLen = typed.length;
        const refs   = charSpanRefs.current;

        // 1. Move caret to new position FIRST (avoids stale position:relative)
        const newCursorEl = refs[newLen];
        if (newCursorEl && caret.parentElement !== newCursorEl) {
          newCursorEl.style.position = "relative";
          newCursorEl.style.color    = "var(--text)";
          newCursorEl.insertBefore(caret, newCursorEl.firstChild);
        }

        // 2. Update all other affected spans in the changed range
        const from = Math.min(prevLen, newLen);
        const to   = Math.max(prevLen, newLen);

        for (let i = from; i <= to && i < allChars.length; i++) {
          if (i === newLen) continue; // already handled above
          const el = refs[i];
          if (!el) continue;

          if (i < newLen) {
            el.className     = typed[i] === allChars[i] ? "tc-ok" : "tc-er";
            el.style.cssText = "";
          } else {
            el.className     = "tc-p";
            el.style.cssText = "";
          }
        }
      },
    }), []); // stable — accesses everything through refs

    return (
      <div
        ref={textBlockRef as React.RefObject<HTMLDivElement>}
        className="ty-text font-mono"
        style={{
          display:       "flex",
          flexWrap:      "wrap",
          alignContent:  "flex-start",
          transform:     `translateY(${lineOffset}px)`,
          transition:    "transform 0.12s ease",
          paddingBottom: "4em",
          userSelect:    "none",
          willChange:    "transform",
        }}
      >
        {words.map((token, wi) => (
          <span
            key={wi}
            ref={el => { wordElsRef.current[wi] = el; }}
            className="wt"
          >
            {token.chars.map((ch, ci) => {
              const gi = token.startIdx + ci;
              return (
                <span
                  key={ci}
                  ref={el => { charSpanRefs.current[gi] = el; }}
                  className="tc-p"
                >
                  {ch === " " ? "\u00A0" : ch}
                </span>
              );
            })}
          </span>
        ))}
      </div>
    );
  }
);
TextDisplay.displayName = "TextDisplay";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TIMERS      = [15, 30, 60, 120];
const LOOKAHEAD_THRESHOLD = 300;

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TypingPage() {

  // ── Cursor style — SSR-safe ───────────────────────────────────────────────
  const [cursorStyle, _setCursorStyle] = useState<CursorStyle>(DEFAULT_CURSOR);
  const [cursorMounted, setCursorMounted] = useState(false);

  useEffect(() => {
    _setCursorStyle(safeReadCursor());
    setCursorMounted(true);
  }, []);

  const setCursorStyle = useCallback((s: CursorStyle) => {
    _setCursorStyle(s);
    safeWriteCursor(s);
  }, []);

  // ── Core state ────────────────────────────────────────────────────────────
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

  const [testState, setTestState] = useState<TestState>("idle");
  const [words, setWords]         = useState<WordToken[]>([]);
  const [timeLeft, setTimeLeft]   = useState(30);
  const [result, setResult]       = useState<TestResult | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [lineOffset, setLineOffset] = useState(0); // replaces scrollTick

  // ── Refs ──────────────────────────────────────────────────────────────────
  // typedRef: source of truth for typed chars (never stored in state)
  const typedRef         = useRef<string[]>([]);
  // allCharsRef: flat char cache for O(1) error detection per keystroke
  const allCharsRef      = useRef<string[]>([]);
  const wordsRef         = useRef<WordToken[]>([]);
  const testStateRef     = useRef<TestState>("idle");
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef     = useRef<number>(0);
  const selectedTimerRef = useRef(30);
  const typingModeRef    = useRef<TypingMode>("smallLetters");
  const wrapperRef       = useRef<HTMLDivElement>(null);
  const textBlockRef     = useRef<HTMLDivElement>(null);
  const clipRef          = useRef<HTMLDivElement>(null);
  const textDisplayRef   = useRef<TextDisplayHandle>(null);
  const wordElsRef       = useRef<(HTMLSpanElement | null)[]>([]);
  const saveIdRef        = useRef("");
  const keystrokesRef    = useRef(0);
  const rawErrorsRef     = useRef(0);
  const lastRowRef       = useRef(-1);
  const lineOffsetRef    = useRef(0);

  useEffect(() => { selectedTimerRef.current = selectedTimer; }, [selectedTimer]);
  useEffect(() => { typingModeRef.current    = typingMode;    }, [typingMode]);

  // ── Stats fetch ───────────────────────────────────────────────────────────

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

  // ── Dynamic word extension ────────────────────────────────────────────────

  const maybeExtendWords = useCallback((cursorIdx: number) => {
    const current = wordsRef.current;
    if (!current.length) return;
    const last       = current[current.length - 1];
    const totalChars = last.startIdx + last.chars.length;
    if (totalChars - cursorIdx < LOOKAHEAD_THRESHOLD) {
      const newTokens = appendTokens(typingModeRef.current, 150, totalChars);
      const extended  = [...current, ...newTokens];
      wordsRef.current = extended;
      // Extend flat char cache in place — O(newTokens) not O(all)
      for (const t of newTokens) for (const ch of t.chars) allCharsRef.current.push(ch);
      wordElsRef.current = [...wordElsRef.current, ...new Array(newTokens.length).fill(null)];
      setWords(extended); // triggers TextDisplay re-render; useLayoutEffect re-syncs states
    }
  }, []);

  // ── Scroll (direct DOM — no state update per keystroke) ──────────────────

  const updateScroll = useCallback((cursorCharIdx: number) => {
    if (!clipRef.current || !textBlockRef.current) return;
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
    const clipRect        = clipRef.current.getBoundingClientRect();
    const wordRect        = wordEl.getBoundingClientRect();
    const wordTopInLayout = wordRect.top - clipRect.top - lineOffsetRef.current;
    const lineH           = wordEl.offsetHeight || 40;
    const currentRow      = Math.round(wordTopInLayout / lineH);
    if (currentRow === lastRowRef.current) return;
    lastRowRef.current    = currentRow;
    const newOffset       = currentRow <= 0 ? 0 : -(currentRow * lineH);
    lineOffsetRef.current = newOffset;
    // setLineOffset triggers TextDisplay re-render (infrequent — once per line)
    setLineOffset(newOffset);
  }, []);

  // ── End test ──────────────────────────────────────────────────────────────

  const endTest = useCallback(async () => {
    const runId = `${Date.now()}-${Math.random()}`;
    if (saveIdRef.current === runId) return;
    saveIdRef.current = runId;
    if (timerRef.current) clearInterval(timerRef.current);

    const dur        = selectedTimerRef.current;
    const mode       = typingModeRef.current;
    const typed      = typedRef.current;
    const chars      = typed.length;
    const elapsedSec = startTimeRef.current > 0
      ? (Date.now() - startTimeRef.current) / 1000 : dur;
    const minutes    = elapsedSec / 60;
    const rawWpm     = minutes > 0 ? Math.round((chars / 5) / minutes) : 0;
    const totalKS    = keystrokesRef.current;
    const rawErr     = rawErrorsRef.current;
    const accuracy   = totalKS > 0 ? Math.round(((totalKS - rawErr) / totalKS) * 100) : 0;
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

    const tokens     = generateTokens(typingModeRef.current, 200);
    wordsRef.current = tokens;
    typedRef.current = [];
    wordElsRef.current = [];
    keystrokesRef.current = 0;
    rawErrorsRef.current  = 0;

    // Rebuild flat char cache (O(n), only on init/restart)
    const allChars: string[] = [];
    for (const t of tokens) for (const ch of t.chars) allChars.push(ch);
    allCharsRef.current = allChars;

    setWords(tokens);      // triggers TextDisplay re-render + useLayoutEffect reset
    setLineOffset(0);
    setTimeLeft(selectedTimerRef.current);
    setResult(null);
    testStateRef.current = "idle";
    setTestState("idle");
    startTimeRef.current = 0;

    requestAnimationFrame(() => requestAnimationFrame(() => wrapperRef.current?.focus()));
  }, []);

  useEffect(() => { initTest(); }, [selectedTimer, typingMode]); // eslint-disable-line

  // ── Keyboard handler — hot path, ZERO state updates per keystroke ─────────

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
        if (!typedRef.current.length) return;
        const prevLen = typedRef.current.length;
        typedRef.current.pop(); // O(1) mutation
        textDisplayRef.current?.updateTyped(typedRef.current, prevLen);
        updateScroll(typedRef.current.length);
        return;
      }
      if (e.key.length !== 1) return;

      // ── Start timer on first keystroke ───────────────────────────────────
      if (testStateRef.current === "idle") {
        startTimeRef.current = Date.now();
        testStateRef.current = "running";
        setTestState("running"); // one state update on test start
        let remaining = selectedTimerRef.current;
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setTimeLeft(remaining); // one state update per second
          if (remaining <= 0) { clearInterval(timerRef.current!); endTest(); }
        }, 1000);
      }

      // ── Record keystroke ─────────────────────────────────────────────────
      const pos = typedRef.current.length;
      keystrokesRef.current += 1;
      // O(1) lookup via cached allCharsRef (no flatMap per keystroke!)
      if (allCharsRef.current[pos] !== e.key) rawErrorsRef.current += 1;

      const prevLen = typedRef.current.length;
      typedRef.current.push(e.key); // O(1) amortised mutation

      // DOM update — zero React state changes
      textDisplayRef.current?.updateTyped(typedRef.current, prevLen);

      maybeExtendWords(typedRef.current.length);
      updateScroll(typedRef.current.length);
    },
    [endTest, initTest, updateScroll, maybeExtendWords],
  );

  // ── Custom timer handlers ─────────────────────────────────────────────────

  const handleAddTimer = async () => {
    const dur = parseInt(newTimerDur, 10);
    if (!dur || dur < 1 || dur > 3600) { toast.error("Duration must be 1–3600 seconds"); return; }
    setAddingTimer(true);
    try {
      const res  = await fetch("/api/typing/timers", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
        method: "DELETE", headers: { "Content-Type": "application/json" },
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

  const timerLabel = fmtDur(selectedTimer);
  const s          = statsData?.stats ?? EMPTY_STATS;
  const globalTotal = statsData?.globalTotalTests ?? 0;

  const MODES: { key: TypingMode; label: string; title: string }[] = [
    { key: "smallLetters",    label: "abc", title: "Lowercase only"   },
    { key: "mixedLetters",    label: "Abc", title: "Mixed case"       },
    { key: "punctuation",     label: "!,.", title: "With punctuation" },
    { key: "numbers",         label: "123", title: "Numbers only"     },
    { key: "numbersIncluded", label: "ab1", title: "Words + numbers"  },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col gap-4 sm:gap-6 pb-10"
      style={{ background: "var(--bg)", color: "var(--text)" }}>

      <style>{`
        /* ── Char colours ── */
        .tc-p  { color: var(--tc-p, #7a7a8c); }
        .tc-ok { color: var(--tc-ok, var(--green, #22d3a0)); }
        .tc-er {
          color: var(--tc-er, var(--danger, #f87171));
          text-decoration-line: underline;
          text-decoration-style: wavy;
          text-decoration-color: var(--tc-er, #f87171);
        }
        body[data-theme="light"] { --tc-p: #55556a; }
        @media (prefers-color-scheme: light) { :root { --tc-p: #55556a; } }

        /* ── Typing layout ── */
        .wt { display: inline-flex; white-space: nowrap; flex-shrink: 0; }
        .ty-text {
          font-size: clamp(16px, 1.6vw + 8px, 24px);
          line-height: 2.4;
          letter-spacing: .02em;
        }

        /* ════════════════════════════════════════════════
           HISTORY LINK — ANIMATED
           ════════════════════════════════════════════════ */
        @keyframes hist-border-spin {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes hist-shimmer {
          0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: translateX(220%) skewX(-15deg); opacity: 0; }
        }
        @keyframes hist-dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.6); opacity: .65; }
        }
        @keyframes hist-icon-bounce {
          0%, 55%, 100% { transform: translateY(0) rotate(0deg); }
          65%            { transform: translateY(-3px) rotate(-6deg); }
          75%            { transform: translateY(1px) rotate(3deg); }
          85%            { transform: translateY(-1.5px) rotate(-2deg); }
        }
        @keyframes hist-glow-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(124,110,243,0), 0 0 0 0 rgba(99,102,241,0); }
          30%     { box-shadow: 0 0 8px 2px rgba(124,110,243,.45), 0 0 18px 4px rgba(99,102,241,.2); }
          60%     { box-shadow: 0 0 4px 1px rgba(124,110,243,.25), 0 0 10px 2px rgba(99,102,241,.1); }
        }
        @keyframes hist-text-flicker {
          0%,94%,100% { opacity: 1; }
          95%          { opacity: .6; }
          97%          { opacity: 1; }
          98%          { opacity: .75; }
        }

        .ty-hist-link {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 13px 5px 9px; border-radius: 10px;
          font-size: 11.5px; font-weight: 700; letter-spacing: .04em;
          text-decoration: none; position: relative; overflow: hidden;
          isolation: isolate; white-space: nowrap;
          color: var(--accent2, #c4b5fd);
          background: rgba(124,110,243,.08);
          border: 1px solid rgba(124,110,243,.3);
          transition: color 200ms, background 200ms, border-color 200ms;
          animation: hist-glow-pulse 3.5s ease-in-out infinite 1.2s;
        }
        .ty-hist-link::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(105deg,transparent 35%,rgba(167,139,250,.18) 50%,transparent 65%);
          transform: translateX(-100%) skewX(-15deg);
          animation: hist-shimmer 3.5s ease-in-out infinite 1.2s;
          pointer-events: none; z-index: 1;
        }
        .ty-hist-link:hover {
          color: #fff; background: rgba(124,110,243,.22);
          border-color: rgba(167,139,250,.65);
          box-shadow: 0 0 14px 3px rgba(124,110,243,.35), 0 0 28px 6px rgba(99,102,241,.15);
          animation: none;
        }
        .ty-hist-link:hover::before { animation: none; }
        .ty-hist-link:hover .ty-hist-icon { animation: hist-icon-bounce 600ms ease-in-out; }
        .ty-hist-icon {
          font-size: 13px; display: inline-block;
          animation: hist-icon-bounce 3.5s ease-in-out infinite 1.2s;
          position: relative; z-index: 2;
        }
        .ty-hist-text { position: relative; z-index: 2; animation: hist-text-flicker 7s ease-in-out infinite 2s; }
        .ty-hist-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--accent2, #c4b5fd); display: inline-block; margin-right: 1px;
          position: relative; z-index: 2; animation: hist-dot-pulse 1.8s ease-in-out infinite;
          box-shadow: 0 0 4px 1px rgba(167,139,250,.55);
        }
        body[data-theme="light"] .ty-hist-link { color:#5b21b6; background:rgba(109,40,217,.06); border-color:rgba(109,40,217,.28); }
        body[data-theme="light"] .ty-hist-dot  { background:#7c3aed; box-shadow:0 0 3px 1px rgba(124,58,237,.4); }
        @media (prefers-color-scheme:light) {
          .ty-hist-link { color:#5b21b6; background:rgba(109,40,217,.06); border-color:rgba(109,40,217,.28); }
          .ty-hist-dot  { background:#7c3aed; box-shadow:0 0 3px 1px rgba(124,58,237,.4); }
        }

        /* ════════════════════════════════════════════════
           CARET BASE — 2px wide for ALL styles
           ════════════════════════════════════════════════ */
        .ty-caret {
          position: absolute;
          left: -1px;
          top: 8%;
          bottom: 8%;
          width: 2px;
          border-radius: 1px;
          pointer-events: none;
          will-change: opacity, box-shadow;
          contain: strict;
          overflow: visible;
        }

        /* ════════════════════════════════════════════════
           1. MINIMAL
           ════════════════════════════════════════════════ */
        @keyframes minimal-blink {
          0%,49%  { opacity: 1; }
          50%,100% { opacity: 0; }
        }
        [data-cursor="minimal"] .ty-caret {
          background: var(--accent, #7c6ef3);
          box-shadow: none;
          animation: minimal-blink 1.05s step-end infinite;
        }

        /* ════════════════════════════════════════════════
           2. LASER
           ════════════════════════════════════════════════ */
        @keyframes laser-breathe {
          0%,100% {
            opacity: 1;
            box-shadow: 0 0 4px 0px rgba(167,139,250,.9),
                        0 0 10px 1px rgba(139,92,246,.5);
          }
          50% {
            opacity: .5;
            box-shadow: 0 0 2px 0px rgba(167,139,250,.4),
                        0 0 5px 0px rgba(139,92,246,.2);
          }
        }
        [data-cursor="laser"] .ty-caret {
          background: linear-gradient(180deg,
            transparent 0%, rgba(233,213,255,.9) 15%,
            #c4b5fd 45%, #a78bfa 55%,
            rgba(233,213,255,.9) 85%, transparent 100%);
          animation: laser-breathe 1s ease-in-out infinite;
        }
        body[data-theme="light"] [data-cursor="laser"] .ty-caret {
          background: linear-gradient(180deg,
            transparent 0%, rgba(109,40,217,.85) 15%,
            #7c3aed 45%, #6d28d9 55%,
            rgba(109,40,217,.85) 85%, transparent 100%);
        }
        @media (prefers-color-scheme:light) {
          [data-cursor="laser"] .ty-caret {
            background: linear-gradient(180deg,
              transparent 0%, rgba(109,40,217,.85) 15%,
              #7c3aed 45%, #6d28d9 55%,
              rgba(109,40,217,.85) 85%, transparent 100%);
          }
        }

        /* ════════════════════════════════════════════════
           3. ELECTRIC BLADE
           ════════════════════════════════════════════════ */
        @keyframes electric-surge {
          0%,100% {
            opacity: 1;
            box-shadow: 0 0 4px 0px rgba(125,211,252,.9),
                        0 0 12px 1px rgba(56,189,248,.5);
          }
          35% { opacity: .6; box-shadow: 0 0 2px 0px rgba(125,211,252,.35); }
          65% {
            opacity: 1;
            box-shadow: 0 0 6px 0px rgba(125,211,252,1),
                        0 0 16px 2px rgba(56,189,248,.65);
          }
        }
        [data-cursor="electric"] .ty-caret {
          background: linear-gradient(180deg,
            transparent 0%, rgba(224,242,254,.7) 8%,
            #fff 20%, #bae6fd 35%,
            #38bdf8 55%, #0ea5e9 75%,
            rgba(14,165,233,.4) 90%, transparent 100%);
          animation: electric-surge 700ms ease-in-out infinite;
        }
        body[data-theme="light"] [data-cursor="electric"] .ty-caret {
          background: linear-gradient(180deg,
            transparent 0%, rgba(3,105,161,.65) 10%,
            #0284c7 30%, #0369a1 55%,
            rgba(3,105,161,.5) 85%, transparent 100%);
        }
        @media (prefers-color-scheme:light) {
          [data-cursor="electric"] .ty-caret {
            background: linear-gradient(180deg,
              transparent 0%, rgba(3,105,161,.65) 10%,
              #0284c7 30%, #0369a1 55%,
              rgba(3,105,161,.5) 85%, transparent 100%);
          }
        }

        /* ════════════════════════════════════════════════
           4. POISON
           ════════════════════════════════════════════════ */
        @keyframes poison-pulse {
          0%,100% {
            opacity: 1;
            box-shadow: 0 0 4px 0px rgba(74,222,128,.85),
                        0 0 12px 1px rgba(22,163,74,.45);
          }
          35% { opacity: .5; box-shadow: 0 0 2px 0px rgba(74,222,128,.3); }
          68% {
            opacity: .95;
            box-shadow: 0 0 5px 0px rgba(74,222,128,.9),
                        0 0 14px 2px rgba(22,163,74,.5);
          }
        }
        [data-cursor="poison"] .ty-caret {
          background: linear-gradient(180deg,
            rgba(255,255,255,.92) 0%, #bbf7d0 10%, #4ade80 30%,
            #22c55e 55%, #16a34a 78%, rgba(21,128,61,.3) 100%);
          animation: poison-pulse 1.4s ease-in-out infinite;
        }
        body[data-theme="light"] [data-cursor="poison"] .ty-caret {
          background: linear-gradient(180deg,rgba(255,255,255,.8) 0%,#86efac 12%,#16a34a 38%,#15803d 64%,rgba(20,83,45,.4) 100%);
        }
        @media (prefers-color-scheme:light) {
          [data-cursor="poison"] .ty-caret {
            background: linear-gradient(180deg,rgba(255,255,255,.8) 0%,#86efac 12%,#16a34a 38%,#15803d 64%,rgba(20,83,45,.4) 100%);
          }
        }

        /* ════════════════════════════════════════════════
           5. HEARTBEAT
           ════════════════════════════════════════════════ */
        @keyframes heartbeat {
          0%   { opacity: .35; box-shadow: 0 0 2px 0px rgba(248,113,113,.2); }
          10%  { opacity: 1;   box-shadow: 0 0 6px 0px rgba(248,113,113,.95), 0 0 16px 2px rgba(239,68,68,.45); }
          20%  { opacity: .45; box-shadow: 0 0 2px 0px rgba(248,113,113,.3); }
          30%  { opacity: 1;   box-shadow: 0 0 8px 1px rgba(248,113,113,.98), 0 0 20px 3px rgba(239,68,68,.5); }
          44%  { opacity: .3;  box-shadow: 0 0 1px 0px rgba(248,113,113,.15); }
          100% { opacity: .35; box-shadow: 0 0 2px 0px rgba(248,113,113,.2); }
        }
        [data-cursor="heartbeat"] .ty-caret {
          background: linear-gradient(180deg,
            rgba(255,255,255,.62) 0%, #fca5a5 18%, #f87171 42%,
            #ef4444 65%, rgba(185,28,28,.5) 100%);
          animation: heartbeat 900ms ease-in-out infinite;
        }
        body[data-theme="light"] [data-cursor="heartbeat"] .ty-caret {
          background: linear-gradient(180deg,rgba(255,255,255,.6) 0%,#fca5a5 18%,#ef4444 42%,#dc2626 65%,rgba(153,27,27,.5) 100%);
        }
        @media (prefers-color-scheme:light) {
          [data-cursor="heartbeat"] .ty-caret {
            background: linear-gradient(180deg,rgba(255,255,255,.6) 0%,#fca5a5 18%,#ef4444 42%,#dc2626 65%,rgba(153,27,27,.5) 100%);
          }
        }

        /* ════════════════════════════════════════════════
           CURSOR SELECTOR UI
           ════════════════════════════════════════════════ */
        .cs-row   { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
        .cs-label {
          font-size:10px; font-weight:700; letter-spacing:.08em;
          text-transform:uppercase; color:var(--text3); flex-shrink:0; min-width:46px;
        }
        .cs-pills { display:flex; flex-wrap:wrap; gap:4px; }
        .cs-pill  {
          display:inline-flex; align-items:center; gap:3px;
          padding:3px 9px 3px 7px; border-radius:7px;
          font-size:10.5px; font-weight:600; letter-spacing:.015em;
          cursor:pointer; white-space:nowrap;
          border:1px solid var(--border2);
          background:transparent; color:var(--text3);
          user-select:none; -webkit-tap-highlight-color:transparent;
          transition:background 130ms ease, color 130ms ease,
                     border-color 130ms ease, box-shadow 130ms ease;
          line-height:1;
        }
        .cs-pill:hover:not(.cs-pill--active) { color:var(--text2); background:var(--surface2); }
        .cs-icon { font-size:10px; opacity:.82; }

        .cs-pill--minimal.cs-pill--active   { background:rgba(124,110,243,.14); border-color:rgba(167,139,250,.45); color:var(--accent2,#c4b5fd); }
        .cs-pill--laser.cs-pill--active     { background:rgba(139,92,246,.18);  border-color:rgba(167,139,250,.55); color:#ddd6fe; box-shadow:0 0 8px rgba(139,92,246,.22); }
        .cs-pill--electric.cs-pill--active  { background:rgba(56,189,248,.14);  border-color:rgba(125,211,252,.5);  color:#bae6fd; box-shadow:0 0 8px rgba(56,189,248,.2); }
        .cs-pill--poison.cs-pill--active    { background:rgba(74,222,128,.13);  border-color:rgba(74,222,128,.48);  color:#bbf7d0; box-shadow:0 0 8px rgba(74,222,128,.18); }
        .cs-pill--heartbeat.cs-pill--active { background:rgba(248,113,113,.13); border-color:rgba(248,113,113,.48); color:#fecaca; box-shadow:0 0 8px rgba(248,113,113,.18); }

        body[data-theme="light"] .cs-pill--minimal.cs-pill--active   { background:rgba(91,33,182,.08);   border-color:rgba(91,33,182,.4);   color:#5b21b6; box-shadow:none; }
        body[data-theme="light"] .cs-pill--laser.cs-pill--active     { background:rgba(109,40,217,.08);  border-color:rgba(109,40,217,.4);  color:#5b21b6; box-shadow:none; }
        body[data-theme="light"] .cs-pill--electric.cs-pill--active  { background:rgba(3,105,161,.08);   border-color:rgba(3,105,161,.4);   color:#0369a1; box-shadow:none; }
        body[data-theme="light"] .cs-pill--poison.cs-pill--active    { background:rgba(21,128,61,.08);   border-color:rgba(21,128,61,.4);   color:#166534; box-shadow:none; }
        body[data-theme="light"] .cs-pill--heartbeat.cs-pill--active { background:rgba(185,28,28,.08);   border-color:rgba(185,28,28,.4);   color:#991b1b; box-shadow:none; }
        @media (prefers-color-scheme:light) {
          .cs-pill--minimal.cs-pill--active   { background:rgba(91,33,182,.08);   border-color:rgba(91,33,182,.4);   color:#5b21b6; box-shadow:none; }
          .cs-pill--laser.cs-pill--active     { background:rgba(109,40,217,.08);  border-color:rgba(109,40,217,.4);  color:#5b21b6; box-shadow:none; }
          .cs-pill--electric.cs-pill--active  { background:rgba(3,105,161,.08);   border-color:rgba(3,105,161,.4);   color:#0369a1; box-shadow:none; }
          .cs-pill--poison.cs-pill--active    { background:rgba(21,128,61,.08);   border-color:rgba(21,128,61,.4);   color:#166534; box-shadow:none; }
          .cs-pill--heartbeat.cs-pill--active { background:rgba(185,28,28,.08);   border-color:rgba(185,28,28,.4);   color:#991b1b; box-shadow:none; }
        }

        /* ── Click-to-focus overlay ── */
        .ty-overlay {
          position:absolute; inset:0; border-radius:12px; z-index:20;
          display:flex; align-items:center; justify-content:center;
          background:rgba(0,0,0,.50); backdrop-filter:blur(3px); cursor:pointer;
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <span style={{ color: "var(--accent)", fontSize: 22 }}>⌨</span>
        <h1 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text)" }}>Typing Practice</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full font-mono"
          style={{ background: "rgba(124,110,243,.15)", color: "var(--accent2)", border: "1px solid rgba(124,110,243,.25)" }}>
          {timerLabel}
        </span>

        <Link href="/dashboard/typing/history" className="ty-hist-link">
          <span className="ty-hist-dot" aria-hidden="true" />
          <span className="ty-hist-icon" aria-hidden="true">📊</span>
          <span className="ty-hist-text">History</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5 text-[10px] sm:text-xs font-mono"
          style={{ color: "var(--text3)" }}>
          <kbd className="px-1.5 py-0.5 rounded"
            style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>Tab</kbd>
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
      <div className="flex flex-col gap-3 sm:gap-5 p-4 sm:p-6 rounded-2xl"
        style={{ background: "var(--surface)" }}>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-2">

          {/* Timer buttons */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {DEFAULT_TIMERS.map(t => (
              <button key={t} onClick={() => setSelectedTimer(t)}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium transition-all"
                style={{
                  background: selectedTimer === t ? "var(--accent)"  : "var(--surface2)",
                  color:      selectedTimer === t ? "#fff"            : "var(--text2)",
                  border:     selectedTimer === t ? "1px solid var(--accent)" : "1px solid var(--border2)",
                }}>
                {fmtDur(t)}
              </button>
            ))}

            {customTimers.map(ct => (
              <div key={ct._id} className="relative group flex items-center">
                <button onClick={() => setSelectedTimer(ct.duration)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium transition-all pr-5"
                  style={{
                    background: selectedTimer === ct.duration ? "var(--accent)"  : "var(--surface2)",
                    color:      selectedTimer === ct.duration ? "#fff"            : "var(--text2)",
                    border:     selectedTimer === ct.duration ? "1px solid var(--accent)" : "1px solid var(--border2)",
                  }}>
                  {fmtDur(ct.duration)}
                </button>
                <button onClick={() => setConfirmDel(ct)}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-xs w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--danger)" }}>×</button>
              </div>
            ))}

            {customTimers.length < 3 && (
              <button onClick={() => setShowAddTimer(!showAddTimer)}
                className="px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-mono font-medium"
                style={{ background: "transparent", color: "var(--text3)", border: "1px dashed var(--border2)" }}
                title="Add custom timer">+</button>
            )}

            {showAddTimer && (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                <input type="number" value={newTimerDur} onChange={e => setNewTimerDur(e.target.value)}
                  placeholder="sec" min={1} max={3600}
                  className="bg-transparent text-xs sm:text-sm w-14 outline-none font-mono"
                  style={{ color: "var(--text)" }}
                  onKeyDown={e => e.key === "Enter" && handleAddTimer()} />
                <button onClick={handleAddTimer} disabled={addingTimer}
                  className="text-xs font-medium disabled:opacity-50" style={{ color: "var(--accent)" }}>
                  {addingTimer ? "…" : "add"}
                </button>
                <button onClick={() => setShowAddTimer(false)} className="text-xs"
                  style={{ color: "var(--text3)" }}>×</button>
              </div>
            )}
          </div>

          {/* Mode buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {MODES.map(({ key, label, title }) => (
              <button key={key} onClick={() => setTypingMode(key)} title={title}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-medium transition-all"
                style={{
                  background: typingMode === key ? "rgba(124,110,243,.15)" : "transparent",
                  color:      typingMode === key ? "var(--accent2)"         : "var(--text3)",
                  border:     typingMode === key ? "1px solid rgba(124,110,243,.35)" : "1px solid transparent",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cursor Selector */}
        {cursorMounted && (
          <div className="cs-row">
            <span className="cs-label">Cursor</span>
            <div className="cs-pills">
              {CURSOR_STYLES.map(({ key, label, icon, title: ttip }) => (
                <button
                  key={key}
                  onClick={() => setCursorStyle(key)}
                  title={ttip}
                  aria-pressed={cursorStyle === key}
                  className={`cs-pill cs-pill--${key}${cursorStyle === key ? " cs-pill--active" : ""}`}
                >
                  <span className="cs-icon" aria-hidden="true">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timer row — countdown only, no live stats while typing */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-3xl sm:text-4xl font-bold tabular-nums"
            style={{
              color: testState === "running" && timeLeft <= 5
                ? "var(--danger)"
                : testState === "running"
                  ? "var(--accent2)"
                  : "var(--text3)",
            }}>
            {timeLeft}
          </span>

          {testState === "idle" && (
            <span className="text-xs sm:text-sm animate-pulse" style={{ color: "var(--text3)" }}>
              click the text and start typing
            </span>
          )}
          {/* Live wpm/chars removed — results shown only after test ends */}
        </div>

        {/* ── Typing area — no border, no focus ring ── */}
        <div
          ref={wrapperRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onClick={() => wrapperRef.current?.focus()}
          data-cursor={cursorStyle}
          className="relative outline-none select-none cursor-text rounded-xl"
          aria-label="Typing area — click and start typing"
          style={{ outline: "none" }}
        >
          <div
            ref={clipRef}
            className="overflow-hidden relative rounded-xl"
            style={{
              height: "calc(4 * 2.4 * clamp(16px, 1.6vw + 8px, 24px))",
              padding: "0.5em 0.5em",
            }}>

            {/* Top / bottom fade masks */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none z-10"
              style={{ height: "2em", background: "linear-gradient(to bottom, var(--surface), transparent)" }} />
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
              style={{ height: "2em", background: "linear-gradient(to top, var(--surface), transparent)" }} />

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

            {/* Memoised text renderer — never re-renders on keystrokes */}
            <TextDisplay
              ref={textDisplayRef}
              words={words}
              lineOffset={lineOffset}
              typedRef={typedRef}
              wordElsRef={wordElsRef}
              textBlockRef={textBlockRef}
            />
          </div>
        </div>

        {/* Restart hint */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={initTest}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all"
            style={{ color: "var(--text3)", background: "transparent", border: "1px solid transparent" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "var(--text2)"; el.style.background = "var(--surface2)";
              el.style.border = "1px solid var(--border2)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "var(--text3)"; el.style.background = "transparent";
              el.style.border = "1px solid transparent";
            }}>
            <span style={{ fontSize: 16 }}>↺</span> restart
          </button>
          <span className="text-[10px] sm:text-xs font-mono" style={{ color: "var(--text3)" }}>
            <kbd className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>Tab</kbd>
            {" "}quick restart
          </span>
        </div>
      </div>

      {/* ── Result modal ── */}
      {testState === "finished" && result && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,.82)", backdropFilter: "blur(6px)" }}>
          <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 flex flex-col gap-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>

            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--text3)" }}>
                {timerLabel} · {typingMode}
              </div>
              <h2 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text)" }}>
                Test Complete
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { label: "Effective WPM",  value: `${result.effectiveWpm}`, sub: "speed × accuracy²",       color: "var(--accent2)" },
                { label: "Accuracy",       value: `${result.accuracy}%`,    sub: `${result.totalKeystrokes} keystrokes`, color: "var(--green)"   },
                { label: "Raw WPM",        value: `${result.wpm}`,          sub: "before accuracy penalty",  color: "#38bdf8"        },
                { label: "Errors Made",    value: `${result.errors}`,       sub: "incl. corrected",          color: "var(--danger)"  },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-xl p-3 sm:p-4 text-center"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <div className="text-2xl sm:text-3xl font-bold font-mono" style={{ color }}>{value}</div>
                  <div className="text-[9px] sm:text-[10px] mt-1 uppercase tracking-widest font-semibold"
                    style={{ color: "var(--text3)" }}>{label}</div>
                  <div className="text-[9px] mt-0.5" style={{ color: "var(--text3)" }}>{sub}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {result.effectiveWpm > 0 && result.effectiveWpm >= s.highestWpm && s.highestWpm > 0 && (
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

            <div className="flex items-center justify-center">
              <Link href="/dashboard/typing/history"
                className="ty-hist-link text-[11px]"
                onClick={() => setResult(null)}>
                <span className="ty-hist-dot" aria-hidden="true" />
                <span className="ty-hist-icon" aria-hidden="true">📊</span>
                <span className="ty-hist-text">View full history &amp; analysis</span>
              </Link>
            </div>

            <button onClick={initTest}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: "var(--accent)", color: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = ".85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}>
              Next Test ↵
              <span className="ml-2 text-xs opacity-70 font-mono">or Tab / Enter</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Delete timer confirm ── */}
      {confirmDel && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)" }}>
          <div className="w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>
              Delete Custom Timer
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--text2)" }}>
              All history for the{" "}
              <span className="font-mono" style={{ color: "var(--text)" }}>{fmtDur(confirmDel.duration)}</span>{" "}
              timer will be <span style={{ color: "var(--danger)" }}>permanently deleted</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}>
                Cancel
              </button>
              <button onClick={handleDeleteTimer} disabled={deletingTimer}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={{ background: "rgba(248,113,113,.12)", color: "var(--danger)", border: "1px solid rgba(248,113,113,.3)" }}>
                {deletingTimer ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}