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
}
interface DiaryHeading { text: string; isDefault: boolean; }
interface SearchResult { date: string; snippet: string; pageNum: number; }

const MOODS = [
  { key: "happy",      emoji: "🙂", label: "Happy" },
  { key: "neutral",    emoji: "😊", label: "Neutral" },
  { key: "joy",        emoji: "😄", label: "Joyful" },
  { key: "wink",       emoji: "😉", label: "Winky" },
  { key: "productive", emoji: "🔥", label: "Productive" },
  { key: "tired",      emoji: "😴", label: "Tired" },
  { key: "sad",        emoji: "😔", label: "Sad" },
  { key: "grateful",   emoji: "🙏", label: "Grateful" },
];
const INK_COLORS = [
  { hex: "#b91c1c", label: "Red" },
  { hex: "#1d4ed8", label: "Blue" },
  { hex: "#1c1410", label: "Black" },
  { hex: "#4b5563", label: "Gray" },
];
const MAX_CHARS = 1500;
// FIX #3: editCount only increments on MANUAL save, not auto-save
// Auto-save uses a "dirty" flag approach — only one DB write per session per page
const NAV_COOLDOWN_MS = 5000;
const CACHE_WINDOW = 2;

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
    weekday:"long", day:"numeric", month:"long", year:"numeric", timeZone:"UTC"
  });
}
function fmtShort(s: string) {
  return strToDate(s).toLocaleDateString("en-IN", {
    day:"2-digit", month:"short", year:"numeric", timeZone:"UTC"
  });
}

// ─────────────────────────────────────────────────────────────
// CLIENT CACHE
// ─────────────────────────────────────────────────────────────
const pageCache = new Map<string, DiaryEntry | null>();

