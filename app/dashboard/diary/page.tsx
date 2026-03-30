"use client";
// app/dashboard/diary/page.tsx
// FIXES:
// 1. Date shown twice — replaced dual responsive spans with single JS-based format
// 2. Dark mode — MutationObserver watches document.documentElement for .dark class
// 3. Wrong placeholder — differentiated between no-entry vs locked-empty vs editable
// 4. Search bar — cleaner layout, better UX, no layout shift
// 5. Nav cooldown — removed seconds display, cleaner disabled state
// 6. General UX — cleaned up cluttered toolbar, better status messages

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface DiaryEntry {
  _id?: string;
  entryDate: string;
  content: string;
  heading: string;
  textColor: string;
  mood: string | null;
  editCount: number;
  isLocked: boolean;
  deleteCount: number;
}
interface DiaryHeading { text: string; isDefault: boolean; }
interface SearchResult  { date: string; snippet: string; }

const MOODS = [
  { key: "happy",      emoji: "🙂", label: "Happy"      },
  { key: "neutral",    emoji: "😊", label: "Neutral"    },
  { key: "joy",        emoji: "😄", label: "Joyful"     },
  { key: "wink",       emoji: "😉", label: "Winky"      },
  { key: "productive", emoji: "🔥", label: "Productive" },
  { key: "tired",      emoji: "😴", label: "Tired"      },
  { key: "sad",        emoji: "😔", label: "Sad"        },
  { key: "grateful",   emoji: "🙏", label: "Grateful"   },
];

const INK_COLORS = [
  { hex: "#1c1410", label: "Ink Black"  },
  { hex: "#1d4ed8", label: "Royal Blue" },
  { hex: "#b91c1c", label: "Crimson"    },
  { hex: "#166534", label: "Forest"     },
  { hex: "#6d28d9", label: "Violet"     },
  { hex: "#92400e", label: "Sepia"      },
  { hex: "#4b5563", label: "Gray"       },
  { hex: "#0e7490", label: "Teal"       },
];

const MAX_CHARS       = 1500;
const MAX_DELETES     = 3;
const MAX_HEADINGS    = 5;
const NAV_COOLDOWN_MS = 4000;

