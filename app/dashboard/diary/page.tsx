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
function fmtLongMobile(s: string) {
  return strToDate(s).toLocaleDateString("en-IN", {
    weekday:"short", day:"numeric", month:"short", year:"numeric", timeZone:"UTC",
  });
}
function fmtShort(s: string) {
  return strToDate(s).toLocaleDateString("en-IN", {
    day:"2-digit", month:"short", year:"numeric", timeZone:"UTC",
  });
}

// ─────────────────────────────────────────────────────────────
// API HELPERS — NO CACHING, always fresh
// ─────────────────────────────────────────────────────────────
async function apiFetch(date: string): Promise<DiaryEntry | null> {
  const r = await fetch(`/api/diary/entry?date=${date}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" },
  });
  if (!r.ok) return null;
  const { entry } = await r.json();
  return entry ?? null;
}

async function apiCreate(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    body: JSON.stringify(p),
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}

async function apiPatch(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    body: JSON.stringify(p),
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}

async function apiDelete(date: string) {
  const r = await fetch("/api/diary/entry", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
    body: JSON.stringify({ date }),
  });
  const data = await r.json();
  if (!r.ok) return data;
  return data;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const getTODAY   = () => todayStr();
  const NINETY_AGO = addDays(getTODAY(), -90);

  // Core state
  const [currentDate, setCurrentDate] = useState(getTODAY);
  const [entry, setEntry]             = useState<DiaryEntry | null>(null);
  const [heading, setHeading]         = useState("");
  const [mood, setMood]               = useState<string | null>(null);
  const [charCount, setCharCount]     = useState(0);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState("");

  // Dirty tracking
  const isDirtyRef    = useRef(false);
  const isNewEntryRef = useRef(true);
  const lastSavedHtml = useRef("");
  const headingsRef   = useRef<DiaryHeading[]>([]);

  // Navigation epoch — discard stale responses
  const navEpochRef   = useRef(0);
  const currentDateRef = useRef(currentDate);
  useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);

  // Navigation state
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
  const [headings, setHeadings]             = useState<DiaryHeading[]>([]);
  const [showHeadingPicker, setShowHPicker] = useState(false);
  const [showSettingsModal, setShowSettings]= useState(false);
  const [newHeadingText, setNewHText]       = useState("");

  // Search
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState]   = useState<"idle"|"searching"|"done">("idle");
  const [showSearch, setShowSearch]     = useState(false);
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

  // Mobile search toggle
  const [showMobileSearch, setShowMobileSearch] = useState(false);

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
      if (e.key === "Escape") {
        setShowSearch(false); setShowInkPicker(false);
        setShowMobileSearch(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Mount: load meta + settings ─────────────────────────────
  useEffect(() => {
    (async () => {
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

  // ── Load page whenever currentDate changes ───────────────────
  useEffect(() => {
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = null;
    }
    isDirtyRef.current = false;
    loadPage(currentDate);
    setShowCal(false);
    setShowHPicker(false);
    setShowDeleteConfirm(false);
    setDeleteMsg("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  // ── loadPage — always fetches fresh, no cache ────────────────
  async function loadPage(date: string) {
    navEpochRef.current += 1;
    const myEpoch = navEpochRef.current;
    setLoading(true);

    // Always fresh — no cache used
    const e = await apiFetch(date);

    // Discard stale responses
    if (navEpochRef.current !== myEpoch) return;
    if (currentDateRef.current !== date) return;

    applyEntry(e);
    setLoading(false);
  }

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

  function reloadCurrentPage() {
    if (autoSaveRef.current) { clearTimeout(autoSaveRef.current); autoSaveRef.current = null; }
    isDirtyRef.current = false;
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

    const isEmpty = !html.trim() && !currentMood && !currentHeading;
    if (isEmpty) return;
    if (entry?.isLocked) return;
    if (!isManual && html === lastSavedHtml.current && !isNewEntryRef.current) return;

    setSaving(true);
    let saved: DiaryEntry | null = null;

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
      lastSavedHtml.current = html;
      isDirtyRef.current    = false;
      if (isManual) { setSaveMsg("Saved ✓"); setTimeout(() => setSaveMsg(""), 2500); }
    }
  }, [heading, mood, entry]);

  function triggerAutoSave() {
    isDirtyRef.current = true;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => performSave(currentDate, false), 4000);
  }

  function handleManualSave() { performSave(currentDate, true); }

  // ── Editor ───────────────────────────────────────────────────
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

  // ── Formatting ───────────────────────────────────────────────
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

  // ── Navigation ───────────────────────────────────────────────
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

  function navigateTo(date: string, flip?: "left" | "right") {
    if (isFuture(date)) return;

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    // Save departing page if dirty and moving to a different date
    if (isDirtyRef.current && date !== currentDate && !isNewEntryRef.current) {
      const departingDate = currentDate;
      const departingHtml = editorRef.current?.innerHTML ?? "";
      const departingHdg  = heading;
      const departingMood = mood;
      if (departingHtml.trim() || departingMood || departingHdg) {
        apiPatch({
          date: departingDate,
          content: departingHtml,
          heading: departingHdg,
          mood: departingMood,
          incrementEdit: false,
        });
      }
      isDirtyRef.current = false;
    }

    if (date === currentDate) {
      reloadCurrentPage();
      return;
    }

    if (flip) {
      if (navCooldown || isFlipping) return;
      setFlipDir(flip);
      setIsFlipping(true);
      setTimeout(() => {
        currentDateRef.current = date;
        setCurrentDate(date);
        setIsFlipping(false);
        setFlipDir(null);
      }, 300);
      startCooldown();
    } else {
      currentDateRef.current = date;
      setCurrentDate(date);
    }
  }

  function goPrev() {
    const today  = getTODAY();
    const ninety = addDays(today, -90);
    const idx    = allDates.indexOf(currentDate);
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
    setSearchQuery(""); setSearchResults([]); setSearchState("idle");
    setShowSearch(false); setShowMobileSearch(false);
  }

  // ── Settings / Headings ─────────────────────────────────────
  async function persistHeadings(updated: DiaryHeading[]) {
    setHeadings(updated);
    headingsRef.current = updated;
    await fetch("/api/diary/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headings: updated }),
    });
  }

  // ── Delete content ───────────────────────────────────────────
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

    const left = result.deletesLeft as number;
    setDeleteMsg(`🗑️ Deleted! ${left} delete${left !== 1 ? "s" : ""} left for this date.`);
    setTimeout(() => setDeleteMsg(""), 4000);
  }

  // ── Calendar cells ───────────────────────────────────────────
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
            cur ? "!bg-[#8b5e3c] !text-white shadow-md" : "",
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

        /* ── Light mode base ── */
        .diary-outer {
          background: #f3ede3;
          min-height: 100vh;
        }
        .dark .diary-outer {
          background: #180f08;
        }

        /* ── Book card ── */
        .diary-book {
          background: #f5ead6;
          box-shadow:
            0 0 0 1px #c4a882,
            4px 0 8px rgba(0,0,0,.12),
            0 20px 60px rgba(80,40,10,.25),
            inset 0 1px 0 rgba(255,255,255,.6);
        }
        .dark .diary-book {
          background: #1e1408;
          box-shadow:
            0 0 0 1px #5a3c20,
            4px 0 8px rgba(0,0,0,.5),
            0 20px 60px rgba(0,0,0,.6),
            inset 0 1px 0 rgba(255,255,255,.04);
        }

        /* ── Spine ── */
        .diary-spine {
          background: linear-gradient(180deg,#7a4a20 0%,#5c3414 40%,#7a4a20 70%,#4a2810 100%);
          box-shadow: inset -2px 0 4px rgba(0,0,0,.3), inset 2px 0 2px rgba(255,255,255,.1);
        }

        /* ── Ruled lines ── */
        .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px, #d4b896 29px, #d4b896 30px
          );
        }
        .dark .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px, #3a2510 29px, #3a2510 30px
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
              transparent 0px, transparent 24px, #3a2510 24px, #3a2510 25px
            );
          }
        }

        /* ── Editor ── */
        .diary-editor {
          font-family: 'Kalam', 'Caveat', cursive;
          font-size: 16px;
          font-weight: 400;
          line-height: 30px;
          color: #1c0f00;
          caret-color: #8b5e3c;
          outline: none;
          background: transparent;
          word-break: break-word;
          white-space: pre-wrap;
          letter-spacing: 0.01em;
          min-height: 390px;
          padding: 4px 4px 24px;
          width: 100%;
          box-sizing: border-box;
        }
        .dark .diary-editor {
          color: #e8d5b0;
          caret-color: #c4a882;
        }
        .diary-editor:empty::before {
          content: attr(data-placeholder);
          color: #b8997a;
          font-style: italic;
          pointer-events: none;
          font-family: 'Kalam', cursive;
        }
        .dark .diary-editor:empty::before {
          color: #6b5030;
        }

        @media (max-width: 480px) {
          .diary-editor {
            font-size: 14.5px;
            line-height: 25px;
            min-height: 320px;
          }
        }

        /* ── Typography helpers ── */
        .diary-heading-font {
          font-family: 'Playfair Display','Georgia',serif;
          font-style: italic;
        }
        .diary-date-stamp {
          font-family: 'Kalam', cursive;
          font-size: 11px;
        }

        /* ── Toolbar button ── */
        .tbtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 5px;
          border: 1px solid #c4a882;
          background: #fdf5e6;
          color: #5c3414;
          font-size: 12px;
          cursor: pointer;
          transition: background .12s, border-color .12s;
          user-select: none;
          flex-shrink: 0;
        }
        .tbtn:hover  { background: #f0d9b5; border-color: #8b5e3c; }
        .tbtn:active { background: #e0c090; }
        .dark .tbtn  { background: #2a1a0e; border-color: #5a3c20; color: #e8d5b0; }
        .dark .tbtn:hover { background: #3a2512; border-color: #a07040; }

        /* ── Page flip animations ── */
        .flip-right { animation: flipR .28s ease both; transform-origin: left center; }
        .flip-left  { animation: flipL .28s ease both; transform-origin: right center; }
        @keyframes flipR {
          0%   { transform: perspective(1200px) rotateY(0); opacity:1; }
          50%  { transform: perspective(1200px) rotateY(-15deg); opacity:.7; }
          100% { transform: perspective(1200px) rotateY(0); opacity:1; }
        }
        @keyframes flipL {
          0%   { transform: perspective(1200px) rotateY(0); opacity:1; }
          50%  { transform: perspective(1200px) rotateY(15deg); opacity:.7; }
          100% { transform: perspective(1200px) rotateY(0); opacity:1; }
        }

        /* ── Search results ── */
        .search-result {
          padding: 8px 12px;
          border-bottom: 1px solid #e8d5b0;
          cursor: pointer;
          transition: background .1s;
        }
        .dark .search-result { border-color: #3a2510; }
        .search-result:hover { background: #f0d9b5; }
        .dark .search-result:hover { background: #2a1a0e; }
        .search-result:last-child { border-bottom: none; }

        /* ── Modals ── */
        .delete-modal-overlay {
          position: fixed; inset: 0; z-index: 60;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          backdrop-filter: blur(4px);
        }
        .delete-modal {
          background: #fdf5e6;
          border: 2px solid #c4a882;
          border-radius: 18px;
          padding: 24px 20px;
          max-width: 360px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(80,40,10,.35);
        }
        .dark .delete-modal { background: #1a1008; border-color: #5a3c20; }

        /* ── Ink popover ── */
        .ink-popover {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
          background: #fdf5e6;
          border: 1px solid #c4a882;
          border-radius: 14px;
          padding: 12px;
          width: 210px;
          box-shadow: 0 8px 32px rgba(80,40,10,.2);
        }
        .dark .ink-popover { background: #1e1408; border-color: #5a3c20; }

        /* ── Scrollbar ── */
        .diary-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .diary-scroll::-webkit-scrollbar-track { background: transparent; }
        .diary-scroll::-webkit-scrollbar-thumb { background: #c4a882; border-radius: 99px; }
        .dark .diary-scroll::-webkit-scrollbar-thumb { background: #5a3c20; }

        /* ── Top / bottom strip ── */
        .diary-strip-top {
          height: 12px; width: 100%;
          background: linear-gradient(180deg, #6b3a1f 0%, #8b5e3c 100%);
        }
        .diary-strip-bot {
          height: 12px; width: 100%;
          background: linear-gradient(0deg, #6b3a1f 0%, #8b5e3c 100%);
        }

        /* ── Right binding ── */
        .diary-binding-right {
          width: 6px; flex-shrink: 0;
          background: linear-gradient(180deg, #c4a882 0%, #e8d5b0 50%, #c4a882 100%);
        }
        .dark .diary-binding-right {
          background: linear-gradient(180deg, #5a3c20 0%, #3a2510 50%, #5a3c20 100%);
        }

        /* ── Nav/toolbar panels ── */
        .diary-panel {
          background: #fdf5e6;
          border: 1px solid #c4a882;
        }
        .dark .diary-panel {
          background: #1e1408;
          border-color: #5a3c20;
        }

        /* ── Settings / Calendar card ── */
        .diary-card {
          background: white;
          border: 1px solid #c4a882;
        }
        .dark .diary-card {
          background: #140d06;
          border-color: #5a3c20;
        }

        /* ── Input fields ── */
        .diary-input {
          background: #fdf5e6;
          border: 1px solid #c4a882;
          color: #3a1f00;
        }
        .dark .diary-input {
          background: #1e1408;
          border-color: #5a3c20;
          color: #e8d5b0;
        }
        .diary-input::placeholder { color: #b8997a; }
        .dark .diary-input::placeholder { color: #6b5030; }
        .diary-input:focus { outline: none; box-shadow: 0 0 0 2px rgba(139,94,60,0.35); border-color: #8b5e3c; }

        /* ── Heading picker dropdown ── */
        .heading-picker {
          background: #fdf5e6;
          border: 1px solid #c4a882;
        }
        .dark .heading-picker {
          background: #140d06;
          border-color: #5a3c20;
        }

        /* ── Date stamp badge ── */
        .diary-datestamp {
          background: #eedfc0;
          border: 1px solid #c4a882;
          color: #5c3414;
        }
        .dark .diary-datestamp {
          background: #2a1a0e;
          border-color: #5a3c20;
          color: #c4a882;
        }

        /* ── Mobile: hide spine on very small screens ── */
        @media (max-width: 360px) {
          .diary-spine { width: 16px !important; }
          .diary-spine-dot { width: 6px !important; height: 6px !important; }
        }
      `}</style>

      {/* ── Heading Settings Modal ── */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="diary-card rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-[#3a1f00] dark:text-[#e8d5b0] mb-1">📖 Diary Headings</h2>
            <p className="text-xs text-[#8b6a40] dark:text-[#a07040] mb-3">
              One heading can be set as default.
              <span className={`ml-1 font-bold ${headings.length >= MAX_HEADINGS ? "text-red-500" : "text-[#8b5e3c] dark:text-[#c4a882]"}`}>
                {headings.length}/{MAX_HEADINGS} headings
              </span>
            </p>

            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto diary-scroll">
              {headings.length === 0 && (
                <p className="text-xs text-[#b8997a] dark:text-[#6b5030] italic text-center py-3">No headings yet</p>
              )}
              {headings.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-[#fdf5e6] dark:bg-[#1e1408] rounded-lg px-3 py-2 border border-[#e8d5b0] dark:border-[#3a2510]"
                >
                  <span className="flex-1 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] truncate">{h.text}</span>
                  <button
                    onClick={() => persistHeadings(headings.map((hh, j) => ({ ...hh, isDefault: j === i })))}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                      h.isDefault
                        ? "bg-[#8b5e3c] text-white border-[#8b5e3c]"
                        : "border-[#c4a882] dark:border-[#5a3c20] text-[#8b6a40] dark:text-[#a07040] hover:border-[#8b5e3c]"
                    }`}
                  >
                    {h.isDefault ? "✓ Default" : "Set"}
                  </button>
                  <button
                    onClick={() => persistHeadings(headings.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 text-sm transition-colors"
                  >✕</button>
                </div>
              ))}
            </div>

            {headings.length >= MAX_HEADINGS ? (
              <div className="mb-4 py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  ✋ Max {MAX_HEADINGS} headings — remove one first
                </p>
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <input
                  value={newHeadingText}
                  onChange={e => setNewHText(e.target.value.slice(0, 50))}
                  placeholder="e.g. HAR HAR MAHADEV…"
                  maxLength={50}
                  className="diary-input flex-1 text-sm rounded-lg px-3 py-2"
                  onKeyDown={e => {
                    if (e.key === "Enter" && newHeadingText.trim() && headings.length < MAX_HEADINGS) {
                      persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                      setNewHText("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (!newHeadingText.trim() || headings.length >= MAX_HEADINGS) return;
                    persistHeadings([...headings, { text: newHeadingText.trim(), isDefault: false }]);
                    setNewHText("");
                  }}
                  disabled={headings.length >= MAX_HEADINGS}
                  className="bg-[#8b5e3c] hover:bg-[#6b4a2e] disabled:opacity-40 text-white text-sm px-3 rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            )}

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2 rounded-xl bg-[#f0d9b5] dark:bg-[#2a1a0e] hover:bg-[#e0c090] dark:hover:bg-[#3a2512] text-[#5c3414] dark:text-[#e8d5b0] text-sm font-medium transition-colors border border-[#c4a882] dark:border-[#5a3c20]"
            >
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
              </p>
              <div className="mt-3 px-3 py-2 rounded-xl bg-[#fff3e0] dark:bg-[#1e1408] border border-[#e8c87a] dark:border-[#5a3c20]">
                <p className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">
                  ⚠️ {deleteCount} of {MAX_DELETES} deletes used for{" "}
                  <span className="underline">{fmtShort(currentDate)}</span>.
                  After {MAX_DELETES} deletes this date is permanently locked.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#f0d9b5] dark:bg-[#2a1a0e] text-[#5c3414] dark:text-[#c4a882] hover:bg-[#e0c090] dark:hover:bg-[#3a2512] transition-colors border border-[#c4a882] dark:border-[#5a3c20]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteContent}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
              >
                {isDeleting ? "Deleting…" : `Delete (${deletesLeft} left)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="diary-outer py-3 sm:py-5 px-2 sm:px-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">

          {/* ── Top bar ── */}
          <div className="flex items-center gap-2">
            {/* Title */}
            <h1 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[#3a1f00] dark:text-[#e8d5b0] shrink-0">
              <span className="text-xl sm:text-2xl">📔</span>
              <span className="diary-heading-font hidden xs:inline sm:inline">Diary</span>
            </h1>

            {/* Search — desktop */}
            <div className="relative flex-1 max-w-xs hidden sm:block ml-2" ref={searchBoxRef}>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-[#b8997a] text-sm pointer-events-none">🔍</span>
                <input
                  value={searchQuery}
                  onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                  onFocus={() => { if (searchQuery.length >= 2) setShowSearch(true); }}
                  placeholder="Search entries…"
                  className="diary-input w-full text-sm rounded-xl pl-8 pr-8 py-1.5"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 w-5 h-5 rounded-full flex items-center justify-center bg-[#c4a882] dark:bg-[#5a3c20] text-white text-[10px] hover:bg-[#8b5e3c] transition-colors"
                  >✕</button>
                )}
              </div>

              {showSearch && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-40 diary-card rounded-xl shadow-xl overflow-hidden">
                  {searchState === "searching" && (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                      <span className="text-xs text-[#8b6a40] dark:text-[#a07040]">Searching…</span>
                    </div>
                  )}
                  {searchState === "done" && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs text-[#b8997a] dark:text-[#6b5030] italic">No results for "{searchQuery}"</p>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div
                      key={i} className="search-result"
                      onClick={() => { navigateTo(r.date); clearSearch(); }}
                    >
                      <div className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">{fmtShort(r.date)}</div>
                      <div className="text-xs text-[#5c3414] dark:text-[#a07040] mt-0.5 line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Mobile search toggle */}
            <button
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-[#c4a882] dark:border-[#5a3c20] bg-[#fdf5e6] dark:bg-[#1e1408] text-[#5c3414] dark:text-[#c4a882] text-base transition-colors hover:bg-[#f0d9b5] dark:hover:bg-[#2a1a0e]"
              onClick={() => setShowMobileSearch(v => !v)}
              aria-label="Search"
            >
              🔍
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1 text-xs font-semibold text-[#5c3414] dark:text-[#c4a882] bg-[#fdf5e6] dark:bg-[#1e1408] border border-[#c4a882] dark:border-[#5a3c20] hover:bg-[#f0d9b5] dark:hover:bg-[#2a1a0e] px-2.5 sm:px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              ⚙ <span className="hidden sm:inline">Headings</span>
            </button>
          </div>

          {/* ── Mobile search bar (inline) ── */}
          {showMobileSearch && (
            <div className="sm:hidden" ref={searchBoxRef}>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-[#b8997a] text-sm pointer-events-none">🔍</span>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                  onFocus={() => { if (searchQuery.length >= 2) setShowSearch(true); }}
                  placeholder="Search diary entries…"
                  className="diary-input w-full text-sm rounded-xl pl-8 pr-8 py-2"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 w-5 h-5 rounded-full flex items-center justify-center bg-[#c4a882] dark:bg-[#5a3c20] text-white text-[10px] hover:bg-[#8b5e3c] transition-colors"
                  >✕</button>
                )}
              </div>

              {showSearch && searchQuery.length >= 2 && (
                <div className="mt-1 z-40 diary-card rounded-xl shadow-xl overflow-hidden">
                  {searchState === "searching" && (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                      <span className="text-xs text-[#8b6a40] dark:text-[#a07040]">Searching…</span>
                    </div>
                  )}
                  {searchState === "done" && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className="text-xs text-[#b8997a] dark:text-[#6b5030] italic">No results for "{searchQuery}"</p>
                    </div>
                  )}
                  {searchResults.map((r, i) => (
                    <div
                      key={i} className="search-result"
                      onClick={() => { navigateTo(r.date); clearSearch(); }}
                    >
                      <div className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">{fmtShort(r.date)}</div>
                      <div className="text-xs text-[#5c3414] dark:text-[#a07040] mt-0.5 line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Calendar + page nav bar ── */}
          <div className="diary-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 sm:px-4 py-2.5">

            {/* Calendar picker */}
            <div className="relative" ref={calRef}>
              <button
                onClick={() => setShowCal(v => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] hover:text-[#8b5e3c] dark:hover:text-[#c4a882] transition-colors"
              >
                📅
                <span className="diary-date-stamp hidden sm:inline">{fmtShort(currentDate)}</span>
                <span className="diary-date-stamp sm:hidden text-[10px]">{fmtShort(currentDate)}</span>
                <span className="text-[#b8997a] text-xs">{showCal ? "▴" : "▾"}</span>
              </button>

              {showCal && (
                <div className="absolute top-full left-0 mt-2 z-40 diary-card rounded-2xl shadow-xl p-3 w-60 sm:w-64">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setCalView(c => {
                        const m = c.month === 0 ? 11 : c.month - 1;
                        return { year: c.month === 0 ? c.year - 1 : c.year, month: m };
                      })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#2a1a0e] text-[#8b5e3c] dark:text-[#c4a882] transition-colors text-lg"
                    >‹</button>
                    <span className="text-xs font-bold text-[#3a1f00] dark:text-[#e8d5b0]">
                      {new Date(calView.year, calView.month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      onClick={() => setCalView(c => {
                        const m = c.month === 11 ? 0 : c.month + 1;
                        return { year: c.month === 11 ? c.year + 1 : c.year, month: m };
                      })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#2a1a0e] text-[#8b5e3c] dark:text-[#c4a882] transition-colors text-lg"
                    >›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((l, i) => (
                      <div key={i} className="flex items-center justify-center h-7 text-xs font-bold text-[#b8997a] dark:text-[#6b5030]">{l}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">{renderCal()}</div>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Today button */}
            {currentDate !== getTODAY() && (
              <button
                onClick={() => navigateTo(getTODAY())}
                className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors text-white"
                style={{ background: "#8b5e3c" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#6b4a2e")}
                onMouseLeave={e => (e.currentTarget.style.background = "#8b5e3c")}
              >
                ✦ Today
              </button>
            )}

            {/* Page count + jump */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xs text-[#8b6a40] dark:text-[#a07040] whitespace-nowrap">
                <strong className="text-[#5c3414] dark:text-[#c4a882]">{currentPageIndex + 1}</strong>
                {" / "}
                <strong className="text-[#5c3414] dark:text-[#c4a882]">{displayTotal}</strong>
              </span>
              <input
                type="number"
                value={jumpInput}
                onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && jumpTo()}
                placeholder="Go"
                min={1} max={allDates.length}
                className="diary-input w-12 text-xs text-center rounded-lg px-1.5 py-1.5"
              />
              <button
                onClick={jumpTo}
                className="text-xs bg-[#8b5e3c] hover:bg-[#6b4a2e] text-white px-2 py-1.5 rounded-lg transition-colors font-bold"
              >→</button>
            </div>
          </div>

          {/* ── DIARY BOOK ── */}
          <div className={[
            "relative rounded-2xl overflow-hidden diary-book",
            isFlipping ? (flipDir === "right" ? "flip-right" : "flip-left") : "",
          ].join(" ")}>

            <div className="diary-strip-top" />

            <div className="flex">
              {/* Spine */}
              <div className="diary-spine w-5 sm:w-7 shrink-0 flex flex-col items-center justify-around py-4 sm:py-6 gap-1.5 sm:gap-2">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="diary-spine-dot rounded-full bg-[#1a0c04] border border-[#0a0602] shadow-inner"
                    style={{ width: "8px", height: "8px" }}
                  />
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 px-2.5 sm:px-5 pt-3 pb-3 min-w-0">

                {/* Page header */}
                <div className="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-[#d4b896] dark:border-[#3a2510]">

                  {/* Heading picker */}
                  <div className="relative flex-1 min-w-0">
                    {canEdit ? (
                      <button
                        onClick={() => setShowHPicker(v => !v)}
                        className={[
                          "text-left tracking-wide transition-all leading-tight diary-heading-font w-full text-sm sm:text-base lg:text-lg font-bold",
                          heading
                            ? "text-[#8b2500] dark:text-[#d4845a]"
                            : "text-[#b8997a] dark:text-[#6b5030] font-normal",
                        ].join(" ")}
                      >
                        <span className="block truncate">{heading || "Add heading…"}</span>
                        <span className="ml-1 text-xs text-[#b8997a] not-italic font-normal">▾</span>
                      </button>
                    ) : (
                      heading ? (
                        <p className="text-sm sm:text-base lg:text-lg font-bold text-[#8b2500] dark:text-[#d4845a] diary-heading-font truncate">
                          {heading}
                        </p>
                      ) : null
                    )}

                    {showHeadingPicker && canEdit && (
                      <div className="heading-picker absolute top-full left-0 mt-1 z-30 rounded-xl shadow-xl py-1 w-52 max-h-48 overflow-y-auto diary-scroll">
                        <button
                          onClick={() => { setHeading(""); setShowHPicker(false); }}
                          className="w-full text-left px-4 py-2 text-xs text-[#b8997a] dark:text-[#6b5030] hover:bg-[#f0d9b5] dark:hover:bg-[#1e1408] italic"
                        >
                          — No heading —
                        </button>
                        {headings.length === 0 && (
                          <p className="px-4 py-2 text-xs text-[#b8997a] dark:text-[#6b5030]">Add headings in ⚙ settings</p>
                        )}
                        {headings.map((h, i) => (
                          <button
                            key={i}
                            onClick={() => { setHeading(h.text); setShowHPicker(false); triggerAutoSave(); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-[#f0d9b5] dark:hover:bg-[#1e1408] text-[#8b2500] dark:text-[#d4845a] transition-colors diary-heading-font ${heading === h.text ? "bg-[#f0d9b5] dark:bg-[#1e1408]" : ""}`}
                          >
                            {h.text}
                            {h.isDefault && <span className="ml-2 text-xs text-[#b8997a] dark:text-[#6b5030] font-normal not-italic">default</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Date + status */}
                  <div className="text-right shrink-0 ml-1">
                    <div className="diary-datestamp diary-date-stamp font-semibold px-2 py-1.5 rounded-lg leading-tight text-[9px] sm:text-[10px] lg:text-xs">
                      <span className="hidden sm:inline">{fmtLong(currentDate)}</span>
                      <span className="sm:hidden">{fmtLongMobile(currentDate)}</span>
                    </div>
                    {isLocked && <p className="text-xs text-red-500 dark:text-red-400 font-bold mt-1">🔒 Locked</p>}
                    {!isLocked && entry && (
                      <p className="text-[10px] sm:text-xs text-[#b8997a] dark:text-[#6b5030] mt-1">{editsLeft} edit{editsLeft !== 1 ? "s" : ""} left</p>
                    )}
                    {entry && deleteCount > 0 && (
                      <p className={`text-[10px] sm:text-xs font-bold mt-1 ${deleteMaxed ? "text-red-500 dark:text-red-400" : "text-[#a07040] dark:text-[#c4a882]"}`}>
                        {deleteMaxed ? "🚫 No deletes left" : `🗑️ ${deletesLeft} left`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Toolbar */}
                {canEdit && (
                  <div
                    className="flex flex-wrap items-center gap-1 mb-2 pb-2 border-b border-[#d4b896] dark:border-[#3a2510]"
                    onMouseDown={e => e.preventDefault()}
                  >
                    <button className="tbtn font-bold text-[12px]" title="Bold"      onClick={() => fmt("bold")}>B</button>
                    <button className="tbtn italic text-[12px]"    title="Italic"    onClick={() => fmt("italic")}>I</button>
                    <button className="tbtn underline text-[12px]" title="Underline" onClick={() => fmt("underline")}>U</button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#5a3c20] mx-0.5" />

                    <button className="tbtn" title="Left"   onClick={() => fmt("justifyLeft")}>
                      <svg width="12" height="10" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="0" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="0" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="0" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Center" onClick={() => fmt("justifyCenter")}>
                      <svg width="12" height="10" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="2" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="1" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="3" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Right"  onClick={() => fmt("justifyRight")}>
                      <svg width="12" height="10" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="4" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="2" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="6" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#5a3c20] mx-0.5" />

                    {/* Ink picker */}
                    <div className="relative" ref={inkRef}>
                      <button
                        className="tbtn gap-1 px-2 !w-auto text-[10px] sm:text-[11px] font-medium"
                        title="Ink color"
                        onClick={() => setShowInkPicker(v => !v)}
                      >
                        <span style={{
                          display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                          background: "linear-gradient(135deg,#b91c1c,#1d4ed8,#166534)",
                          border: "1px solid #c4a882", flexShrink: 0,
                        }} />
                        <span className="hidden sm:inline">Ink</span>
                        <span className="text-[8px] text-[#b8997a]">▾</span>
                      </button>

                      {showInkPicker && (
                        <div className="ink-popover" onMouseDown={e => e.preventDefault()}>
                          <p className="text-[9px] font-bold text-[#8b6a40] dark:text-[#a07040] mb-2 uppercase tracking-widest">
                            Select text then tap colour
                          </p>
                          <div className="grid grid-cols-4 gap-1.5 mb-3">
                            {INK_COLORS.map(c => (
                              <button
                                key={c.hex} title={c.label}
                                onClick={() => applyInk(c.hex)}
                                className="group flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-[#f0d9b5] dark:hover:bg-[#2a1a0e] transition-colors"
                              >
                                <span
                                  className="w-6 h-6 rounded-full border-2 border-white dark:border-[#3a2510] shadow-sm transition-transform group-hover:scale-110"
                                  style={{ background: c.hex }}
                                />
                                <span className="text-[8px] text-[#8b6a40] dark:text-[#a07040] leading-none text-center">{c.label}</span>
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-[#e8d5b0] dark:border-[#3a2510]">
                            <label className="text-[9px] text-[#8b6a40] dark:text-[#a07040] shrink-0 font-medium">Custom:</label>
                            <input
                              type="color" value={customInk}
                              onChange={e => setCustomInk(e.target.value)}
                              className="w-7 h-7 rounded-lg border border-[#c4a882] dark:border-[#5a3c20] cursor-pointer bg-transparent p-0.5"
                            />
                            <button
                              onClick={() => applyInk(customInk)}
                              className="flex-1 py-1 rounded-lg text-[10px] font-bold bg-[#8b5e3c] hover:bg-[#6b4a2e] text-white transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1" />
                    <span className={`text-[10px] sm:text-[11px] tabular-nums font-medium ${charCount > MAX_CHARS * 0.9 ? "text-amber-600 dark:text-amber-400" : "text-[#b8997a] dark:text-[#6b5030]"}`}>
                      {charCount}/{MAX_CHARS}
                    </span>
                  </div>
                )}

                {/* Writing area */}
                <div className="relative diary-lines" style={{ minHeight: "360px" }}>
                  {loading ? (
                    <div className="flex items-center justify-center h-36 sm:h-48">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                        <p className="text-xs text-[#b8997a] dark:text-[#6b5030] font-medium diary-date-stamp">Opening page…</p>
                      </div>
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
                    />
                  )}
                </div>

                {/* Mood row */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#3a2510]">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold text-[#8b6a40] dark:text-[#a07040] mr-1 select-none">Mood:</span>
                    {MOODS.map(m => (
                      <div key={m.key} className="relative group">
                        <button
                          disabled={!canEdit}
                          onClick={() => { setMood(mood === m.key ? null : m.key); triggerAutoSave(); }}
                          className={[
                            "w-8 h-8 text-lg rounded-full flex items-center justify-center transition-all select-none",
                            mood === m.key
                              ? "bg-[#eedfc0] dark:bg-[#2a1a0e] ring-2 ring-[#8b5e3c] scale-110 shadow"
                              : "",
                            canEdit
                              ? "hover:bg-[#f0d9b5] dark:hover:bg-[#1e1408] hover:scale-105 cursor-pointer"
                              : "opacity-50 cursor-default",
                          ].join(" ")}
                        >
                          {m.emoji}
                        </button>
                        {/* Tooltip — hidden on mobile via pointer-events check */}
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-[#3a1f00] dark:bg-[#1a0c06] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 hidden sm:block">
                          {m.label}
                        </span>
                      </div>
                    ))}
                    {mood && (
                      <span className="ml-1 text-xs font-bold text-[#5c3414] dark:text-[#c4a882]">
                        {MOODS.find(m => m.key === mood)?.emoji}{" "}
                        <span className="hidden sm:inline">{MOODS.find(m => m.key === mood)?.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom action bar */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#3a2510] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs text-[#b8997a] dark:text-[#6b5030] truncate">
                      {isLocked
                        ? "🔒 Locked — no more edits"
                        : entry
                        ? `Manual saves: ${entry.editCount} / 5`
                        : "New entry"}
                    </span>
                    {deleteMsg && (
                      <span className={`text-xs font-semibold ${deleteMsg.startsWith("🚫") || deleteMsg.startsWith("❌") ? "text-red-500 dark:text-red-400" : "text-[#8b5e3c] dark:text-[#c4a882]"}`}>
                        {deleteMsg}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                    {/* Save status */}
                    <span className={`text-xs font-medium transition-opacity min-w-[48px] text-right ${saveMsg ? "text-green-600 dark:text-green-400 opacity-100" : saving ? "text-[#8b5e3c] dark:text-[#c4a882] opacity-100" : "opacity-0"}`}>
                      {saving ? "Saving…" : saveMsg}
                    </span>

                    {/* Delete button */}
                    {canDeleteBase && entry && (
                      deleteMaxed ? (
                        <button
                          disabled title="Delete limit reached"
                          className="flex items-center gap-1 opacity-40 cursor-not-allowed text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[#c4a882] dark:border-[#5a3c20] text-[#8b5e3c] dark:text-[#c4a882]"
                        >
                          🚫 <span className="hidden sm:inline">No Deletes Left</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isDeleting || !canDelete}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          🗑️
                          <span className="hidden sm:inline">Delete</span>
                          <span className="px-1 py-0.5 text-[9px] sm:text-[10px] rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 font-bold">
                            {deletesLeft}/{MAX_DELETES}
                          </span>
                        </button>
                      )
                    )}

                    {/* Save button */}
                    {canEdit && (
                      <button
                        onClick={handleManualSave}
                        disabled={saving || isLocked}
                        className="flex items-center gap-1 bg-[#8b5e3c] hover:bg-[#6b4a2e] disabled:opacity-40 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-colors shadow-sm"
                      >
                        💾 <span className="hidden xs:inline sm:inline">Save</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right binding */}
              <div className="diary-binding-right" />
            </div>

            <div className="diary-strip-bot" />
          </div>

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={goPrev}
              disabled={navCooldown || currentDate <= NINETY_AGO}
              className={[
                "flex items-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border",
                navCooldown || currentDate <= NINETY_AGO
                  ? "bg-[#f0e0c0] dark:bg-[#1e1408] text-[#c4a882] dark:text-[#5a3c20] border-[#e8d5b0] dark:border-[#2a1a0e] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#1e1408] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#5a3c20] hover:bg-[#f0d9b5] dark:hover:bg-[#2a1a0e] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}
            >
              ◀ <span className="hidden sm:inline">Prev</span>
              {navCooldown && <span className="font-mono text-[10px] sm:text-xs">{navSecs}s</span>}
            </button>

            <div className="text-center text-xs flex-1">
              {currentDate === getTODAY()
                ? <span className="font-bold text-[#8b5e3c] dark:text-[#c4a882]">✦ Today</span>
                : <span className="text-[#8b6a40] dark:text-[#a07040]">
                    {Math.abs(Math.round((strToDate(currentDate).getTime() - strToDate(getTODAY()).getTime()) / 86400000))} days ago
                  </span>
              }
            </div>

            <button
              onClick={goNext}
              disabled={navCooldown || !canGoNext}
              className={[
                "flex items-center gap-1 sm:gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border",
                navCooldown || !canGoNext
                  ? "bg-[#f0e0c0] dark:bg-[#1e1408] text-[#c4a882] dark:text-[#5a3c20] border-[#e8d5b0] dark:border-[#2a1a0e] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#1e1408] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#5a3c20] hover:bg-[#f0d9b5] dark:hover:bg-[#2a1a0e] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}
            >
              <span className="hidden sm:inline">Next</span> ▶
              {navCooldown && <span className="font-mono text-[10px] sm:text-xs">{navSecs}s</span>}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}