// ─────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────
async function apiGet(date: string): Promise<DiaryEntry | null> {
  if (pageCache.has(date)) return pageCache.get(date) ?? null;
  const r = await fetch(`/api/diary/entry?date=${date}`);
  if (!r.ok) { pageCache.set(date, null); return null; }
  const { entry } = await r.json();
  pageCache.set(date, entry ?? null);
  return entry ?? null;
}
async function apiRange(s: string, e: string): Promise<DiaryEntry[]> {
  const r = await fetch(`/api/diary/range?startDate=${s}&endDate=${e}`);
  if (!r.ok) return [];
  const { entries } = await r.json();
  return entries ?? [];
}
async function apiCreate(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(p)
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}
async function apiPatch(p: object): Promise<DiaryEntry | null> {
  const r = await fetch("/api/diary/entry", {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(p)
  });
  if (!r.ok) return null;
  return (await r.json()).entry ?? null;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function DiaryPage() {
  const TODAY       = todayStr();
  const NINETY_AGO  = addDays(TODAY, -90);

  // Core state
  const [currentDate, setCurrentDate]   = useState(TODAY);
  const [entry, setEntry]               = useState<DiaryEntry | null>(null);
  const [heading, setHeading]           = useState("");
  const [mood, setMood]                 = useState<string | null>(null);
  const [charCount, setCharCount]       = useState(0);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState("");

  // FIX #3: separate dirty tracking so auto-save doesn't increment editCount
  const isDirtyRef     = useRef(false);   // content changed since last save
  const isNewEntryRef  = useRef(true);    // whether entry exists in DB yet
  const lastSavedHtml  = useRef("");      // last HTML actually sent to DB

  // Navigation
  const [navCooldown, setNavCooldown]   = useState(false);
  const [navSecs, setNavSecs]           = useState(0);
  const [isFlipping, setIsFlipping]     = useState(false);
  const [flipDir, setFlipDir]           = useState<"left"|"right"|null>(null);

  // Pages / meta
  const [allDates, setAllDates]         = useState<string[]>([]);
  const [totalPages, setTotalPages]     = useState(0);
  const [jumpInput, setJumpInput]       = useState("");

  // Calendar
  const [showCal, setShowCal]           = useState(false);
  const [calView, setCalView]           = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  // Headings — FIX #4: fetched once, applied globally as default
  const [headings, setHeadings]         = useState<DiaryHeading[]>([]);
  const [showHeadingPicker, setShowHPicker] = useState(false);
  const [showSettingsModal, setShowSettings] = useState(false);
  const [newHeadingText, setNewHText]   = useState("");

  // Search — FIX #5
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch]     = useState(false);
  const searchTimerRef                  = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Recent entries for quick-nav cards — FIX #6
  const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);

  // Refs
  const editorRef    = useRef<HTMLDivElement>(null);
  const cooldownRef  = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoSaveRef  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const calRef       = useRef<HTMLDivElement>(null);

  // Derived
  const isLocked  = entry?.isLocked ?? false;
  const editsLeft = 5 - (entry?.editCount ?? 0);
  const canEdit   = !isFuture(currentDate) && currentDate >= NINETY_AGO && !isLocked;
  const canGoNext = !isFuture(addDays(currentDate, 1));

  const currentPageIndex = useMemo(() => {
    const i = allDates.indexOf(currentDate);
    return i === -1 ? allDates.length : i;
  }, [allDates, currentDate]);

  // ── Outside click closes calendar / heading picker ───────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Mount: load meta + settings ──────────────────────────────
  useEffect(() => {
    (async () => {
      const [mr, sr, rr] = await Promise.all([
        fetch("/api/diary/meta"),
        fetch("/api/diary/settings"),
        fetch(`/api/diary/range?startDate=${addDays(TODAY,-5)}&endDate=${TODAY}`)
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
        // FIX #4: apply default heading immediately
        const def = hs.find((h: DiaryHeading) => h.isDefault);
        if (def) setHeading(def.text);
      }
      if (rr.ok) {
        const { entries } = await rr.json();
        setRecentEntries((entries ?? []).slice(-5).reverse());
      }
    })();
  }, []);

  // ── Load entry on date change ─────────────────────────────────
  useEffect(() => {
    loadPage(currentDate);
    prefetch(currentDate);
    setShowCal(false);
    setShowHPicker(false);
  }, [currentDate]);

  async function loadPage(date: string) {
    setLoading(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    const e = await apiGet(date);
    setEntry(e);
    setMood(e?.mood ?? null);

    // FIX #4: use saved heading OR default heading
    if (e?.heading) {
      setHeading(e.heading);
    } else {
      const def = headings.find(h => h.isDefault);
      setHeading(def?.text ?? "");
    }

    const html = e?.content ?? "";
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      setCharCount(editorRef.current.innerText.replace(/\n/g,"").length);
    }
    lastSavedHtml.current  = html;
    isNewEntryRef.current  = !e;
    isDirtyRef.current     = false;
    setLoading(false);
  }

  async function prefetch(date: string) {
    const toFetch: string[] = [];
    for (let i = -CACHE_WINDOW; i <= CACHE_WINDOW; i++) {
      if (i === 0) continue;
      const d = addDays(date, i);
      if (!isFuture(d) && !pageCache.has(d)) toFetch.push(d);
    }
    if (!toFetch.length) return;
    const entries = await apiRange(toFetch[0], toFetch[toFetch.length-1]);
    toFetch.forEach(d => {
      if (!pageCache.has(d)) {
        pageCache.set(d, entries.find(e => dateToStr(new Date(e.entryDate)) === d) ?? null);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // FIX #3: SAVE LOGIC
  // editCount only increments on MANUAL save.
  // Auto-save: if entry doesn't exist yet → POST (editCount=0). 
  //            if entry exists → only PATCH if content actually changed, and does NOT increment editCount.
  //            Manual save → always PATCH and increments editCount.
  // ─────────────────────────────────────────────────────────────
  const performSave = useCallback(async (date: string, isManual: boolean) => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const currentHeading = heading;
    const currentMood = mood;

    // Skip if nothing to save
    if (!html.trim() && !currentMood && !currentHeading) return;
    if (entry?.isLocked) return;

    // For auto-save: skip if content hasn't changed since last save
    if (!isManual && html === lastSavedHtml.current && !isNewEntryRef.current) return;

    setSaving(true);
    let saved: DiaryEntry | null = null;
    const cached = pageCache.get(date);

    if (!cached) {
      // Create new — editCount starts at 0, never incremented by auto-save
      saved = await apiCreate({ date, content: html, heading: currentHeading, textColor: "black", mood: currentMood });
      if (saved) {
        pageCache.set(date, saved);
        isNewEntryRef.current = false;
        setAllDates(prev => prev.includes(date) ? prev : [...prev, date].sort());
        setTotalPages(p => p + 1);
      }
    } else {
      // Update existing entry
      // FIX #3: only increment editCount on manual save
      const payload: Record<string, unknown> = {
        date, content: html, heading: currentHeading, mood: currentMood,
        incrementEdit: isManual, // API must respect this flag
      };
      saved = await apiPatch(payload);
    }

    setSaving(false);
    if (saved) {
      setEntry(saved);
      pageCache.set(date, saved);
      lastSavedHtml.current = html;
      isDirtyRef.current = false;
      if (isManual) {
        setSaveMsg("Saved ✓");
        setTimeout(() => setSaveMsg(""), 2500);
      }
    }
  }, [heading, mood, entry]);

  function triggerAutoSave() {
    isDirtyRef.current = true;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => performSave(currentDate, false), 4000);
  }

  function handleManualSave() { performSave(currentDate, true); }

  // ── Editor input ──────────────────────────────────────────────
  function handleInput() {
    if (!editorRef.current) return;
    const len = editorRef.current.innerText.replace(/\n/g,"").length;
    if (len > MAX_CHARS) { document.execCommand("undo"); return; }
    setCharCount(len);
    triggerAutoSave();
  }

  // ── Formatting ────────────────────────────────────────────────
  function fmt(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    // Re-focus and re-apply to keep selection — fixes the align bug
    // where execCommand would deselect everything
  }
  function applyInk(hex: string) {
    editorRef.current?.focus();
    document.execCommand("foreColor", false, hex);
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
      if (s <= 0) { clearInterval(cooldownRef.current!); setNavCooldown(false); setNavSecs(0); }
    }, 1000);
  }

  function navTo(date: string, dir: "left"|"right") {
    if (navCooldown || isFlipping || isFuture(date)) return;
    if (isDirtyRef.current) performSave(currentDate, false);
    setFlipDir(dir); setIsFlipping(true);
    setTimeout(() => { setCurrentDate(date); setIsFlipping(false); setFlipDir(null); }, 300);
    startCooldown();
  }

  function goPrev() {
    const idx = allDates.indexOf(currentDate);
    if (idx > 0) { navTo(allDates[idx-1], "left"); return; }
    const p = addDays(currentDate, -1);
    if (p >= NINETY_AGO) navTo(p, "left");
  }
  function goNext() {
    const n = addDays(currentDate, 1);
    if (!isFuture(n)) navTo(n, "right");
  }
  function jumpTo() {
    const n = parseInt(jumpInput, 10);
    if (isNaN(n) || n < 1 || n > allDates.length) return;
    const d = allDates[n-1];
    if (!isFuture(d)) { setCurrentDate(d); setJumpInput(""); }
  }

  // ── FIX #5: Search ───────────────────────────────────────────
  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/diary/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const { results } = await res.json();
      setSearchResults((results ?? []).slice(0, 3));
    }, 400);
  }

  // ── Settings / Headings ───────────────────────────────────────
  async function persistHeadings(updated: DiaryHeading[]) {
    setHeadings(updated);
    await fetch("/api/diary/settings", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ headings: updated }),
    });
  }

  // ── Calendar cells ────────────────────────────────────────────
  function renderCal(): React.ReactElement[] {
    const { year, month } = calView;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const cells: React.ReactElement[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`_${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const cur = ds === currentDate, tod = ds === TODAY;
      const dis = isFuture(ds) || ds < NINETY_AGO;
      const has = allDates.includes(ds);
      cells.push(
        <button key={d} disabled={dis}
          onClick={() => { if (!dis) { setCurrentDate(ds); setShowCal(false); } }}
          className={[
            "relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all select-none",
            dis ? "text-[#c8b89a] cursor-not-allowed" : "hover:bg-[#e8d5b0] cursor-pointer text-[#4a3520]",
            cur ? "bg-[#8b5e3c]! text-white! shadow-md" : "",
            tod && !cur ? "ring-2 ring-[#8b5e3c]" : "",
          ].join(" ")}
        >
          {d}
          {has && !cur && !dis && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8b5e3c]" />}
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
      {/* ── Styles ── */}
      <style>{`
        /* FIX #7: diary bg adapts to theme, outer bg uses theme variable */
        .diary-outer { background: var(--background); }

        /* Diary book texture */
        .diary-book {
          background: #f5ead6;
          box-shadow:
            0 0 0 1px #c4a882,
            4px 0 8px rgba(0,0,0,.12),
            0 20px 60px rgba(80,40,10,.25),
            inset 0 1px 0 rgba(255,255,255,.6);
        }
        .dark .diary-book {
          background: #2a1f12;
          box-shadow:
            0 0 0 1px #6b4c2a,
            4px 0 8px rgba(0,0,0,.4),
            0 20px 60px rgba(0,0,0,.5),
            inset 0 1px 0 rgba(255,255,255,.05);
        }

        /* Binding spine */
        .diary-spine {
          background: linear-gradient(180deg, #7a4a20 0%, #5c3414 40%, #7a4a20 70%, #4a2810 100%);
          box-shadow: inset -2px 0 4px rgba(0,0,0,.3), inset 2px 0 2px rgba(255,255,255,.1);
        }

        /* Lined paper */
        .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px,
            #d4b896 29px, #d4b896 30px
          );
          background-position-y: 0;
        }
        .dark .diary-lines {
          background-image: repeating-linear-gradient(
            transparent 0px, transparent 29px,
            #4a3520 29px, #4a3520 30px
          );
        }

        /* Editor */
        .diary-editor {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 15px;
          line-height: 30px;
          color: #1c0f00;
          caret-color: #1c0f00;
          outline: none;
          background: transparent;
          word-break: break-word;
          white-space: pre-wrap;
          padding: 4px 0 0 0;
        }
        .dark .diary-editor { color: #e8d5b0; caret-color: #e8d5b0; }
        .diary-editor:empty::before {
          content: attr(data-placeholder);
          color: #b8997a; font-style: italic; pointer-events: none;
        }

        /* Toolbar buttons */
        .tbtn {
          display:inline-flex; align-items:center; justify-content:center;
          width:28px; height:28px; border-radius:5px;
          border:1px solid #c4a882; background:#fdf5e6;
          color:#5c3414; font-size:12px; cursor:pointer;
          transition: background .12s, border-color .12s;
          user-select:none; flex-shrink:0;
        }
        .tbtn:hover { background:#f0d9b5; border-color:#8b5e3c; }
        .tbtn:active { background:#e0c090; }
        .dark .tbtn { background:#3a2a18; border-color:#6b4c2a; color:#e8d5b0; }
        .dark .tbtn:hover { background:#4a3520; border-color:#a07040; }

        /* Page flip */
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

        /* Recent entry cards */
        .entry-card {
          background: #fdf5e6; border: 1px solid #c4a882;
          border-radius: 8px; padding: 10px 12px; cursor: pointer;
          transition: transform .15s, box-shadow .15s;
        }
        .dark .entry-card { background: #2a1f12; border-color: #6b4c2a; }
        .entry-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.12); }

        /* Search results */
        .search-result {
          padding: 8px 12px; border-bottom: 1px solid #e8d5b0;
          cursor: pointer; transition: background .1s;
        }
        .dark .search-result { border-color: #4a3520; }
        .search-result:hover { background: #f0d9b5; }
        .dark .search-result:hover { background: #3a2a18; }
        .search-result:last-child { border-bottom: none; }
      `}</style>

      {/* ── Heading settings modal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-[#1a1208] rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-[#c4a882] dark:border-[#6b4c2a]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-[#3a1f00] dark:text-[#e8d5b0] mb-1">📖 Diary Headings</h2>
            <p className="text-xs text-[#8b6a40] dark:text-[#a07040] mb-3">One heading can be set as default — it applies to all new pages</p>
            <div className="space-y-2 mb-3 max-h-44 overflow-y-auto">
              {headings.length === 0 && <p className="text-xs text-[#b8997a] italic text-center py-3">No headings yet</p>}
              {headings.map((h, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#fdf5e6] dark:bg-[#2a1f12] rounded-lg px-3 py-2 border border-[#e8d5b0] dark:border-[#4a3520]">
                  <span className="flex-1 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] truncate">{h.text}</span>
                  <button onClick={() => persistHeadings(headings.map((hh,j) => ({...hh, isDefault: j===i})))}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${h.isDefault ? "bg-[#8b5e3c] text-white border-[#8b5e3c]" : "border-[#c4a882] text-[#8b6a40] hover:border-[#8b5e3c]"}`}>
                    {h.isDefault ? "✓ Default" : "Set Default"}
                  </button>
                  <button onClick={() => persistHeadings(headings.filter((_,j) => j!==i))} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newHeadingText} onChange={e => setNewHText(e.target.value.slice(0,50))}
                placeholder="HAR HAR MAHADEV…" maxLength={50}
                className="flex-1 text-sm border border-[#c4a882] rounded-lg px-3 py-2 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
                onKeyDown={e => { if (e.key==="Enter" && newHeadingText.trim()) { persistHeadings([...headings,{text:newHeadingText.trim(),isDefault:false}]); setNewHText(""); } }}
              />
              <button onClick={() => { if (!newHeadingText.trim()) return; persistHeadings([...headings,{text:newHeadingText.trim(),isDefault:false}]); setNewHText(""); }}
                className="bg-[#8b5e3c] hover:bg-[#6b4a2e] text-white text-sm px-3 rounded-lg font-medium transition-colors">Add</button>
            </div>
            <button onClick={() => setShowSettings(false)}
              className="w-full py-2 rounded-xl bg-[#f0d9b5] dark:bg-[#3a2a18] text-[#5c3414] dark:text-[#e8d5b0] text-sm font-medium transition-colors hover:bg-[#e0c090]">Done</button>
          </div>
        </div>
      )}

      {/* ── Page layout — FIX #7: outer uses theme bg, no amber ── */}
      <div className="diary-outer min-h-screen py-4 px-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-3">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#3a1f00] dark:text-[#e8d5b0] flex items-center gap-2">
              <span className="text-2xl">📔</span> Diary
            </h1>

            {/* FIX #5: Search bar */}
            <div className="relative flex-1 max-w-xs">
              <input
                value={searchQuery}
                onChange={e => { handleSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                placeholder="🔍 Search diary entries…"
                className="w-full text-sm border border-[#c4a882] dark:border-[#6b4c2a] rounded-xl px-3 py-2 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] placeholder:text-[#b8997a] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
              />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-white dark:bg-[#1a1208] rounded-xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] overflow-hidden">
                  {searchResults.map((r, i) => (
                    <div key={i} className="search-result" onClick={() => { setCurrentDate(r.date); setShowSearch(false); setSearchQuery(""); }}>
                      <div className="text-xs font-bold text-[#8b5e3c] dark:text-[#c4a882]">{fmtShort(r.date)}</div>
                      <div className="text-xs text-[#5c3414] dark:text-[#a07040] mt-0.5 line-clamp-2">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowSettings(true)}
              className="text-xs font-semibold text-[#5c3414] dark:text-[#c4a882] bg-[#fdf5e6] dark:bg-[#2a1f12] border border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] px-3 py-2 rounded-xl transition-colors">
              ⚙ Headings
            </button>
          </div>

          {/* ── Calendar + page nav bar ── */}
          <div className="flex flex-wrap items-center gap-2 bg-[#fdf5e6] dark:bg-[#2a1f12] rounded-2xl border border-[#c4a882] dark:border-[#6b4c2a] px-4 py-2.5">
            {/* Calendar toggle */}
            <div className="relative" ref={calRef}>
              <button onClick={() => setShowCal(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-[#3a1f00] dark:text-[#e8d5b0] hover:text-[#8b5e3c] transition-colors">
                📅 <span>{fmtShort(currentDate)}</span> <span className="text-[#b8997a] text-xs">{showCal?"▴":"▾"}</span>
              </button>
              {showCal && (
                <div className="absolute top-full left-0 mt-2 z-40 bg-[#fdf5e6] dark:bg-[#1a1208] rounded-2xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] p-3 w-64">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setCalView(c => { const m=c.month===0?11:c.month-1; return {year:c.month===0?c.year-1:c.year,month:m}; })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#3a2a18] text-[#8b5e3c] transition-colors text-lg">‹</button>
                    <span className="text-xs font-bold text-[#3a1f00] dark:text-[#e8d5b0]">
                      {new Date(calView.year, calView.month).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}
                    </span>
                    <button onClick={() => setCalView(c => { const m=c.month===11?0:c.month+1; return {year:c.month===11?c.year+1:c.year,month:m}; })}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8d5b0] dark:hover:bg-[#3a2a18] text-[#8b5e3c] transition-colors text-lg">›</button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["S","M","T","W","T","F","S"].map((l,i) => (
                      <div key={i} className="flex items-center justify-center h-7 text-xs font-bold text-[#b8997a]">{l}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">{renderCal()}</div>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Page X of Y + jump */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8b6a40] dark:text-[#a07040]">
                Page <strong className="text-[#5c3414] dark:text-[#c4a882]">{currentPageIndex+1}</strong> of <strong className="text-[#5c3414] dark:text-[#c4a882]">{displayTotal}</strong>
              </span>
              <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && jumpTo()} placeholder="Go" min={1} max={allDates.length}
                className="w-14 text-xs text-center border border-[#c4a882] dark:border-[#6b4c2a] rounded-lg px-2 py-1.5 bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#3a1f00] dark:text-[#e8d5b0] focus:outline-none focus:ring-2 focus:ring-[#8b5e3c]"
              />
              <button onClick={jumpTo} className="text-xs bg-[#8b5e3c] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#6b4a2e] transition-colors font-bold">→</button>
            </div>
          </div>

          {/* ── DIARY BOOK — FIX #8: looks like a real physical diary ── */}
          <div className={["relative rounded-2xl overflow-hidden diary-book",
            isFlipping ? (flipDir==="right"?"flip-right":"flip-left") : ""].join(" ")}>

            {/* Leather cover texture strip - top */}
            <div className="h-3 w-full" style={{background:"linear-gradient(180deg,#6b3a1f 0%,#8b5e3c 100%)"}} />

            <div className="flex">
              {/* ── Binding spine ── */}
              <div className="diary-spine w-8 sm:w-10 shrink-0 flex flex-col items-center justify-around py-8 gap-3">
                {[...Array(9)].map((_,i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-[#2a1208] border border-[#1a0c04] shadow-inner" />
                ))}
              </div>

              {/* ── Page content ── */}
              <div className="flex-1 px-4 sm:px-6 pt-4 pb-3">

                {/* ── Page header: heading left, date right ── */}
                <div className="flex items-start justify-between gap-3 mb-3 pb-2 border-b border-[#d4b896] dark:border-[#4a3520]">
                  {/* FIX #4: heading applied globally */}
                  <div className="relative flex-1">
                    {canEdit ? (
                      <button onClick={() => setShowHPicker(v => !v)}
                        className={[
                          "text-left font-bold tracking-wide transition-all leading-tight",
                          "text-lg sm:text-xl",
                          heading
                            ? "text-[#8b2500] dark:text-[#d4845a]"
                            : "text-[#b8997a] dark:text-[#6b5030] italic font-normal text-base",
                        ].join(" ")}
                        style={{fontFamily:"Georgia, 'Times New Roman', serif"}}>
                        {heading || "Add heading…"}
                        <span className="ml-1 text-sm text-[#b8997a] not-italic font-normal">▾</span>
                      </button>
                    ) : (
                      heading ? <p className="text-lg font-bold text-[#8b2500] dark:text-[#d4845a]" style={{fontFamily:"Georgia,'Times New Roman',serif"}}>{heading}</p> : null
                    )}
                    {showHeadingPicker && canEdit && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-[#fdf5e6] dark:bg-[#1a1208] rounded-xl shadow-xl border border-[#c4a882] dark:border-[#6b4c2a] py-1 w-56 max-h-52 overflow-y-auto">
                        <button onClick={() => { setHeading(""); setShowHPicker(false); }}
                          className="w-full text-left px-4 py-2 text-xs text-[#b8997a] hover:bg-[#f0d9b5] dark:hover:bg-[#2a1f12] italic">— No heading —</button>
                        {headings.length === 0 && <p className="px-4 py-2 text-xs text-[#b8997a]">Add headings in ⚙ settings</p>}
                        {headings.map((h, i) => (
                          <button key={i} onClick={() => { setHeading(h.text); setShowHPicker(false); triggerAutoSave(); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-[#f0d9b5] dark:hover:bg-[#2a1f12] text-[#8b2500] dark:text-[#d4845a] transition-colors ${heading===h.text?"bg-[#f0d9b5] dark:bg-[#2a1f12]":""}`}>
                            {h.text}
                            {h.isDefault && <span className="ml-2 text-xs text-[#b8997a] font-normal">default</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Date + status — top right */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-[#5c3414] dark:text-[#c4a882] bg-[#eedfc0] dark:bg-[#3a2a18] px-2.5 py-1.5 rounded-lg leading-tight border border-[#c4a882] dark:border-[#6b4c2a]">
                      {fmtLong(currentDate)}
                    </div>
                    {isLocked && <p className="text-xs text-red-500 font-bold mt-1">🔒 Locked</p>}
                    {!isLocked && entry && <p className="text-xs text-[#b8997a] mt-1">{editsLeft} edit{editsLeft!==1?"s":""} left</p>}
                  </div>
                </div>

                {/* ── Toolbar ── */}
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-[#d4b896] dark:border-[#4a3520]"
                    onMouseDown={e => e.preventDefault()}>
                    {/* B I U */}
                    <button className="tbtn font-bold text-[13px]" title="Bold (Ctrl+B)" onClick={() => fmt("bold")}>B</button>
                    <button className="tbtn italic text-[13px]" title="Italic (Ctrl+I)" onClick={() => fmt("italic")}>I</button>
                    <button className="tbtn underline text-[13px]" title="Underline (Ctrl+U)" onClick={() => fmt("underline")}>U</button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#6b4c2a] mx-0.5" />

                    {/* Alignment — proper SVG icons */}
                    <button className="tbtn" title="Align Left" onClick={() => fmt("justifyLeft")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="0" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="0" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="0" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Center" onClick={() => fmt("justifyCenter")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="2" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="1" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="3" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>
                    <button className="tbtn" title="Align Right" onClick={() => fmt("justifyRight")}>
                      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
                        <rect x="0" y="0" width="13" height="1.5" rx=".75"/>
                        <rect x="4" y="3.5" width="9" height="1.5" rx=".75"/>
                        <rect x="2" y="7" width="11" height="1.5" rx=".75"/>
                        <rect x="6" y="10" width="7" height="1" rx=".5"/>
                      </svg>
                    </button>

                    <div className="w-px h-5 bg-[#c4a882] dark:bg-[#6b4c2a] mx-0.5" />

                    {/* Ink colors */}
                    <div className="flex items-center gap-1 bg-[#eedfc0] dark:bg-[#3a2a18] border border-[#c4a882] dark:border-[#6b4c2a] rounded-lg px-2 py-1">
                      <span className="text-[11px] text-[#8b6a40] dark:text-[#a07040] mr-1 font-medium select-none">Ink</span>
                      {INK_COLORS.map(c => (
                        <button key={c.hex} title={`${c.label} — select text first`}
                          onClick={() => applyInk(c.hex)}
                          className="w-5 h-5 rounded-full border-2 border-transparent hover:border-[#5c3414] hover:scale-110 transition-all"
                          style={{backgroundColor: c.hex}} />
                      ))}
                    </div>

                    <div className="flex-1" />
                    <span className="text-[11px] text-[#b8997a] tabular-nums">{charCount}/{MAX_CHARS}</span>
                  </div>
                )}

                {/* ── FIX #2: Writing area — 20 lines tall ── */}
                <div className="relative diary-lines" style={{minHeight:"600px"}}>
                  {loading ? (
                    <div className="flex items-center justify-center h-40">
                      <div className="w-5 h-5 rounded-full border-2 border-[#8b5e3c] border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div ref={editorRef}
                      contentEditable={canEdit}
                      suppressContentEditableWarning
                      className="diary-editor"
                      data-placeholder={canEdit ? "Start writing…" : "No entry for this date."}
                      onInput={handleInput}
                      style={{minHeight:"600px", padding:"4px 4px 20px"}}
                    />
                  )}
                </div>

                {/* ── Mood row ── */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#4a3520]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#8b6a40] dark:text-[#a07040] mr-1 select-none">Mood:</span>
                    {MOODS.map(m => (
                      <div key={m.key} className="relative group">
                        <button disabled={!canEdit}
                          onClick={() => { setMood(mood===m.key?null:m.key); triggerAutoSave(); }}
                          className={[
                            "w-9 h-9 text-xl rounded-full flex items-center justify-center transition-all select-none",
                            mood===m.key ? "bg-[#eedfc0] dark:bg-[#3a2a18] ring-2 ring-[#8b5e3c] scale-110 shadow" : "",
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
                        {MOODS.find(m=>m.key===mood)?.emoji} {MOODS.find(m=>m.key===mood)?.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Bottom bar: save ── */}
                <div className="mt-3 pt-2.5 border-t border-[#d4b896] dark:border-[#4a3520] flex items-center justify-between gap-3">
                  <span className="text-xs text-[#b8997a]">
                    {isLocked ? "🔒 Locked — no more edits" : entry ? `Manual saves: ${entry.editCount} / 5` : "New entry"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium transition-opacity min-w-[52px] text-right ${saveMsg?"text-green-600 opacity-100":saving?"text-[#8b5e3c] opacity-100":"opacity-0"}`}>
                      {saving?"Saving…":saveMsg}
                    </span>
                    {canEdit && (
                      <button onClick={handleManualSave} disabled={saving||isLocked}
                        className="flex items-center gap-1.5 bg-[#8b5e3c] hover:bg-[#6b4a2e] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
                        💾 Save
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right decorative edge ── */}
              <div className="w-2 shrink-0" style={{background:"linear-gradient(180deg,#c4a882 0%,#e8d5b0 50%,#c4a882 100%)"}} />
            </div>

            {/* Leather cover strip — bottom */}
            <div className="h-3 w-full" style={{background:"linear-gradient(0deg,#6b3a1f 0%,#8b5e3c 100%)"}} />
          </div>

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={goPrev} disabled={navCooldown || currentDate <= NINETY_AGO}
              className={["flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                navCooldown || currentDate <= NINETY_AGO
                  ? "bg-[#f0e0c0] dark:bg-[#2a1f12] text-[#c4a882] border-[#e8d5b0] dark:border-[#4a3520] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}>
              ◀ Prev {navCooldown && <span className="font-mono text-xs">{navSecs}s</span>}
            </button>

            <div className="text-center text-xs">
              {currentDate===TODAY
                ? <span className="font-bold text-[#8b5e3c] dark:text-[#c4a882]">✦ Today</span>
                : <span className="text-[#8b6a40] dark:text-[#a07040]">{Math.abs(Math.round((strToDate(currentDate).getTime()-strToDate(TODAY).getTime())/86400000))} days ago</span>
              }
              {navCooldown && (
                <div className="mt-1.5 h-1 w-20 mx-auto bg-[#e8d5b0] dark:bg-[#3a2a18] rounded-full overflow-hidden">
                  <div className="h-full bg-[#8b5e3c] rounded-full transition-all ease-linear"
                    style={{width:`${((NAV_COOLDOWN_MS/1000-navSecs)/(NAV_COOLDOWN_MS/1000))*100}%`, transitionDuration:"1s"}} />
                </div>
              )}
            </div>

            <button onClick={goNext} disabled={navCooldown || !canGoNext}
              className={["flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                navCooldown || !canGoNext
                  ? "bg-[#f0e0c0] dark:bg-[#2a1f12] text-[#c4a882] border-[#e8d5b0] dark:border-[#4a3520] cursor-not-allowed"
                  : "bg-[#fdf5e6] dark:bg-[#2a1f12] text-[#5c3414] dark:text-[#c4a882] border-[#c4a882] dark:border-[#6b4c2a] hover:bg-[#f0d9b5] hover:border-[#8b5e3c] shadow-sm active:scale-95",
              ].join(" ")}>
              Next ▶ {!canGoNext && <span className="text-[#c4a882] text-xs">🚫</span>}
            </button>
          </div>

          {/* ── FIX #6: Recent 5 diary entries as quick-nav cards ── */}
          {recentEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[#8b6a40] dark:text-[#a07040] uppercase tracking-wider mb-2">Recent Entries</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentEntries.map((re, i) => {
                  const rDate = dateToStr(new Date(re.entryDate));
                  const isCurrent = rDate === currentDate;
                  return (
                    <div key={i} onClick={() => setCurrentDate(rDate)}
                      className={`entry-card shrink-0 w-44 ${isCurrent ? "ring-2 ring-[#8b5e3c]" : ""}`}>
                      <div className="text-[11px] font-bold text-[#8b5e3c] dark:text-[#c4a882] mb-1">{fmtShort(rDate)}</div>
                      {re.mood && <div className="text-base mb-1">{MOODS.find(m=>m.key===re.mood)?.emoji}</div>}
                      <p className="text-[11px] text-[#5c3414] dark:text-[#a07040] line-clamp-3 leading-relaxed"
                        dangerouslySetInnerHTML={{__html: re.content?.replace(/<[^>]+>/g," ").slice(0,80)+"…"}} />
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {/* FIX #6: show ±2 nearby pages */}
                        {[-2,-1,1,2].map(offset => {
                          const neighborDate = addDays(rDate, offset);
                          const neighborIdx  = allDates.indexOf(neighborDate);
                          if (neighborIdx < 0) return null;
                          return (
                            <button key={offset} onClick={e => { e.stopPropagation(); setCurrentDate(neighborDate); }}
                              className="text-[10px] bg-[#eedfc0] dark:bg-[#3a2a18] text-[#5c3414] dark:text-[#c4a882] rounded px-1.5 py-0.5 hover:bg-[#e0c090] transition-colors border border-[#c4a882] dark:border-[#6b4c2a]">
                              {offset>0?"+":""}{offset}d
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}