// ─────────────────────────────────────────────────────────────
// DATE UTILS  —  all in UTC to avoid timezone drift
// ─────────────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}
function strToUTC(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function dateToStr(d: Date): string {
  return (
    d.getUTCFullYear() +
    "-" + String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" + String(d.getUTCDate()).padStart(2, "0")
  );
}
function isFuture(s: string): boolean {
  return strToUTC(s) > strToUTC(todayStr());
}
function addDays(s: string, n: number): string {
  const d = strToUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToStr(d);
}
function fmtFull(s: string): string {
  return strToUTC(s).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}
function fmtMed(s: string): string {
  return strToUTC(s).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
function fmtShort(s: string): string {
  return strToUTC(s).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ─────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────
const NC: RequestInit = {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache, no-store", Pragma: "no-cache" },
};

async function apiFetch(date: string): Promise<DiaryEntry | null> {
  try {
    const r = await fetch(`/api/diary/entry?date=${date}`, NC);
    if (!r.ok) return null;
    const { entry } = await r.json();
    return entry ?? null;
  } catch { return null; }
}
async function apiCreate(p: object): Promise<DiaryEntry | null> {
  try {
    const r = await fetch("/api/diary/entry", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
    });
    if (!r.ok) return null;
    return (await r.json()).entry ?? null;
  } catch { return null; }
}
async function apiPatch(p: object): Promise<DiaryEntry | null> {
  try {
    const r = await fetch("/api/diary/entry", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
    });
    if (!r.ok) return null;
    return (await r.json()).entry ?? null;
  } catch { return null; }
}
async function apiDeleteEntry(date: string) {
  try {
    const r = await fetch("/api/diary/entry", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }),
    });
    return await r.json();
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const NINETY_AGO = addDays(todayStr(), -90);

  // ── Core state ───────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<string>(todayStr);
  const [entry,       setEntry]       = useState<DiaryEntry | null>(null);
  const [heading,     setHeading]     = useState("");
  const [mood,        setMood]        = useState<string | null>(null);
  const [charCount,   setCharCount]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");

  // ── FIX #2: Dark mode detection via MutationObserver ─────────
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // ── FIX #1: Screen-width state for date format ────────────────
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setIsWide(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Refs ─────────────────────────────────────────────────────
  const editorRef      = useRef<HTMLDivElement>(null);
  const calRef         = useRef<HTMLDivElement>(null);
  const inkRef         = useRef<HTMLDivElement>(null);
  const searchBoxRef   = useRef<HTMLDivElement>(null);
  const cooldownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const epochRef       = useRef(0);
  const isDirtyRef     = useRef(false);
  const isNewEntryRef  = useRef(true);
  const lastSavedHtml  = useRef("");
  const headingsRef    = useRef<DiaryHeading[]>([]);

  // ── Animation state ──────────────────────────────────────────
  const [animClass,   setAnimClass]   = useState("");
  const [navCooldown, setNavCooldown] = useState(false);

  // ── Pages / meta ─────────────────────────────────────────────
  const [allDates,   setAllDates]   = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpInput,  setJumpInput]  = useState("");

  // ── Calendar ─────────────────────────────────────────────────
  const [showCal,  setShowCal]  = useState(false);
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // ── Headings ─────────────────────────────────────────────────
  const [headings,      setHeadings]     = useState<DiaryHeading[]>([]);
  const [showHPicker,   setShowHPicker]  = useState(false);
  const [showSettings,  setShowSettings] = useState(false);
  const [newHeadingText,setNewHText]     = useState("");

  // ── Search ───────────────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchState,   setSearchState]   = useState<"idle" | "searching" | "done">("idle");
  const [showSearch,    setShowSearch]    = useState(false);
  const [showMobSearch, setShowMobSearch] = useState(false);

  // ── Delete ───────────────────────────────────────────────────
  const [showDelConfirm,setShowDelConfirm]= useState(false);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [deleteMsg,     setDeleteMsg]     = useState("");

  // ── Ink ──────────────────────────────────────────────────────
  const [showInkPicker, setShowInkPicker] = useState(false);
  const [customInk,     setCustomInk]     = useState("#8b0000");

  // ── Derived ──────────────────────────────────────────────────
  const isLocked      = entry?.isLocked ?? false;
  const editsLeft     = 5 - (entry?.editCount ?? 0);
  const canEdit       = !isFuture(currentDate) && currentDate >= NINETY_AGO && !isLocked;
  const canGoNext     = !isFuture(addDays(currentDate, 1));
  const deleteCount   = entry?.deleteCount ?? 0;
  const deletesLeft   = MAX_DELETES - deleteCount;
  const canDeleteBase = !isFuture(currentDate) && currentDate >= NINETY_AGO;
  const canDelete     = canDeleteBase && !!entry &&
    !!(entry.content?.trim() || entry.heading?.trim() || entry.mood) &&
    deletesLeft > 0;
  const deleteMaxed   = deleteCount >= MAX_DELETES;

  const currentPageIndex = useMemo(() => {
    const i = allDates.indexOf(currentDate);
    return i === -1 ? allDates.length : i;
  }, [allDates, currentDate]);

  const displayTotal = Math.max(totalPages, allDates.length, currentPageIndex + 1);

  // ── Outside-click / Escape ────────────────────────────────────
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (calRef.current       && !calRef.current.contains(e.target as Node))       setShowCal(false);
      if (inkRef.current       && !inkRef.current.contains(e.target as Node))       setShowInkPicker(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSearch(false); setShowInkPicker(false);
        setShowMobSearch(false); setShowCal(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── Mount: meta + settings ────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [mr, sr] = await Promise.all([
        fetch("/api/diary/meta",     NC),
        fetch("/api/diary/settings", NC),
      ]);
      if (mr.ok) {
        const { dates, totalPages: tp } = await mr.json();
        setAllDates(dates ?? []);
        setTotalPages(tp ?? 0);
      }
      if (sr.ok) {
        const { settings } = await sr.json();
        const hs: DiaryHeading[] = settings?.headings ?? [];
        setHeadings(hs);
        headingsRef.current = hs;
        const def = hs.find((h: DiaryHeading) => h.isDefault);
        if (def) setHeading(prev => prev || def.text);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { headingsRef.current = headings; }, [headings]);

  // ── SAFETY NET: re-sync editor content after loading completes ──
  // Even though editor is always in DOM now, this catches any edge case
  // where React reconciliation might clear innerHTML on attribute change.
  useEffect(() => {
    if (!loading && editorRef.current) {
      const expected = entry?.content ?? "";
      if (editorRef.current.innerHTML !== expected) {
        editorRef.current.innerHTML = expected;
        setCharCount(editorRef.current.innerText.replace(/\n/g, "").length);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Fetch on date change ──────────────────────────────────────
  useEffect(() => {
    if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
    isDirtyRef.current = false;

    setLoading(true);
    setEntry(null);
    setMood(null);
    setCharCount(0);
    setDeleteMsg("");
    setShowCal(false);
    setShowHPicker(false);
    setShowDelConfirm(false);
    if (editorRef.current) editorRef.current.innerHTML = "";

    const myEpoch = ++epochRef.current;

    apiFetch(currentDate).then(fetched => {
      if (epochRef.current !== myEpoch) return;
      applyEntry(fetched);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // ── applyEntry ────────────────────────────────────────────────
  function applyEntry(e: DiaryEntry | null) {
    setEntry(e);
    setMood(e?.mood ?? null);
    if (e?.heading) {
      setHeading(e.heading);
    } else {
      const def = headingsRef.current.find(h => h.isDefault);
      setHeading(def?.text ?? "");
    }
    const html = e?.content ?? "";
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      setCharCount(editorRef.current.innerText.replace(/\n/g, "").length);
    }
    lastSavedHtml.current = html;
    isNewEntryRef.current = !e;
    isDirtyRef.current    = false;
  }

  // ── Save ──────────────────────────────────────────────────────
  const performSave = useCallback(async (date: string, isManual: boolean) => {
    if (!editorRef.current) return;
    const html    = editorRef.current.innerHTML;
    const hdg     = heading;
    const moodVal = mood;
    if ((!html.trim() && !moodVal && !hdg) || entry?.isLocked) return;
    if (!isManual && html === lastSavedHtml.current && !isNewEntryRef.current) return;

    setSaving(true);
    let saved: DiaryEntry | null = null;

    if (isNewEntryRef.current) {
      saved = await apiCreate({ date, content: html, heading: hdg, textColor: "black", mood: moodVal });
      if (saved) {
        isNewEntryRef.current = false;
        setAllDates(prev => prev.includes(date) ? prev : [...prev, date].sort());
        setTotalPages(p => p + 1);
      }
    } else {
      saved = await apiPatch({ date, content: html, heading: hdg, mood: moodVal, incrementEdit: isManual });
    }

    setSaving(false);
    if (saved) {
      setEntry(saved);
      lastSavedHtml.current = html;
      isDirtyRef.current    = false;
      if (isManual) { setSaveMsg("Saved ✓"); setTimeout(() => setSaveMsg(""), 2500); }
    }
  }, [heading, mood, entry]);

  function triggerAutoSave() {
    isDirtyRef.current = true;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => performSave(currentDate, false), 3500);
  }

  function handleManualSave() { performSave(currentDate, true); }

  // ── Editor ────────────────────────────────────────────────────
  function handleInput() {
    if (!editorRef.current) return;
    const len = editorRef.current.innerText.replace(/\n/g, "").length;
    if (len > MAX_CHARS) { document.execCommand("undo"); return; }
    setCharCount(len);
    triggerAutoSave();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const plain = e.clipboardData.getData("text/plain");
    if (!plain) return;
    const el      = editorRef.current!;
    const cur     = el.innerText.replace(/\n/g, "").length;
    const allowed = MAX_CHARS - cur;
    if (allowed <= 0) return;
    document.execCommand("insertText", false, plain.slice(0, allowed));
    setCharCount(el.innerText.replace(/\n/g, "").length);
    triggerAutoSave();
  }

  // ── Formatting ────────────────────────────────────────────────
  function fmt(cmd: string) { editorRef.current?.focus(); document.execCommand(cmd); }
  function applyInk(hex: string) {
    editorRef.current?.focus();
    document.execCommand("foreColor", false, hex);
    setShowInkPicker(false);
    triggerAutoSave();
  }

  // ── Cooldown ──────────────────────────────────────────────────
  function startCooldown() {
    setNavCooldown(true);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    // FIX #5: No more seconds countdown display — just a clean disabled state
    cooldownRef.current = setTimeout(() => {
      setNavCooldown(false);
    }, NAV_COOLDOWN_MS);
  }

  // ── Flush dirty before leaving ────────────────────────────────
  function flushDirty(date: string) {
    if (!isDirtyRef.current || isNewEntryRef.current) return;
    if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
    const html = editorRef.current?.innerHTML ?? "";
    if (html.trim() || mood || heading) {
      apiPatch({ date, content: html, heading, mood, incrementEdit: false });
    }
    isDirtyRef.current = false;
  }

  // ── Navigation ────────────────────────────────────────────────
  function navigateTo(target: string, dir?: "left" | "right") {
    if (target === currentDate || isFuture(target)) return;
    flushDirty(currentDate);

    if (dir) {
      startCooldown();
      setAnimClass(dir === "right" ? "flip-out-right" : "flip-out-left");
      setTimeout(() => {
        setCurrentDate(target);
        setAnimClass(dir === "right" ? "flip-in-right" : "flip-in-left");
        setTimeout(() => setAnimClass(""), 280);
      }, 250);
    } else {
      setCurrentDate(target);
    }
  }

  function goPrev() {
    if (navCooldown) return;
    const prev = addDays(currentDate, -1);
    if (prev >= NINETY_AGO) navigateTo(prev, "left");
  }

  function goNext() {
    if (navCooldown) return;
    const next = addDays(currentDate, 1);
    if (!isFuture(next)) navigateTo(next, "right");
  }

  function jumpTo() {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1 || n > allDates.length) return;
    const d = allDates[n - 1];
    if (d && !isFuture(d)) { navigateTo(d); setJumpInput(""); }
  }

  // ── Search ────────────────────────────────────────────────────
  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim() || q.length < 2) { setSearchResults([]); setSearchState("idle"); return; }
    setSearchState("searching");
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/diary/search?q=${encodeURIComponent(q)}`, NC);
        if (!res.ok) { setSearchState("done"); return; }
        const { results } = await res.json();
        setSearchResults((results ?? []).slice(0, 5));
        setSearchState("done");
      } catch { setSearchState("done"); }
    }, 400);
  }

  function clearSearch() {
    setSearchQuery(""); setSearchResults([]); setSearchState("idle");
    setShowSearch(false); setShowMobSearch(false);
  }

  // ── Headings ──────────────────────────────────────────────────
  async function persistHeadings(updated: DiaryHeading[]) {
    setHeadings(updated);
    headingsRef.current = updated;
    await fetch("/api/diary/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headings: updated }),
    });
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDeleteContent() {
    if (!canDelete || isDeleting) return;
    setIsDeleting(true);
    setShowDelConfirm(false);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    const result = await apiDeleteEntry(currentDate);
    setIsDeleting(false);
    if (!result) { setDeleteMsg("❌ Delete failed."); setTimeout(() => setDeleteMsg(""), 3000); return; }
    if ("error" in result && result.error) {
      setDeleteMsg(result.deleteCount >= MAX_DELETES
        ? "🚫 Delete limit reached."
        : `❌ ${result.error}`);
      setTimeout(() => setDeleteMsg(""), 4000);
      return;
    }
    applyEntry(result.entry as DiaryEntry);
    const left = result.deletesLeft as number;
    setDeleteMsg(`🗑️ Cleared! ${left} delete${left !== 1 ? "s" : ""} left.`);
    setTimeout(() => setDeleteMsg(""), 4000);
  }

  // ── Calendar rendering ────────────────────────────────────────
  function renderCal(): React.ReactElement[] {
    const today  = todayStr();
    const ninety = addDays(today, -90);
    const firstDOW    = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const cells: React.ReactElement[] = [];
    for (let i = 0; i < firstDOW; i++) cells.push(<div key={`_${i}`} />);

    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cur = ds === currentDate;
      const tod = ds === today;
      const dis = isFuture(ds) || ds < ninety;
      const has = allDates.includes(ds);

      cells.push(
        <button
          key={d}
          disabled={dis}
          onClick={() => { if (!dis) { navigateTo(ds); setShowCal(false); } }}
          style={cur
            ? { background: "var(--d-accent)", color: "#fff" }
            : tod && !cur
            ? { outline: "2px solid var(--d-accent)", outlineOffset: "1px" }
            : undefined}
          className={[
            "relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all select-none",
            dis ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
            !dis && !cur ? "hover:bg-[var(--d-hover)]" : "",
          ].join(" ")}
          aria-label={ds}
        >
          {d}
          {has && !cur && !dis && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
              style={{ background: "var(--d-accent)" }} />
          )}
        </button>
      );
    }
    return cells;
  }

  function calPrevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function calNextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  // ── Days-away label ───────────────────────────────────────────
  function daysAway(): string {
    const today = todayStr();
    if (currentDate === today) return "✦ Today";
    const diff = Math.round(
      (strToUTC(today).getTime() - strToUTC(currentDate).getTime()) / 86_400_000
    );
    return diff > 0 ? `${diff} day${diff !== 1 ? "s" : ""} ago` : "Future";
  }

  // ── FIX #3: Correct placeholder text ─────────────────────────
  function getPlaceholder(): string {
    if (canEdit) return "Write your thoughts for today…";
    if (entry) {
      if (isLocked) return "This entry is locked — no further edits allowed.";
      return "Nothing written for this date.";
    }
    return "No entry found for this date.";
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Kalam:wght@300;400;700&display=swap');

        /* ── CSS VARIABLES — light & dark via JS class ── */
        .diary-root {
          --d-bg:      #ede4d4;
          --d-page:    #faf3e4;
          --d-accent:  #8b5e3c;
          --d-accent2: #6b4a2e;
          --d-text:    #2c1a08;
          --d-text2:   #4a3520;
          --d-muted:   #a8896a;
          --d-border:  #d4b896;
          --d-border2: #c4a882;
          --d-panel:   #fdf5e6;
          --d-hover:   #eedabf;
          --d-line:    #e2cca8;
          --d-rule:    #ddc9a8;
          --d-stamp:   #eedfc0;
          --d-heading: #8b2500;
          --d-spine1:  #6b3d1e;
          --d-spine2:  #4a2810;
          --d-modal:   #fdf5e6;
          --d-shadow:  rgba(80,40,10,.18);
          --d-shadow2: rgba(80,40,10,.32);
        }

        /* FIX #2: Dark mode — toggled via isDark JS state → .diary-dark class */
        .diary-root.diary-dark {
          --d-bg:      #0d0804;
          --d-page:    #181008;
          --d-accent:  #c4895a;
          --d-accent2: #a06a40;
          --d-text:    #e8d5b0;
          --d-text2:   #c4a882;
          --d-muted:   #7a5a3a;
          --d-border:  #3a2510;
          --d-border2: #4a3020;
          --d-panel:   #1c1208;
          --d-hover:   #2a1a0e;
          --d-line:    #261808;
          --d-rule:    #2e1e0e;
          --d-stamp:   #2a1a0e;
          --d-heading: #d4845a;
          --d-spine1:  #5c3414;
          --d-spine2:  #3a2008;
          --d-modal:   #1a1008;
          --d-shadow:  rgba(0,0,0,.4);
          --d-shadow2: rgba(0,0,0,.65);
        }

        .diary-root { background: var(--d-bg); min-height: 100vh; transition: background .3s; }

        .d-book {
          background: var(--d-page);
          border-radius: 16px; overflow: hidden;
          box-shadow:
            0 0 0 1px var(--d-border2),
            5px 0 12px var(--d-shadow),
            0 20px 56px var(--d-shadow2),
            inset 0 1px 0 rgba(255,255,255,.1);
          transition: background .3s, box-shadow .3s;
        }

        .d-spine {
          background: linear-gradient(180deg, var(--d-spine1) 0%, var(--d-spine2) 40%, var(--d-spine1) 70%, var(--d-spine2) 100%);
          box-shadow: inset -2px 0 4px rgba(0,0,0,.22), inset 2px 0 2px rgba(255,255,255,.07);
          width: 20px; flex-shrink: 0;
        }
        @media(min-width:640px){ .d-spine { width: 26px; } }

        .d-strip {
          height: 9px;
          background: linear-gradient(90deg, var(--d-spine2) 0%, var(--d-spine1) 25%, var(--d-accent) 55%, var(--d-spine1) 100%);
        }

        .d-binding {
          width: 5px; flex-shrink: 0;
          background: linear-gradient(180deg, var(--d-border2) 0%, var(--d-rule) 50%, var(--d-border2) 100%);
        }

        .d-ruled {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px, var(--d-line) 29px, var(--d-line) 30px
          );
        }
        @media(max-width:480px){
          .d-ruled {
            background-image: repeating-linear-gradient(
              transparent 0px, transparent 24px, var(--d-line) 24px, var(--d-line) 25px
            );
          }
        }

        .d-editor {
          font-family: 'Kalam', cursive;
          font-size: 16px; font-weight: 400; line-height: 30px;
          color: var(--d-text); caret-color: var(--d-accent);
          outline: none; background: transparent;
          word-break: break-word; white-space: pre-wrap; letter-spacing: .01em;
          min-height: 360px; padding: 4px 4px 24px;
          width: 100%; box-sizing: border-box; transition: color .3s;
        }
        .d-editor:empty::before {
          content: attr(data-placeholder);
          color: var(--d-muted); font-style: italic; pointer-events: none;
        }
        @media(max-width:480px){ .d-editor { font-size: 14.5px; line-height: 25px; min-height: 300px; } }

        .d-panel { background: var(--d-panel); border: 1px solid var(--d-border2); transition: background .3s, border-color .3s; }
        .d-card  { background: var(--d-modal); border: 1px solid var(--d-border2); transition: background .3s, border-color .3s; }

        .d-input {
          background: var(--d-panel); border: 1px solid var(--d-border2);
          color: var(--d-text); transition: background .3s, border-color .3s, box-shadow .15s;
        }
        .d-input::placeholder { color: var(--d-muted); }
        .d-input:focus { outline: none; border-color: var(--d-accent); box-shadow: 0 0 0 3px rgba(139,94,60,.18); }

        .tbtn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--d-border2); background: var(--d-panel);
          color: var(--d-text2); font-size: 12px; cursor: pointer; flex-shrink: 0;
          transition: background .12s, border-color .12s; user-select: none;
        }
        .tbtn:hover  { background: var(--d-hover); border-color: var(--d-accent); }
        .tbtn:active { opacity: .7; }

        .d-btn {
          background: var(--d-accent); color: #fff; border: none;
          border-radius: 10px; font-weight: 700; cursor: pointer;
          transition: background .15s, transform .1s;
        }
        .d-btn:hover  { background: var(--d-accent2); }
        .d-btn:active { transform: scale(.97); }
        .d-btn:disabled { opacity: .4; cursor: not-allowed; }

        .d-nav {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 20px; border-radius: 12px;
          font-size: 13px; font-weight: 600;
          border: 1px solid var(--d-border2); background: var(--d-panel);
          color: var(--d-text2); cursor: pointer;
          transition: all .15s; user-select: none;
        }
        .d-nav:hover:not(:disabled)  { background: var(--d-hover); border-color: var(--d-accent); }
        .d-nav:active:not(:disabled) { transform: scale(.97); }
        .d-nav:disabled { opacity: .35; cursor: not-allowed; }
        @media(max-width:480px){ .d-nav { padding: 8px 14px; font-size: 12px; } }

        /* FIX #5: Cleaner flip animations — no cooldown seconds badge */
        .flip-out-right { animation: foR .25s ease forwards; transform-origin: left  center; }
        .flip-out-left  { animation: foL .25s ease forwards; transform-origin: right center; }
        .flip-in-right  { animation: fiR .28s ease forwards; transform-origin: left  center; }
        .flip-in-left   { animation: fiL .28s ease forwards; transform-origin: right center; }

        @keyframes foR { to { transform: perspective(1200px) rotateY(-10deg) scale(.98); opacity: .4; } }
        @keyframes foL { to { transform: perspective(1200px) rotateY( 10deg) scale(.98); opacity: .4; } }
        @keyframes fiR { from { transform: perspective(1200px) rotateY(-8deg) scale(.98); opacity: .4; } to { transform: none; opacity: 1; } }
        @keyframes fiL { from { transform: perspective(1200px) rotateY( 8deg) scale(.98); opacity: .4; } to { transform: none; opacity: 1; } }

        .d-result { padding: 10px 14px; border-bottom: 1px solid var(--d-rule); cursor: pointer; transition: background .1s; }
        .d-result:hover { background: var(--d-hover); }
        .d-result:last-child { border-bottom: none; }

        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }
        .d-dot { display:inline-block; width:7px; height:7px; border-radius:50%;
          background: var(--d-accent); animation: dotBounce 1.2s infinite; }
        .d-dot:nth-child(2){animation-delay:.18s}
        .d-dot:nth-child(3){animation-delay:.36s}

        .d-scroll::-webkit-scrollbar { width: 4px; }
        .d-scroll::-webkit-scrollbar-thumb { background: var(--d-border2); border-radius: 99px; }

        .d-overlay {
          position:fixed; inset:0; z-index:60;
          background: rgba(0,0,0,.55); backdrop-filter: blur(6px);
          display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .d-modal {
          background: var(--d-modal); border: 2px solid var(--d-border2);
          border-radius: 20px; padding: 26px 20px; max-width: 360px; width:100%;
          box-shadow: 0 20px 60px var(--d-shadow2);
        }

        .ink-pop {
          position:absolute; top:calc(100% + 8px); left:0; z-index:50;
          background: var(--d-panel); border: 1px solid var(--d-border2);
          border-radius: 16px; padding: 14px; width: 220px;
          box-shadow: 0 12px 40px var(--d-shadow2);
        }

        .d-serif  { font-family: 'Lora', Georgia, serif; font-style: italic; }
        .mood-sel { outline: 2.5px solid var(--d-accent); outline-offset: 2px; background: var(--d-stamp); }

        /* Nav cooldown — simple pulse instead of seconds badge */
        .nav-cooling { animation: navPulse 1s ease-in-out infinite; }
        @keyframes navPulse { 0%,100%{opacity:.35} 50%{opacity:.55} }
      `}</style>

      {/* FIX #2: Apply .diary-dark when isDark is true */}
      <div className={`diary-root${isDark ? " diary-dark" : ""}`}>
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-5 flex flex-col gap-3">

          {/* ───────── HEADINGS SETTINGS MODAL ───────── */}
          {showSettings && (
            <div className="d-overlay" onClick={() => setShowSettings(false)}>
              <div className="d-modal" onClick={e => e.stopPropagation()}>
                <h2 className="text-base font-bold mb-1 d-serif" style={{ color: "var(--d-text)" }}>📖 Diary Headings</h2>
                <p className="text-xs mb-3" style={{ color: "var(--d-muted)" }}>
                  Quick headings for every page.&nbsp;
                  <span style={{ color: headings.length >= MAX_HEADINGS ? "#ef4444" : "var(--d-accent)", fontWeight: 700 }}>
                    {headings.length}/{MAX_HEADINGS}
                  </span>
                </p>
                <div className="space-y-2 mb-3 max-h-44 overflow-y-auto d-scroll">
                  {headings.length === 0 && (
                    <p className="text-xs italic text-center py-3" style={{ color: "var(--d-muted)" }}>No headings yet</p>
                  )}
                  {headings.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{ background: "var(--d-hover)", border: "1px solid var(--d-border)" }}>
                      <span className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--d-text)" }}>{h.text}</span>
                      <button
                        onClick={() => persistHeadings(headings.map((hh, j) => ({ ...hh, isDefault: j === i })))}
                        className="text-xs px-2 py-0.5 rounded-full border font-medium transition-colors"
                        style={h.isDefault
                          ? { background: "var(--d-accent)", color: "#fff", borderColor: "var(--d-accent)" }
                          : { borderColor: "var(--d-border2)", color: "var(--d-muted)" }}>
                        {h.isDefault ? "✓ Default" : "Set"}
                      </button>
                      <button onClick={() => persistHeadings(headings.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 text-sm transition-colors">✕</button>
                    </div>
                  ))}
                </div>
                {headings.length >= MAX_HEADINGS ? (
                  <div className="mb-4 py-2.5 px-3 rounded-xl text-center"
                    style={{ background: "var(--d-hover)", border: "1px solid var(--d-border)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--d-accent)" }}>
                      Max {MAX_HEADINGS} headings — remove one first
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-4">
                    <input value={newHeadingText}
                      onChange={e => setNewHText(e.target.value.slice(0, 50))}
                      placeholder="e.g. JAY MATAJI…" maxLength={50}
                      className="d-input flex-1 text-sm rounded-xl px-3 py-2"
                      onKeyDown={e => {
                        if (e.key === "Enter" && newHeadingText.trim()) {
                          persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                          setNewHText("");
                        }
                      }} />
                    <button
                      onClick={() => {
                        if (!newHeadingText.trim()) return;
                        persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                        setNewHText("");
                      }}
                      className="d-btn text-sm px-3 py-2 rounded-xl">Add</button>
                  </div>
                )}
                <button onClick={() => setShowSettings(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: "var(--d-hover)", color: "var(--d-text2)", border: "1px solid var(--d-border2)" }}>
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ───────── DELETE CONFIRM MODAL ───────── */}
          {showDelConfirm && (
            <div className="d-overlay" onClick={() => setShowDelConfirm(false)}>
              <div className="d-modal" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-5">
                  <div className="text-4xl mb-3">🗑️</div>
                  <h2 className="text-base font-bold mb-2 d-serif" style={{ color: "var(--d-text)" }}>Delete Page Content?</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--d-text2)" }}>
                    This will <strong>permanently erase</strong> all text, heading &amp; mood on this page.
                  </p>
                  <div className="mt-3 px-3 py-2 rounded-xl"
                    style={{ background: "var(--d-stamp)", border: "1px solid var(--d-border2)" }}>
                    <p className="text-xs font-bold" style={{ color: "var(--d-accent)" }}>
                      ⚠️ {deleteCount}/{MAX_DELETES} deletes used — {fmtShort(currentDate)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowDelConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: "var(--d-hover)", color: "var(--d-text2)", border: "1px solid var(--d-border2)" }}>
                    Cancel
                  </button>
                  <button onClick={handleDeleteContent} disabled={isDeleting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors"
                    style={{ background: "#dc2626" }}>
                    {isDeleting ? "Deleting…" : `Delete (${deletesLeft} left)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ───────── TOP BAR ───────── */}
          {/* FIX #4: Cleaner search bar — full width, well-aligned */}
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold shrink-0 d-serif" style={{ color: "var(--d-text)" }}>
              <span>📔</span>
              <span className="hidden sm:inline">Diary</span>
            </h1>

            {/* Desktop search — properly contained, no overflow */}
            {isWide && (
            <div className="relative flex-1" ref={searchBoxRef}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                style={{ color: "var(--d-muted)" }}>🔍</span>
              <input
                value={searchQuery}
                onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => { if (searchQuery.length >= 2) setShowSearch(true); }}
                placeholder="Search entries…"
                className="d-input w-full text-sm rounded-2xl py-2"
                style={{ paddingLeft: 36, paddingRight: 36 }}
              />
              {searchQuery && (
                <button onClick={clearSearch}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--d-accent)", color: "#fff", fontSize: 10,
                    border: "none", cursor: "pointer", opacity: 0.9,
                  }}>✕</button>
              )}
              {showSearch && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-40 d-card rounded-2xl shadow-xl overflow-hidden">
                  {searchState === "searching" && (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                        style={{ borderColor: "var(--d-accent)", borderTopColor: "transparent" }} />
                      <span className="text-xs" style={{ color: "var(--d-muted)" }}>Searching…</span>
                    </div>
                  )}
                  {searchState === "done" && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs italic" style={{ color: "var(--d-muted)" }}>No results for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div key={i} className="d-result" onClick={() => { navigateTo(r.date); clearSearch(); }}>
                      <div className="text-xs font-bold" style={{ color: "var(--d-accent)" }}>{fmtShort(r.date)}</div>
                      <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--d-text2)" }}>{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Mobile search toggle — only on narrow screens */}
            {!isWide && (
            <button className="tbtn !w-9 !h-9 !rounded-xl text-base"
              onClick={() => setShowMobSearch(v => !v)} aria-label="Search">🔍</button>
            )}

            <button onClick={() => setShowSettings(true)}
              className="d-panel flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors hover:opacity-80 whitespace-nowrap shrink-0"
              style={{ color: "var(--d-text2)" }}>
              ⚙ <span className="hidden sm:inline">Headings</span>
            </button>
          </div>

          {/* Mobile search dropdown — only show when !isWide AND toggled */}
          {showMobSearch && !isWide && (
            <div ref={searchBoxRef}>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm pointer-events-none" style={{ color: "var(--d-muted)" }}>🔍</span>
                <input autoFocus value={searchQuery}
                  onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                  placeholder="Search diary entries…"
                  className="d-input w-full text-sm rounded-2xl py-2.5"
                  style={{ paddingLeft: 36, paddingRight: 36 }} />
                {searchQuery && (
                  <button onClick={clearSearch}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--d-accent)", color: "#fff", fontSize: 10,
                      border: "none", cursor: "pointer",
                    }}>✕</button>
                )}
              </div>
              {showSearch && searchQuery.length >= 2 && (
                <div className="mt-1 d-card rounded-2xl shadow-xl overflow-hidden">
                  {searchState === "done" && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs italic" style={{ color: "var(--d-muted)" }}>No results</p>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div key={i} className="d-result" onClick={() => { navigateTo(r.date); clearSearch(); }}>
                      <div className="text-xs font-bold" style={{ color: "var(--d-accent)" }}>{fmtShort(r.date)}</div>
                      <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--d-text2)" }}>{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───────── CALENDAR + NAV BAR ───────── */}
          <div className="d-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 sm:px-4 py-2.5">
            <div className="relative" ref={calRef}>
              <button onClick={() => setShowCal(v => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--d-text)" }}>
                📅
                {/* FIX #1: Single date format chosen by JS — no duplicate rendering */}
                <span className="text-xs font-mono" style={{ color: "var(--d-text2)" }}>
                  {isWide ? fmtMed(currentDate) : fmtShort(currentDate)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--d-muted)" }}>{showCal ? "▴" : "▾"}</span>
              </button>

              {showCal && (
                <div className="absolute top-full left-0 mt-2 z-40 d-card rounded-2xl shadow-xl p-3"
                  style={{ minWidth: 252 }}>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={calPrevMonth}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-60 text-lg"
                      style={{ color: "var(--d-accent)" }}>‹</button>
                    <span className="text-xs font-bold" style={{ color: "var(--d-text)" }}>
                      {new Date(calYear, calMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={calNextMonth}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-60 text-lg"
                      style={{ color: "var(--d-accent)" }}>›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((l, i) => (
                      <div key={i} className="flex items-center justify-center h-7 text-[10px] font-bold"
                        style={{ color: "var(--d-muted)" }}>{l}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5" style={{ color: "var(--d-text2)" }}>
                    {renderCal()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {currentDate !== todayStr() && (
              <button onClick={() => navigateTo(todayStr())}
                className="d-btn text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                ✦ Today
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: "var(--d-muted)" }}>
                <strong style={{ color: "var(--d-text2)" }}>{currentPageIndex + 1}</strong>
                {" / "}
                <strong style={{ color: "var(--d-text2)" }}>{displayTotal}</strong>
              </span>
              <input type="number" value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && jumpTo()}
                placeholder="Go" min={1} max={allDates.length}
                className="d-input w-14 text-xs text-center rounded-xl px-2 py-1.5" />
              <button onClick={jumpTo} className="d-btn text-xs font-bold px-2.5 py-1.5 rounded-xl">→</button>
            </div>
          </div>

          {/* ───────── DIARY BOOK ───────── */}
          <div className={`d-book relative ${animClass}`}>
            <div className="d-strip" />
            <div className="flex">

              {/* Spine */}
              <div className="d-spine flex flex-col items-center justify-around py-4 sm:py-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-full"
                    style={{ width: 7, height: 7, background: "rgba(0,0,0,.45)", border: "1px solid rgba(0,0,0,.22)" }} />
                ))}
              </div>

              {/* Main page */}
              <div className="flex-1 px-3 sm:px-5 pt-3 pb-4 min-w-0">

                {/* ── Page header ── */}
                <div className="flex items-start justify-between gap-2 mb-3 pb-2.5"
                  style={{ borderBottom: "1px solid var(--d-rule)" }}>

                  {/* Heading picker */}
                  <div className="relative flex-1 min-w-0">
                    {canEdit ? (
                      <button onClick={() => setShowHPicker(v => !v)}
                        className="text-left w-full d-serif text-sm sm:text-base lg:text-lg font-bold transition-opacity hover:opacity-75 block"
                        style={{ color: heading ? "var(--d-heading)" : "var(--d-muted)" }}>
                        <span className="block truncate">{heading || "Add heading…"}</span>
                        <span className="ml-1 text-xs not-italic font-normal" style={{ color: "var(--d-muted)" }}>▾</span>
                      </button>
                    ) : heading ? (
                      <p className="text-sm sm:text-base lg:text-lg font-bold d-serif truncate"
                        style={{ color: "var(--d-heading)" }}>{heading}</p>
                    ) : null}

                    {showHPicker && canEdit && (
                      <div className="absolute top-full left-0 mt-1 z-30 d-card rounded-2xl shadow-xl py-1 w-56 max-h-48 overflow-y-auto d-scroll">
                        <button onClick={() => { setHeading(""); setShowHPicker(false); }}
                          className="w-full text-left px-4 py-2 text-xs italic transition-opacity hover:opacity-70"
                          style={{ color: "var(--d-muted)" }}>— No heading —</button>
                        {headings.length === 0 && (
                          <p className="px-4 py-2 text-xs" style={{ color: "var(--d-muted)" }}>
                            Add headings via ⚙ settings
                          </p>
                        )}
                        {headings.map((h, i) => (
                          <button key={i}
                            onClick={() => { setHeading(h.text); setShowHPicker(false); triggerAutoSave(); }}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold d-serif transition-opacity hover:opacity-75"
                            style={{
                              color: "var(--d-heading)",
                              background: heading === h.text ? "var(--d-hover)" : "transparent",
                            }}>
                            {h.text}
                            {h.isDefault && (
                              <span className="ml-2 text-[10px] not-italic font-normal" style={{ color: "var(--d-muted)" }}>
                                default
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Date stamp — FIX #1 & #5: SINGLE date, no duplication ── */}
                  <div className="text-right shrink-0 ml-2">
                    <div className="inline-block px-2.5 py-1.5 rounded-xl leading-tight"
                      style={{ background: "var(--d-stamp)", border: "1px solid var(--d-border2)", color: "var(--d-accent2)" }}>
                      <span className="text-xs font-semibold">
                        {isWide ? fmtFull(currentDate) : fmtMed(currentDate)}
                      </span>
                    </div>
                    {isLocked && <p className="text-xs font-bold mt-1 text-red-500">🔒 Locked</p>}
                    {!isLocked && entry && (
                      <p className="text-[10px] sm:text-xs mt-1" style={{ color: "var(--d-muted)" }}>
                        {editsLeft} edit{editsLeft !== 1 ? "s" : ""} left
                      </p>
                    )}
                    {entry && deleteCount > 0 && (
                      <p className={`text-[10px] sm:text-xs font-bold mt-1 ${deleteMaxed ? "text-red-500" : ""}`}
                        style={!deleteMaxed ? { color: "var(--d-accent)" } : {}}>
                        {deleteMaxed ? "🚫 No deletes" : `🗑️ ${deletesLeft} del left`}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Toolbar ── */}
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1 mb-2 pb-2"
                    style={{ borderBottom: "1px solid var(--d-rule)" }}
                    onMouseDown={e => e.preventDefault()}>

                    <button className="tbtn font-bold"  title="Bold"      onClick={() => fmt("bold")}>B</button>
                    <button className="tbtn italic"     title="Italic"    onClick={() => fmt("italic")}>I</button>
                    <button className="tbtn underline"  title="Underline" onClick={() => fmt("underline")}>U</button>

                    <div className="w-px h-5 mx-0.5" style={{ background: "var(--d-border2)" }} />

                    <button className="tbtn" title="Left"   onClick={() => fmt("justifyLeft")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0"   width="13" height="1.5" rx=".75"/>
                        <rect x="0" y="3.5" width="9"  height="1.5" rx=".75"/>
                        <rect x="0" y="7"   width="11" height="1.5" rx=".75"/>
                        <rect x="0" y="10"  width="7"  height="1"   rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Center" onClick={() => fmt("justifyCenter")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0"   width="13" height="1.5" rx=".75"/>
                        <rect x="2" y="3.5" width="9"  height="1.5" rx=".75"/>
                        <rect x="1" y="7"   width="11" height="1.5" rx=".75"/>
                        <rect x="3" y="10"  width="7"  height="1"   rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Right"  onClick={() => fmt("justifyRight")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0"   width="13" height="1.5" rx=".75"/>
                        <rect x="4" y="3.5" width="9"  height="1.5" rx=".75"/>
                        <rect x="2" y="7"   width="11" height="1.5" rx=".75"/>
                        <rect x="6" y="10"  width="7"  height="1"   rx=".5"/>
                      </svg>
                    </button>

                    <div className="w-px h-5 mx-0.5" style={{ background: "var(--d-border2)" }} />

                    {/* Ink picker */}
                    <div className="relative" ref={inkRef}>
                      <button className="tbtn !w-auto px-2 gap-1.5 text-[11px] font-medium"
                        title="Ink color" onClick={() => setShowInkPicker(v => !v)}>
                        <span style={{
                          display: "inline-block", width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                          background: "linear-gradient(135deg,#b91c1c,#1d4ed8,#166534)",
                          border: "1px solid var(--d-border2)",
                        }} />
                        <span className="hidden sm:inline">Ink</span>
                        <span className="text-[9px]" style={{ color: "var(--d-muted)" }}>▾</span>
                      </button>

                      {showInkPicker && (
                        <div className="ink-pop" onMouseDown={e => e.preventDefault()}>
                          <p className="text-[9px] font-bold mb-2 uppercase tracking-widest"
                            style={{ color: "var(--d-muted)" }}>Select text then tap colour</p>
                          <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {INK_COLORS.map(c => (
                              <button key={c.hex} title={c.label} onClick={() => applyInk(c.hex)}
                                className="group flex flex-col items-center gap-1 p-1 rounded-xl transition-opacity hover:opacity-80">
                                <span className="w-6 h-6 rounded-full border-2 border-white shadow-sm block transition-transform group-hover:scale-110"
                                  style={{ background: c.hex }} />
                                <span className="text-[8px] text-center leading-none" style={{ color: "var(--d-muted)" }}>{c.label}</span>
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid var(--d-rule)" }}>
                            <label className="text-[9px] shrink-0 font-medium" style={{ color: "var(--d-muted)" }}>Custom:</label>
                            <input type="color" value={customInk}
                              onChange={e => setCustomInk(e.target.value)}
                              className="w-7 h-7 rounded-lg cursor-pointer p-0.5"
                              style={{ border: "1px solid var(--d-border2)", background: "transparent" }} />
                            <button onClick={() => applyInk(customInk)}
                              className="d-btn flex-1 py-1 rounded-xl text-[10px] font-bold">Apply</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1" />
                    <span className={`text-[11px] tabular-nums font-medium ${charCount > MAX_CHARS * 0.9 ? "text-amber-500" : ""}`}
                      style={charCount <= MAX_CHARS * 0.9 ? { color: "var(--d-muted)" } : {}}>
                      {charCount}/{MAX_CHARS}
                    </span>
                  </div>
                )}

                {/* ── Writing area ── */}
                {/*
                  ROOT CAUSE FIX:
                  Previously, the editor was inside a conditional: loading ? <spinner> : <editor>
                  This UNMOUNTED the editor div when loading=true, making editorRef.current = null.
                  So applyEntry's `editorRef.current.innerHTML = html` was a silent no-op.
                  Fix: ALWAYS keep editor in DOM. Loading spinner is an absolute overlay on top.
                  Now editorRef.current is always valid when applyEntry runs.
                */}
                <div className="relative d-ruled" style={{ minHeight: 340 }}>
                  {/* Loading overlay — sits on top, editor stays mounted underneath */}
                  {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
                      style={{ background: "var(--d-page)", borderRadius: 4 }}>
                      <div className="flex gap-2">
                        <span className="d-dot" />
                        <span className="d-dot" />
                        <span className="d-dot" />
                      </div>
                      <p className="text-xs font-medium" style={{ color: "var(--d-muted)", fontFamily: "'Kalam',cursive" }}>
                        Opening page…
                      </p>
                    </div>
                  )}
                  {/* Editor always in DOM — ref is always valid */}
                  <div
                    ref={editorRef}
                    contentEditable={canEdit && !loading}
                    suppressContentEditableWarning
                    className="d-editor"
                    data-placeholder={getPlaceholder()}
                    onInput={handleInput}
                    onPaste={handlePaste}
                  />
                </div>

                {/* ── Mood ── */}
                <div className="mt-3 pt-2.5" style={{ borderTop: "1px solid var(--d-rule)" }}>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold mr-1 select-none" style={{ color: "var(--d-muted)" }}>Mood:</span>
                    {MOODS.map(m => (
                      <div key={m.key} className="relative group">
                        <button
                          disabled={!canEdit}
                          onClick={() => { setMood(mood === m.key ? null : m.key); triggerAutoSave(); }}
                          className={[
                            "w-8 h-8 text-lg rounded-full flex items-center justify-center transition-all select-none",
                            mood === m.key ? "mood-sel scale-110 shadow" : "",
                            canEdit ? "hover:scale-105 cursor-pointer" : "opacity-50 cursor-default",
                          ].join(" ")}>
                          {m.emoji}
                        </button>
                        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 hidden sm:block"
                          style={{ background: "var(--d-text)" }}>{m.label}</span>
                      </div>
                    ))}
                    {mood && (
                      <span className="ml-1 text-xs font-bold" style={{ color: "var(--d-text2)" }}>
                        {MOODS.find(m => m.key === mood)?.emoji}{" "}
                        <span className="hidden sm:inline">{MOODS.find(m => m.key === mood)?.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Bottom action bar ── */}
                <div className="mt-3 pt-2.5 flex items-center justify-between gap-2 flex-wrap"
                  style={{ borderTop: "1px solid var(--d-rule)" }}>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs truncate" style={{ color: "var(--d-muted)" }}>
                      {isLocked
                        ? "🔒 Locked — no more edits"
                        : entry ? `Manual saves: ${entry.editCount} / 5` : "New page"}
                    </span>
                    {deleteMsg && (
                      <span className={`text-xs font-semibold ${deleteMsg.startsWith("🚫") || deleteMsg.startsWith("❌") ? "text-red-500" : ""}`}
                        style={!deleteMsg.startsWith("🚫") && !deleteMsg.startsWith("❌")
                          ? { color: "var(--d-accent)" } : {}}>
                        {deleteMsg}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                    <span className={`text-xs font-medium min-w-[52px] text-right transition-opacity ${saveMsg || saving ? "opacity-100" : "opacity-0"}`}
                      style={{ color: saving ? "var(--d-accent)" : "#22c55e" }}>
                      {saving ? "Saving…" : saveMsg}
                    </span>

                    {canDeleteBase && entry && (
                      deleteMaxed ? (
                        <button disabled
                          className="flex items-center gap-1 opacity-30 cursor-not-allowed text-xs font-semibold px-3 py-1.5 rounded-xl"
                          style={{ border: "1px solid var(--d-border2)", color: "var(--d-text2)" }}>
                          🚫 <span className="hidden sm:inline">No Deletes</span>
                        </button>
                      ) : (
                        <button onClick={() => setShowDelConfirm(true)}
                          disabled={isDeleting || !canDelete}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ border: "1px solid #fca5a5", color: "#dc2626", background: "rgba(220,38,38,.08)" }}>
                          🗑️
                          <span className="hidden sm:inline">Delete</span>
                          <span className="px-1.5 py-0.5 text-[9px] rounded-full font-bold"
                            style={{ background: "rgba(220,38,38,.12)", color: "#dc2626" }}>
                            {deletesLeft}/{MAX_DELETES}
                          </span>
                        </button>
                      )
                    )}

                    {canEdit && (
                      <button onClick={handleManualSave} disabled={saving || isLocked}
                        className="d-btn flex items-center gap-1 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl">
                        💾 Save
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Right binding */}
              <div className="d-binding" />
            </div>
            <div className="d-strip" />
          </div>

          {/* ───────── NAVIGATION ───────── */}
          {/* FIX #5: No seconds countdown — just clean disabled state with subtle pulse */}
          <div className="flex items-center justify-between gap-2">
            <button onClick={goPrev}
              disabled={navCooldown || currentDate <= NINETY_AGO}
              className={`d-nav${navCooldown ? " nav-cooling" : ""}`}>
              ◀ <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="text-center text-xs flex-1">
              <span style={{ color: currentDate === todayStr() ? "var(--d-accent)" : "var(--d-muted)", fontWeight: 600 }}>
                {daysAway()}
              </span>
            </div>

            <button onClick={goNext}
              disabled={navCooldown || !canGoNext}
              className={`d-nav${navCooldown ? " nav-cooling" : ""}`}>
              <span className="hidden sm:inline">Next</span> ▶
            </button>
          </div>

        </div>
      </div>
    </>
  );
}