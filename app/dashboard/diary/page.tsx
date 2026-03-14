"use client";
// app/dashboard/diary/page.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
interface SearchResult { date: string; snippet: string; }

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
  { hex: "#1c1410", label: "Ink Black"    },
  { hex: "#1d4ed8", label: "Royal Blue"   },
  { hex: "#b91c1c", label: "Crimson"      },
  { hex: "#166534", label: "Forest Green" },
  { hex: "#6d28d9", label: "Violet"       },
  { hex: "#92400e", label: "Sepia"        },
  { hex: "#4b5563", label: "Storm Gray"   },
  { hex: "#0e7490", label: "Teal"         },
];

const MAX_CHARS       = 1500;
const MAX_DELETES     = 3;
const MAX_HEADINGS    = 5;
const NAV_COOLDOWN_MS = 5000;

// ─────────────────────────────────────────────────────────────
// DATE UTILS
// ─────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dateToStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}
function strToDate(s: string) { return new Date(s + "T00:00:00.000Z"); }
function isFuture(s: string)  { return strToDate(s) > strToDate(todayStr()); }
function addDays(s: string, n: number) {
  const d = strToDate(s); d.setUTCDate(d.getUTCDate() + n); return dateToStr(d);
}
function fmtLong(s: string) {
  return strToDate(s).toLocaleDateString("en-IN", {
    weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:"UTC",
  });
}
function fmtShort(s: string) {
  return strToDate(s).toLocaleDateString("en-IN", {
    day:"2-digit", month:"short", year:"numeric", timeZone:"UTC",
  });
}

// ─────────────────────────────────────────────────────────────
// API HELPERS  (no module-level cache — see component cache below)
// ─────────────────────────────────────────────────────────────
async function apiFetch(date: string): Promise<DiaryEntry | null> {
  const r = await fetch(`/api/diary/entry?date=${date}`, { cache: "no-store" });
  if (!r.ok) return null;
  const { entry } = await r.json();
  return entry ?? null;
}
async function apiRange(s: string, e: string): Promise<DiaryEntry[]> {
  const r = await fetch(`/api/diary/range?startDate=${s}&endDate=${e}`, { cache: "no-store" });
  if (!r.ok) return [];
  const { entries } = await r.json();
  return entries ?? [];
}
async function apiCreate(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(p),
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}
async function apiPatch(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(p),
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}
async function apiDelete(date: string) {
  const r = await fetch("/api/diary/entry", {
    method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ date }),
  });
  const data = await r.json();
  if (!r.ok) return data;
  return data;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DiaryPage() {
  // TODAY is computed fresh on every call so midnight-crossings are handled.
  const getTODAY    = () => todayStr();
  const NINETY_AGO  = addDays(getTODAY(), -90);

  // Core
  const [currentDate, setCurrentDate]   = useState(getTODAY);
  const [entry, setEntry]               = useState<DiaryEntry | null>(null);
  const [heading, setHeading]           = useState("");
  const [mood, setMood]                 = useState<string | null>(null);
  const [charCount, setCharCount]       = useState(0);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState("");

  // Dirty tracking
  const isDirtyRef    = useRef(false);
  const isNewEntryRef = useRef(true);
  const lastSavedHtml = useRef("");

  // Headings ref — keeps loadPage from having a stale closure
  const headingsRef = useRef<DiaryHeading[]>([]);

  // ─────────────────────────────────────────────────────────────
  // COMPONENT-LEVEL CACHE
  // Lives inside the component (useRef) so it resets on every fresh
  // mount and never leaks between page visits.
  //
  // RULE: TODAY is NEVER stored in this cache.
  //   – apiGetCached checks: if date === todayStr() → bypass cache, always fetch.
  //   – After any save/patch/delete we also evict the date from cache.
  // ─────────────────────────────────────────────────────────────
  const cacheRef = useRef<Map<string, DiaryEntry | null>>(new Map());

  const cacheGet = useCallback((date: string) => {
    if (date === todayStr()) return undefined; // always miss for today
    return cacheRef.current.has(date) ? cacheRef.current.get(date) : undefined;
  }, []);

  const cacheSet = useCallback((date: string, val: DiaryEntry | null) => {
    if (date === todayStr()) return; // never cache today
    cacheRef.current.set(date, val);
  }, []);

  const cacheDel = useCallback((date: string) => {
    cacheRef.current.delete(date);
  }, []);

  // Fetch with cache — today always bypasses
  const apiGetCached = useCallback(async (date: string): Promise<DiaryEntry | null> => {
    const cached = cacheGet(date);
    if (cached !== undefined) return cached; // undefined = cache miss
    const result = await apiFetch(date);
    cacheSet(date, result);
    return result;
  }, [cacheGet, cacheSet]);

  // Navigation
  const [navCooldown, setNavCooldown] = useState(false);
  const [navSecs, setNavSecs]         = useState(0);
  const [isFlipping, setIsFlipping]   = useState(false);
  const [flipDir, setFlipDir]         = useState<"left"|"right"|null>(null);

  // Pages / meta
  const [allDates, setAllDates]     = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpInput, setJumpInput]   = useState("");

  // Calendar
  const [showCal, setShowCal] = useState(false);
  const [calView, setCalView] = useState({
    year: new Date().getFullYear(), month: new Date().getMonth(),
  });

  // Headings
  const [headings, setHeadings]              = useState<DiaryHeading[]>([]);
  const [showHeadingPicker, setShowHPicker]  = useState(false);
  const [showSettingsModal, setShowSettings] = useState(false);
  const [newHeadingText, setNewHText]        = useState("");

  // Search
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState]     = useState<"idle"|"searching"|"done">("idle");
  const [showSearch, setShowSearch]       = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const searchBoxRef   = useRef<HTMLDivElement>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting]               = useState(false);
  const [deleteMsg, setDeleteMsg]                 = useState("");

  // Ink popover
  const [showInkPicker, setShowInkPicker] = useState(false);
  const [customInk, setCustomInk]         = useState("#8b0000");
  const inkRef = useRef<HTMLDivElement>(null);

  // Refs
  const editorRef   = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const calRef      = useRef<HTMLDivElement>(null);

  // Derived
  const isLocked      = entry?.isLocked ?? false;
  const editsLeft     = 5 - (entry?.editCount ?? 0);
  const canEdit       = !isFuture(currentDate) && currentDate >= NINETY_AGO && !isLocked;
  const canGoNext     = !isFuture(addDays(currentDate, 1));
  const deleteCount   = entry?.deleteCount ?? 0;
  const deletesLeft   = MAX_DELETES - deleteCount;
  const canDeleteBase = !isFuture(currentDate) && currentDate >= NINETY_AGO;
  const canDelete     = canDeleteBase && !!entry && !!(entry.content?.trim() || entry.heading?.trim() || entry.mood) && deletesLeft > 0;
  const deleteMaxed   = deleteCount >= MAX_DELETES;

  const currentPageIndex = useMemo(() => {
    const i = allDates.indexOf(currentDate);
    return i === -1 ? allDates.length : i;
  }, [allDates, currentDate]);

  // ── Outside-click handlers ───────────────────────────────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
      if (inkRef.current && !inkRef.current.contains(e.target as Node)) setShowInkPicker(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSearch(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setShowSearch(false); setShowInkPicker(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Mount: load meta + settings ──────────────────────────────
  useEffect(() => {
    (async () => {
      const TODAY = getTODAY();
      const [mr, sr] = await Promise.all([
        fetch("/api/diary/meta", { cache: "no-store" }),
        fetch("/api/diary/settings", { cache: "no-store" }),
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
        if (def) setHeading(def.text);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { headingsRef.current = headings; }, [headings]);

  // ── Core: load page whenever currentDate changes ──────────────
  useEffect(() => {
    loadPage(currentDate);
    prefetch(currentDate);
    setShowCal(false);
    setShowHPicker(false);
    setShowDeleteConfirm(false);
    setDeleteMsg("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // loadPage — always fetches today fresh, uses cache for other dates
  async function loadPage(date: string) {
    setLoading(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);

    const e = await apiGetCached(date);
    applyEntry(e);
    setLoading(false);
  }

  // applyEntry — sets all UI state from a DiaryEntry (or null = blank page)
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

  // prefetch — fills cache for surrounding dates (never today)
  async function prefetch(date: string) {
    const toFetch: string[] = [];
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const d = addDays(date, i);
      if (!isFuture(d) && d >= NINETY_AGO && cacheGet(d) === undefined) {
        toFetch.push(d);
      }
    }
    if (!toFetch.length) return;
    toFetch.sort();
    const entries = await apiRange(toFetch[0], toFetch[toFetch.length - 1]);
    for (const d of toFetch) {
      if (cacheGet(d) === undefined) { // still a miss (not filled by concurrent call)
        const found = entries.find(e => dateToStr(new Date(e.entryDate)) === d) ?? null;
        cacheSet(d, found);
      }
    }
  }

  // ── Force-reload current page (used by navigateTo same-date) ──
  function reloadCurrentPage() {
    cacheDel(currentDate); // evict if it was cached (won't matter for today, but safe)
    loadPage(currentDate);
  }

  // ─────────────────────────────────────────────────────────────
  // SAVE LOGIC
  // ─────────────────────────────────────────────────────────────
  const performSave = useCallback(async (date: string, isManual: boolean) => {
    if (!editorRef.current) return;
    const html           = editorRef.current.innerHTML;
    const currentHeading = heading;
    const currentMood    = mood;

    if (!html.trim() && !currentMood && !currentHeading) return;
    if (entry?.isLocked) return;
    if (!isManual && html === lastSavedHtml.current && !isNewEntryRef.current) return;

    setSaving(true);
    let saved: DiaryEntry | null = null;

    // isNewEntryRef tracks whether this date has ever been saved in this session
    if (isNewEntryRef.current) {
      saved = await apiCreate({
        date, content: html, heading: currentHeading, textColor: "black", mood: currentMood,
      });
      if (saved) {
        isNewEntryRef.current = false;
        setAllDates(prev => prev.includes(date) ? prev : [...prev, date].sort());
        setTotalPages(p => p + 1);
      }
    } else {
      saved = await apiPatch({
        date, content: html, heading: currentHeading, mood: currentMood, incrementEdit: isManual,
      });
    }

    setSaving(false);
    if (saved) {
      setEntry(saved);
      // Always evict after write so next load is fresh
      cacheDel(date);
      // Re-cache the freshly saved entry (but not if today — cacheSet skips today anyway)
      cacheSet(date, saved);
      lastSavedHtml.current = html;
      isDirtyRef.current    = false;
      if (isManual) { setSaveMsg("Saved ✓"); setTimeout(() => setSaveMsg(""), 2500); }
    }
  }, [heading, mood, entry, cacheDel, cacheSet]);

  function triggerAutoSave() {
    isDirtyRef.current = true;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => performSave(currentDate, false), 4000);
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
  function fmt(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  }
  function applyInk(hex: string) {
    editorRef.current?.focus();
    document.execCommand("foreColor", false, hex);
    setShowInkPicker(false);
    triggerAutoSave();
  }

  // ── Navigation ────────────────────────────────────────────────
  function startCooldown() {
    setNavCooldown(true);
    let s = NAV_COOLDOWN_MS / 1000;
    setNavSecs(s);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      s -= 1; setNavSecs(s);
      if (s <= 0) {
        clearInterval(cooldownRef.current!);
        setNavCooldown(false);
        setNavSecs(0);
      }
    }, 1000);
  }

  // Single central navigation function.
  // – Always fetches fresh for today.
  // – For other dates: uses cache (filled by prefetch).
  // – If target === currentDate, forces a reload instead of a no-op.
  function navigateTo(date: string, flip?: "left" | "right") {
    if (isFuture(date)) return;

    // Save any unsaved changes before leaving
    if (isDirtyRef.current && date !== currentDate) {
      performSave(currentDate, false);
    }

    if (date === currentDate) {
      // Same date — force reload (e.g. "Today" button, card click on current date)
      reloadCurrentPage();
      return;
    }

    if (flip) {
      if (navCooldown || isFlipping) return;
      setFlipDir(flip);
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentDate(date);
        setIsFlipping(false);
        setFlipDir(null);
      }, 300);
      startCooldown();
    } else {
      setCurrentDate(date);
    }
  }

  function goPrev() {
    const today     = getTODAY();
    const ninety    = addDays(today, -90);
    const idx       = allDates.indexOf(currentDate);
    // Try jumping to previous entry date first; otherwise go back one calendar day
    if (idx > 0) { navigateTo(allDates[idx - 1], "left"); return; }
    const p = addDays(currentDate, -1);
    if (p >= ninety) navigateTo(p, "left");
  }

  function goNext() {
    const n = addDays(currentDate, 1);
    if (!isFuture(n)) navigateTo(n, "right");
  }

  function jumpTo() {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1 || n > allDates.length) return;
    const d = allDates[n - 1];
    if (!isFuture(d)) { navigateTo(d); setJumpInput(""); }
  }

  // ── Search ───────────────────────────────────────────────────
  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim() || q.length < 2) {
      setSearchResults([]); setSearchState("idle"); return;
    }
    setSearchState("searching");
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/diary/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (!res.ok) { setSearchState("done"); return; }
        const { results } = await res.json();
        setSearchResults((results ?? []).slice(0, 5));
        setSearchState("done");
      } catch { setSearchState("done"); }
    }, 400);
  }

  function clearSearch() {
    setSearchQuery(""); setSearchResults([]); setSearchState("idle"); setShowSearch(false);
  }

  // ── Settings / Headings ───────────────────────────────────────
  async function persistHeadings(updated: DiaryHeading[]) {
    setHeadings(updated);
    headingsRef.current = updated;
    await fetch("/api/diary/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headings: updated }),
    });
  }

  // ── Delete content ────────────────────────────────────────────
  async function handleDeleteContent() {
    if (!canDelete || isDeleting) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);

    const result = await apiDelete(currentDate);
    setIsDeleting(false);

    if (!result) {
      setDeleteMsg("❌ Delete failed. Try again.");
      setTimeout(() => setDeleteMsg(""), 3000);
      return;
    }
    if ("error" in result && result.error) {
      setDeleteMsg(result.deleteCount >= MAX_DELETES
        ? "🚫 Delete limit reached for this date."
        : `❌ ${result.error}`);
      setTimeout(() => setDeleteMsg(""), 4000);
      return;
    }

    const updatedEntry = result.entry as DiaryEntry;
    applyEntry(updatedEntry);
    // Evict from cache so any subsequent nav away + back re-fetches
    cacheDel(currentDate);

    const left = result.deletesLeft as number;
    setDeleteMsg(`🗑️ Deleted! ${left} delete${left !== 1 ? "s" : ""} left for this date.`);
    setTimeout(() => setDeleteMsg(""), 4000);
  }

  // ── Calendar cells ────────────────────────────────────────────
  function renderCal(): React.ReactElement[] {
    const today   = getTODAY();
    const ninety  = addDays(today, -90);
    const { year, month } = calView;
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: React.ReactElement[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`_${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const cur = ds === currentDate;
      const tod = ds === today;
      const dis = isFuture(ds) || ds < ninety;
      const has = allDates.includes(ds);
      cells.push(
        <button key={d} disabled={dis}
          onClick={() => { if (!dis) navigateTo(ds); }}
          className={[
            "relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all select-none",
            dis
              ? "text-[#c8b89a] dark:text-[#5a4030] cursor-not-allowed"
              : "hover:bg-[#e8d5b0] dark:hover:bg-[#3a2a18] cursor-pointer text-[#4a3520] dark:text-[#c4a882]",
            cur ? "bg-[#8b5e3c]! text-white! shadow-md" : "",
            tod && !cur ? "ring-2 ring-[#8b5e3c]" : "",
          ].join(" ")}>
          {d}
          {has && !cur && !dis && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8b5e3c]" />
          )}
        </button>
      );
    }
    return cells;
  }

  const displayTotal = Math.max(totalPages, currentPageIndex + 1);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Kalam:wght@300;400;700&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');

        .diary-outer { background: var(--background, #f3ede3); }

        .diary-book {
          background: #f5ead6;
          box-shadow: 0 0 0 1px #c4a882, 4px 0 8px rgba(0,0,0,.12),
            0 20px 60px rgba(80,40,10,.25), inset 0 1px 0 rgba(255,255,255,.6);
        }
        .dark .diary-book {
          background: #2a1f12;
          box-shadow: 0 0 0 1px #6b4c2a, 4px 0 8px rgba(0,0,0,.4),
            0 20px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05);
        }

        .diary-spine {
          background: linear-gradient(180deg,#7a4a20 0%,#5c3414 40%,#7a4a20 70%,#4a2810 100%);
          box-shadow: inset -2px 0 4px rgba(0,0,0,.3), inset 2px 0 2px rgba(255,255,255,.1);
        }

        .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px, #d4b896 29px, #d4b896 30px
          );
        }
        .dark .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px, #4a3520 29px, #4a3520 30px
          );
        }
        @media (max-width: 480px) {
          .diary-lines {
            background-image: repeating-linear-gradient(
              transparent 0px, transparent 24px, #d4b896 24px, #d4b896 25px
            );
          }
          .dark .diary-lines {
            background-image: repeating-linear-gradient(
              transparent 0px, transparent 24px, #4a3520 24px, #4a3520 25px
            );
          }
        }

        .diary-editor {
          font-family: 'Kalam', 'Caveat', cursive;
          font-size: 16.5px;
          font-weight: 400;
          line-height: 30px;
          color: #1c0f00;
          caret-color: #8b5e3c;
          outline: none;
          background: transparent;
          word-break: break-word;
          white-space: pre-wrap;
          letter-spacing: 0.01em;
          min-height: 420px;
        }
        @media (max-width: 480px) {
          .diary-editor { font-size: 14.5px; line-height: 25px; min-height: 360px; }
        }
        .dark .diary-editor { color: #e8d5b0; caret-color: #c4a882; }
        .diary-editor:empty::before {
          content: attr(data-placeholder);
          color: #b8997a; font-style: italic;
          pointer-events: none; font-family: 'Kalam', cursive;
        }

        .diary-heading-font { font-family: 'Playfair Display','Georgia',serif; font-style: italic; }
        .diary-date-stamp   { font-family: 'Kalam', cursive; font-size: 11px; }

        .tbtn {
          display:inline-flex; align-items:center; justify-content:center;
          width:28px; height:28px; border-radius:5px;
          border:1px solid #c4a882; background:#fdf5e6;
          color:#5c3414; font-size:12px; cursor:pointer;
          transition: background .12s, border-color .12s; user-select:none; flex-shrink:0;
        }
        .tbtn:hover { background:#f0d9b5; border-color:#8b5e3c; }
        .tbtn:active { background:#e0c090; }
        .dark .tbtn { background:#3a2a18; border-color:#6b4c2a; color:#e8d5b0; }
        .dark .tbtn:hover { background:#4a3520; border-color:#a07040; }

        .flip-right { animation: flipR .28s ease both; transform-origin: left center; }
        .flip-left  { animation: flipL .28s ease both; transform-origin: right center; }
        @keyframes flipR {
          0%  { transform: perspective(1200px) rotateY(0); opacity:1; }
          50% { transform: perspective(1200px) rotateY(-15deg); opacity:.7; }
          100%{ transform: perspective(1200px) rotateY(0); opacity:1; }
        }
        @keyframes flipL {
          0%  { transform: perspective(1200px) rotateY(0); opacity:1; }
          50% { transform: perspective(1200px) rotateY(15deg); opacity:.7; }
          100%{ transform: perspective(1200px) rotateY(0); opacity:1; }
        }

        .search-result {
          padding:8px 12px; border-bottom:1px solid #e8d5b0; cursor:pointer; transition:background .1s;
        }
        .dark .search-result { border-color:#4a3520; }
        .search-result:hover { background:#f0d9b5; }
        .dark .search-result:hover { background:#3a2a18; }
        .search-result:last-child { border-bottom:none; }

        .delete-modal-overlay {
          position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .delete-modal {
          background:#fdf5e6; border:2px solid #c4a882; border-radius:18px;
          padding:28px 24px; max-width:360px; width:100%;
          box-shadow:0 20px 60px rgba(80,40,10,.35);
        }
        .dark .delete-modal { background:#1e1508; border-color:#6b4c2a; }

        .ink-popover {
          position:absolute; top:calc(100% + 6px); left:0; z-index:40;
          background:#fdf5e6; border:1px solid #c4a882; border-radius:14px;
          padding:12px; width:220px; box-shadow:0 8px 32px rgba(80,40,10,.2);
        }
        .dark .ink-popover { background:#2a1f12; border-color:#6b4c2a; }

        .diary-scroll::-webkit-scrollbar { width:5px; height:5px; }
        .diary-scroll::-webkit-scrollbar-track { background:transparent; }
        .diary-scroll::-webkit-scrollbar-thumb { background:#c4a882; border-radius:99px; }
        .dark .diary-scroll::-webkit-scrollbar-thumb { background:#6b4c2a; }
      `}</style>

      {/* ── Heading settings modal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-[#1a1208] rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-[#c4a882] dark:border-[#6b4c2a]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#3a1f00] dark:text-[#e8d5b0] mb-1">📖 Diary Headings</h2>
            <p className="text-xs text-[#8b6a40] dark:text-[#a07040] mb-3">
              One heading can be set as default.
              <span className={`ml-1 font-bold ${headings.length >= MAX_HEADINGS ? "text-red-500" : "text-[#8b5e3c] dark:text-[#c4a882]"}`}>
                {headings.length}/{MAX_HEADINGS} headings
              </span>
            </p>
            <div className="space-y-2 mb-3 max-h-44 overflow-y-auto diary-scroll">
              {headings.length === 0 && <p className="text-xs text-[#b8997a] italic text-center py-3">No headings yet</p>}
              {headings.map((h, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#fdf5e6] dark:bg-[#2a1f12] rounded-lg px-3 py-2 border border-[#e8d5b0] dark:border-[#4a3520]">
                  <span className="flex-1 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] truncate">{h.text}</span>
                  <button
                    onClick={() => persistHeadings(headings.map((hh, j) => ({ ...hh, isDefault: j === i })))}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${h.isDefault ? "bg-[#8b5e3c] text-white border-[#8b5e3c]" : "border-[#c4a882] dark:border-[#6b4c2a] text-[#8b6a40] dark:text-[#a07040] hover:border-[#8b5e3c]"}`}>
                    {h.isDefault ? "✓ Default" : "Set Default"}
                  </button>
                  <button onClick={() => persistHeadings(headings.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 text-sm transition-colors">✕</button>
                </div>
              ))}
            </div>

            {headings.length >= MAX_HEADINGS ? (
              <div className="mb-4 py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  ✋ Max {MAX_HEADINGS} headings reached — remove one to add a new heading.
                </p>
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <input value={newHeadingText} onChange={e => setNewHText(e.target.value.slice(0, 50))}
                  placeholder="HAR HAR MAHADEV…" maxLength={50}
                  className="flex-1 text-sm border border-[#c4a882] dark:border-[#6b4c2a] rounded-lg px-3 py-2 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newHeadingText.trim() && headings.length < MAX_HEADINGS) {
                      persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                      setNewHText("");
                    }
                  }} />
                <button
                  onClick={() => {
                    if (!newHeadingText.trim() || headings.length >= MAX_HEADINGS) return;
                    persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                    setNewHText("");
                  }}
                  disabled={headings.length >= MAX_HEADINGS}
                  className="bg-[#8b5e3c] hover:bg-[#6b4a2e] disabled:opacity-40 text-white text-sm px-3 rounded-lg font-medium transition-colors">
                  Add
                </button>
              </div>
            )}
            <button onClick={() => setShowSettings(false)}
              className="w-full py-2 rounded-xl bg-[#f0d9b5] dark:bg-[#3a2a18] text-[#5c3414] dark:text-[#e8d5b0] text-sm font-medium transition-colors hover:bg-[#e0c090] dark:hover:bg-[#4a3520]">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && (
        <div className="delete-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-base font-bold text-[#3a1f00] dark:text-[#e8d5b0] mb-2 diary-heading-font">
                Delete Page Content?
              </h2>
              <p className="text-sm text-[#5c3414] dark:text-[#c4a882] leading-relaxed">
                This will <strong>permanently erase</strong> all text, heading, and mood on this page.
                The edit count and lock will also reset.
              </p>
              <div className="mt-3 px-3 py-2 rounded-xl bg-[#fff3e0] dark:bg-[#2a1a0a] border border-[#e8c87a] dark:border-[#6b4c2a]">
                <p className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">
                  ⚠️ You have used {deleteCount} of {MAX_DELETES} deletes for{" "}
                  <span className="underline">{fmtShort(currentDate)}</span>.
                  After {MAX_DELETES} deletes, this date is permanently locked from deletion.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#f0d9b5] dark:bg-[#3a2a18] text-[#5c3414] dark:text-[#c4a882] hover:bg-[#e0c090] dark:hover:bg-[#4a3520] transition-colors border border-[#c4a882] dark:border-[#6b4c2a]">
                Cancel
              </button>
              <button onClick={handleDeleteContent} disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors shadow-sm">
                {isDeleting ? "Deleting…" : `Yes, Delete (${deletesLeft} left)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page layout ── */}
      <div className="diary-outer min-h-screen py-4 px-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#3a1f00] dark:text-[#e8d5b0] flex items-center gap-2">
              <span className="text-2xl">📔</span>
              <span className="diary-heading-font">Diary</span>
            </h1>

            {/* Search box */}
            <div className="relative flex-1 max-w-xs" ref={searchBoxRef}>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-[#b8997a] text-sm pointer-events-none">🔍</span>
                <input
                  value={searchQuery}
                  onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                  onFocus={() => { if (searchQuery.length >= 2) setShowSearch(true); }}
                  placeholder="Search diary entries…"
                  className="w-full text-sm border border-[#c4a882] dark:border-[#6b4c2a] rounded-xl pl-8 pr-8 py-2 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] placeholder:text-[#b8997a] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
                />
                {searchQuery && (
                  <button onClick={clearSearch}
                    className="absolute right-2.5 w-5 h-5 rounded-full flex items-center justify-center bg-[#c4a882] dark:bg-[#6b4c2a] text-white text-[10px] hover:bg-[#8b5e3c] transition-colors">
                    ✕
                  </button>
                )}
              </div>

              {showSearch && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-white dark:bg-[#1a1208] rounded-xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] overflow-hidden">
                  {searchState === "searching" && (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                      <span className="text-xs text-[#8b6a40] dark:text-[#a07040]">Searching…</span>
                    </div>
                  )}
                  {searchState === "done" && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs text-[#b8997a] italic">No entries found for "{searchQuery}"</p>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div key={i} className="search-result"
                      onClick={() => {
                        navigateTo(r.date);
                        setShowSearch(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}>
                      <div className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">{fmtShort(r.date)}</div>
                      <div className="text-xs text-[#5c3414] dark:text-[#a07040] mt-0.5 line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowSettings(true)}
              className="text-xs font-semibold text-[#5c3414] dark:text-[#c4a882] bg-[#fdf5e6] dark:bg-[#2a1f12] border border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] dark:hover:bg-[#3a2a18] px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
              ⚙ Headings
            </button>
          </div>

          {/* ── Calendar + page nav bar ── */}
          <div className="flex flex-wrap items-center gap-2 bg-[#fdf5e6] dark:bg-[#2a1f12] rounded-2xl border border-[#c4a882] dark:border-[#6b4c2a] px-4 py-2.5">
            <div className="relative" ref={calRef}>
              <button onClick={() => setShowCal(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] hover:text-[#8b5e3c] dark:hover:text-[#c4a882] transition-colors">
                📅 <span className="diary-date-stamp">{fmtShort(currentDate)}</span>
                <span className="text-[#b8997a] text-xs">{showCal ? "▴" : "▾"}</span>
              </button>
              {showCal && (
                <div className="absolute top-full left-0 mt-2 z-40 bg-[#fdf5e6] dark:bg-[#1a1208] rounded-2xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] p-3 w-64">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setCalView(c => { const m = c.month === 0 ? 11 : c.month - 1; return { year: c.month === 0 ? c.year - 1 : c.year, month: m }; })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#3a2a18] text-[#8b5e3c] transition-colors text-lg">‹
                    </button>
                    <span className="text-xs font-bold text-[#3a1f00] dark:text-[#e8d5b0]">
                      {new Date(calView.year, calView.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => setCalView(c => { const m = c.month === 11 ? 0 : c.month + 1; return { year: c.month === 11 ? c.year + 1 : c.year, month: m }; })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#3a2a18] text-[#8b5e3c] transition-colors text-lg">›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((l, i) => (
                      <div key={i} className="flex items-center justify-center h-7 text-xs font-bold text-[#b8997a]">{l}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">{renderCal()}</div>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* ── Today button ── */}
            {currentDate !== getTODAY() && (
              <button
                onClick={() => navigateTo(getTODAY())}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors border"
                style={{ background:"#8b5e3c", color:"#fff", border:"1px solid #8b5e3c" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#6b4a2e")}
                onMouseLeave={e => (e.currentTarget.style.background = "#8b5e3c")}>
                ✦ Today
              </button>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#8b6a40] dark:text-[#a07040]">
                Page <strong className="text-[#5c3414] dark:text-[#c4a882]">{currentPageIndex + 1}</strong>
                {" "}of <strong className="text-[#5c3414] dark:text-[#c4a882]">{displayTotal}</strong>
              </span>
              <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && jumpTo()} placeholder="Go" min={1} max={allDates.length}
                className="w-14 text-xs text-center border border-[#c4a882] dark:border-[#6b4c2a] rounded-lg px-2 py-1.5 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
              />
              <button onClick={jumpTo}
                className="text-xs bg-[#8b5e3c] hover:bg-[#6b4a2e] text-white px-2.5 py-1.5 rounded-lg transition-colors font-bold">
                →
              </button>
            </div>
          </div>

          {/* ── DIARY BOOK ── */}
          <div className={[
            "relative rounded-2xl overflow-hidden diary-book",
            isFlipping ? (flipDir === "right" ? "flip-right" : "flip-left") : "",
          ].join(" ")}>

            <div className="h-3 w-full" style={{ background: "linear-gradient(180deg,#6b3a1f 0%,#8b5e3c 100%)" }} />

            <div className="flex">
              <div className="diary-spine w-6 sm:w-8 shrink-0 flex flex-col items-center justify-around py-6 gap-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#2a1208] border border-[#1a0c04] shadow-inner" />
                ))}
              </div>

              <div className="flex-1 px-3 sm:px-5 pt-3 pb-3 min-w-0">

                {/* Page header */}
                <div className="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-[#d4b896] dark:border-[#4a3520]">
                  <div className="relative flex-1 min-w-0">
                    {canEdit ? (
                      <button onClick={() => setShowHPicker(v => !v)}
                        className={[
                          "text-left tracking-wide transition-all leading-tight diary-heading-font w-full text-base sm:text-lg font-bold",
                          heading ? "text-[#8b2500] dark:text-[#d4845a]" : "text-[#b8997a] dark:text-[#6b5030] font-normal",
                        ].join(" ")}>
                        <span className="block truncate">{heading || "Add heading…"}</span>
                        <span className="ml-1 text-sm text-[#b8997a] not-italic font-normal">▾</span>
                      </button>
                    ) : (
                      heading
                        ? <p className="text-base sm:text-lg font-bold text-[#8b2500] dark:text-[#d4845a] diary-heading-font truncate">{heading}</p>
                        : null
                    )}
                    {showHeadingPicker && canEdit && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-[#fdf5e6] dark:bg-[#1a1208] rounded-xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] py-1 w-56 max-h-52 overflow-y-auto diary-scroll">
                        <button onClick={() => { setHeading(""); setShowHPicker(false); }}
                          className="w-full text-left px-4 py-2 text-xs text-[#b8997a] hover:bg-[#f0d9b5] dark:hover:bg-[#2a1f12] italic">
                          — No heading —
                        </button>
                        {headings.length === 0 && (
                          <p className="px-4 py-2 text-xs text-[#b8997a]">Add headings in ⚙ settings</p>
                        )}
                        {headings.map((h, i) => (
                          <button key={i}
                            onClick={() => { setHeading(h.text); setShowHPicker(false); triggerAutoSave(); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-[#f0d9b5] dark:hover:bg-[#2a1f12] text-[#8b2500] dark:text-[#d4845a] transition-colors diary-heading-font ${heading === h.text ? "bg-[#f0d9b5] dark:bg-[#2a1f12]" : ""}`}>
                            {h.text}
                            {h.isDefault && <span className="ml-2 text-xs text-[#b8997a] font-normal not-italic">default</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="diary-date-stamp font-semibold text-[#5c3414] dark:text-[#c4a882] bg-[#eedfc0] dark:bg-[#3a2a18] px-2 py-1.5 rounded-lg leading-tight border border-[#c4a882] dark:border-[#6b4c2a] text-[10px] sm:text-xs">
                      {fmtLong(currentDate)}
                    </div>
                    {isLocked && <p className="text-xs text-red-500 font-bold mt-1">🔒 Locked</p>}
                    {!isLocked && entry && <p className="text-xs text-[#b8997a] mt-1">{editsLeft} edit{editsLeft !== 1 ? "s" : ""} left</p>}
                    {entry && deleteCount > 0 && (
                      <p className={`text-xs font-bold mt-1 ${deleteMaxed ? "text-red-500" : "text-[#a07040] dark:text-[#c4a882]"}`}>
                        {deleteMaxed ? "🚫 No deletes left" : `🗑️ ${deletesLeft} delete${deletesLeft !== 1 ? "s" : ""} left`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toolbar */}
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1 mb-2 pb-2 border-b border-[#d4b896] dark:border-[#4a3520]"
                    onMouseDown={e => e.preventDefault()}>
                    <button className="tbtn font-bold text-[13px]" title="Bold"      onClick={() => fmt("bold")}>B</button>
                    <button className="tbtn italic text-[13px]"    title="Italic"    onClick={() => fmt("italic")}>I</button>
                    <button className="tbtn underline text-[13px]" title="Underline" onClick={() => fmt("underline")}>U</button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#6b4c2a] mx-0.5" />

                    <button className="tbtn" title="Align Left"   onClick={() => fmt("justifyLeft")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="0" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="0" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="0" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Center"       onClick={() => fmt("justifyCenter")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="2" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="1" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="3" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Align Right"  onClick={() => fmt("justifyRight")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="4" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="2" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="6" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#6b4c2a] mx-0.5" />

                    {/* Ink picker */}
                    <div className="relative" ref={inkRef}>
                      <button className="tbtn gap-1 px-2 w-auto! text-[11px] font-medium" title="Ink color"
                        onClick={() => setShowInkPicker(v => !v)}>
                        <span style={{
                          display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                          background: "linear-gradient(135deg,#b91c1c,#1d4ed8,#166534)",
                          border: "1px solid #c4a882", flexShrink: 0,
                        }} />
                        <span className="hidden sm:inline">Ink</span>
                        <span className="text-[9px] text-[#b8997a]">▾</span>
                      </button>

                      {showInkPicker && (
                        <div className="ink-popover" onMouseDown={e => e.preventDefault()}>
                          <p className="text-[10px] font-bold text-[#8b6a40] dark:text-[#a07040] mb-2 uppercase tracking-widest">
                            Select text, then tap a colour
                          </p>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {INK_COLORS.map(c => (
                              <button key={c.hex} title={c.label} onClick={() => applyInk(c.hex)}
                                className="group flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-[#f0d9b5] dark:hover:bg-[#3a2a18] transition-colors">
                                <span className="w-7 h-7 rounded-full border-2 border-white dark:border-[#4a3520] shadow-sm transition-transform group-hover:scale-110"
                                  style={{ background: c.hex }} />
                                <span className="text-[9px] text-[#8b6a40] dark:text-[#a07040] leading-none text-center">{c.label}</span>
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-[#e8d5b0] dark:border-[#4a3520]">
                            <label className="text-[10px] text-[#8b6a40] dark:text-[#a07040] shrink-0 font-medium">Custom:</label>
                            <input type="color" value={customInk} onChange={e => setCustomInk(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-[#c4a882] dark:border-[#6b4c2a] cursor-pointer bg-transparent p-0.5" />
                            <button onClick={() => applyInk(customInk)}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-[#8b5e3c] hover:bg-[#6b4a2e] text-white transition-colors">
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1" />
                    <span className={`text-[11px] tabular-nums font-medium ${charCount > MAX_CHARS * 0.9 ? "text-amber-600 dark:text-amber-400" : "text-[#b8997a]"}`}>
                      {charCount}/{MAX_CHARS}
                    </span>
                  </div>
                )}

                {/* Writing area */}
                <div className="relative diary-lines" style={{ minHeight: "420px" }}>
                  {loading ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="w-5 h-5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div
                      ref={editorRef}
                      contentEditable={canEdit}
                      suppressContentEditableWarning
                      className="diary-editor"
                      data-placeholder={canEdit ? "Start writing…" : "No entry for this date."}
                      onInput={handleInput}
                      onPaste={handlePaste}
                      style={{ padding: "4px 4px 20px" }}
                    />
                  )}
                </div>

                {/* Mood row */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#4a3520]">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold text-[#8b6a40] dark:text-[#a07040] mr-1 select-none">Mood:</span>
                    {MOODS.map(m => (
                      <div key={m.key} className="relative group">
                        <button disabled={!canEdit}
                          onClick={() => { setMood(mood === m.key ? null : m.key); triggerAutoSave(); }}
                          className={[
                            "w-8 h-8 sm:w-9 sm:h-9 text-lg sm:text-xl rounded-full flex items-center justify-center transition-all select-none",
                            mood === m.key ? "bg-[#eedfc0] dark:bg-[#3a2a18] ring-2 ring-[#8b5e3c] scale-110 shadow" : "",
                            canEdit ? "hover:bg-[#f0d9b5] dark:hover:bg-[#2a1f12] hover:scale-105 cursor-pointer" : "opacity-50 cursor-default",
                          ].join(" ")}>
                          {m.emoji}
                        </button>
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-[#3a1f00] text-white text-[11px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          {m.label}
                        </span>
                      </div>
                    ))}
                    {mood && (
                      <span className="ml-1 text-xs font-bold text-[#5c3414] dark:text-[#c4a882]">
                        {MOODS.find(m => m.key === mood)?.emoji} {MOODS.find(m => m.key === mood)?.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#4a3520] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-[#b8997a]">
                      {isLocked ? "🔒 Locked — no more edits" : entry ? `Manual saves: ${entry.editCount} / 5` : "New entry"}
                    </span>
                    {deleteMsg && (
                      <span className={`text-xs font-semibold ${deleteMsg.startsWith("🚫") || deleteMsg.startsWith("❌") ? "text-red-500" : "text-[#8b5e3c] dark:text-[#c4a882]"}`}>
                        {deleteMsg}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium transition-opacity min-w-[52px] text-right ${saveMsg ? "text-green-600 opacity-100" : saving ? "text-[#8b5e3c] opacity-100" : "opacity-0"}`}>
                      {saving ? "Saving…" : saveMsg}
                    </span>

                    {canDeleteBase && entry && (
                      deleteMaxed ? (
                        <button disabled title="Delete limit reached"
                          className="flex items-center gap-1.5 opacity-40 cursor-not-allowed text-xs font-semibold px-3 py-2 rounded-xl border border-[#c4a882] dark:border-[#6b4c2a] text-[#8b5e3c] dark:text-[#c4a882]">
                          🚫 No Deletes Left
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isDeleting || !canDelete}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          🗑️ Delete
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 font-bold">
                            {deletesLeft}/{MAX_DELETES}
                          </span>
                        </button>
                      )
                    )}

                    {canEdit && (
                      <button onClick={handleManualSave} disabled={saving || isLocked}
                        className="flex items-center gap-1.5 bg-[#8b5e3c] hover:bg-[#6b4a2e] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
                        💾 Save
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-1.5 sm:w-2 shrink-0" style={{ background: "linear-gradient(180deg,#c4a882 0%,#e8d5b0 50%,#c4a882 100%)" }} />
            </div>

            <div className="h-3 w-full" style={{ background: "linear-gradient(0deg,#6b3a1f 0%,#8b5e3c 100%)" }} />
          </div>

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={goPrev}
              disabled={navCooldown || currentDate <= NINETY_AGO}
              className={[
                "flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                navCooldown || currentDate <= NINETY_AGO
                  ? "bg-[#f0e0c0] dark:bg-[#2a1f12] text-[#c4a882] dark:text-[#6b4c2a] border-[#e8d5b0] dark:border-[#3a2a18] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] dark:hover:bg-[#3a2a18] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}>
              ◀ Prev {navCooldown && <span className="font-mono text-xs">{navSecs}s</span>}
            </button>

            <div className="text-center text-xs">
              {currentDate === getTODAY()
                ? <span className="font-bold text-[#8b5e3c] dark:text-[#c4a882]">✦ Today</span>
                : <span className="text-[#8b6a40] dark:text-[#a07040]">
                    {Math.abs(Math.round((strToDate(currentDate).getTime() - strToDate(getTODAY()).getTime()) / 86400000))} days ago
                  </span>
              }
            </div>

            <button onClick={goNext}
              disabled={navCooldown || !canGoNext}
              className={[
                "flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                navCooldown || !canGoNext
                  ? "bg-[#f0e0c0] dark:bg-[#2a1f12] text-[#c4a882] dark:text-[#6b4c2a] border-[#e8d5b0] dark:border-[#3a2a18] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] dark:hover:bg-[#3a2a18] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}>
              Next ▶ {navCooldown && <span className="font-mono text-xs">{navSecs}s</span>}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}