// app/dashboard/holiday/MarkHoliday.tsx

"use client";

import {
  useCallback, useEffect, useImperativeHandle,
  forwardRef, useRef, useState,
} from "react";
import toast from "react-hot-toast";
import {
  Palmtree, ChevronLeft, ChevronRight, RefreshCw,
  Trash2, CalendarDays, Info, X, Lock, AlertTriangle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// RULES (must match date-wise page exactly)
// VIEW   → any date in history
// ADD    → only within last 90 days
// EDIT   → only within last 30 days
// ─────────────────────────────────────────────────────────────────
const EDIT_WINDOW  = 30;
const ENTRY_WINDOW = 90;

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysAgo(ymd: string): number {
  const today = localToday();
  const [ty, tm, td] = today.split("-").map(Number);
  const [fy, fm, fd] = ymd.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function prettyDate(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function shortMonthDay(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
  });
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─────────────────────────────────────────────────────────────────
// CALENDAR
// ─────────────────────────────────────────────────────────────────
export interface HolidayCalHandle { refresh: () => void; }

const HolidayCalendar = forwardRef<HolidayCalHandle, {
  selected:      string;
  onSelect:      (ymd: string) => void;
  holidaySet:    Set<number>;
  loggedSet:     Set<number>;
  dotsLoading:   boolean;
  onMonthChange: (y: number, m0: number) => void;
  viewY:         number;
  viewM:         number; // 0-indexed
}>(function HolidayCalendar(
  { selected, onSelect, holidaySet, loggedSet, dotsLoading, onMonthChange, viewY, viewM },
  ref
) {
  const today    = localToday();
  const [ty, tm] = today.split("-").map(Number);
  const [selY, selM, selD] = selected.split("-").map(Number);

  const canGoNext = viewY < ty || (viewY === ty && viewM < tm - 1);

  function navMonth(delta: number) {
    let nm = viewM + delta, ny = viewY;
    if (nm < 0)  { nm = 11; ny--; }
    if (nm > 11) { nm = 0;  ny++; }
    onMonthChange(ny, nm);
  }

  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const daysInMonth  = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {[
          { color: "#22d3a0",        label: "Logged"  },
          { color: "#f59e0b",        label: "Holiday" },
          { color: "var(--border2)", label: "Weekend" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{label}</span>
          </div>
        ))}
        {dotsLoading && (
          <RefreshCw size={10} className="animate-spin ml-auto" style={{ color: "var(--text3)" }} />
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navMonth(-1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer border-none transition-all"
          style={{ background: "var(--bg)", color: "var(--text2)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text2)"; }}>
          <ChevronLeft size={15} />
        </button>

        <p className="font-bold text-[15px]" style={{ color: "var(--text)" }}>
          {MONTHS[viewM]} {viewY}
        </p>

        <button onClick={() => canGoNext && navMonth(1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center border-none transition-all"
          style={{
            background: "var(--bg)",
            color:   canGoNext ? "var(--text2)" : "var(--text4)",
            cursor:  canGoNext ? "pointer" : "not-allowed",
            opacity: canGoNext ? 1 : 0.4,
          }}
          onMouseEnter={e => { if (canGoNext) (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = canGoNext ? "var(--text2)" : "var(--text4)"; }}>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <p key={d} className="text-center font-mono text-[10px] py-1"
            style={{ color: "var(--text3)" }}>{d}</p>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;

          const ymd       = `${viewY}-${pad2(viewM + 1)}-${pad2(day)}`;
          const isToday   = ymd === today;
          const isSel     = selY === viewY && selM - 1 === viewM && selD === day;
          const isFuture  = ymd > today;
          const isHol     = !isFuture && holidaySet.has(day);
          const isLogged  = !isFuture && loggedSet.has(day) && !isHol;
          const dow       = new Date(viewY, viewM, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isMissing = !isFuture && !isToday && !isLogged && !isWeekend && !isHol;

          // Visual hint: date is older than edit window but selectable for viewing
          const age          = daysAgo(ymd);
          const isOldNoEdit  = age > EDIT_WINDOW && !isHol;
          const isDeepPast   = age > ENTRY_WINDOW;

          const dotColor = isHol     ? "#f59e0b"
                         : isLogged  ? "#22d3a0"
                         : isMissing ? "#f87171"
                         : isWeekend ? "var(--border2)"
                         : "transparent";

          return (
            <button
              key={day}
              onClick={() => !isFuture && onSelect(ymd)}
              disabled={isFuture}
              className="w-full flex flex-col items-center justify-center rounded-xl font-mono text-[12px] transition-all border-none py-1 gap-0.5"
              style={{
                minHeight:  "38px",
                cursor:     isFuture ? "not-allowed" : "pointer",
                opacity:    isFuture ? 0.22 : isDeepPast && !isHol ? 0.35 : 1,
                background: isSel    ? (isHol ? "#f59e0b" : "var(--accent)")
                           : isToday ? "rgba(124,110,243,0.12)"
                           : isHol   ? "rgba(245,158,11,0.10)"
                           : "transparent",
                color:      isSel    ? "#fff"
                           : isToday ? "var(--accent)"
                           : isHol   ? "#f59e0b"
                           : isDeepPast ? "var(--text4)"
                           : "var(--text2)",
                border:     isToday && !isSel
                           ? "1px solid rgba(124,110,243,0.35)"
                           : isSel && isHol
                           ? "1px solid #f59e0b"
                           : "1px solid transparent",
                fontWeight: isSel || isToday ? 700 : 400,
              }}
              onMouseEnter={e => {
                if (!isFuture && !isSel)
                  (e.currentTarget as HTMLElement).style.background =
                    isHol ? "rgba(245,158,11,0.18)" : "rgba(124,110,243,0.08)";
              }}
              onMouseLeave={e => {
                if (!isSel)
                  (e.currentTarget as HTMLElement).style.background =
                    isToday ? "rgba(124,110,243,0.12)"
                    : isHol  ? "rgba(245,158,11,0.10)"
                    : "transparent";
              }}>
              <span style={{ lineHeight: 1 }}>{day}</span>
              <span style={{
                display: "block", width: "4px", height: "4px",
                borderRadius: "50%", background: dotColor, flexShrink: 0,
                opacity: isSel && dotColor === "transparent" ? 0 : isSel ? 0.7 : 1,
              }} />
            </button>
          );
        })}
      </div>

      {/* Jump to today */}
      {selected !== today && (
        <button
          onClick={() => {
            onSelect(today);
            const [ty2, tm2] = today.split("-").map(Number);
            onMonthChange(ty2, tm2 - 1);
          }}
          className="w-full mt-4 py-2 rounded-xl font-mono text-[12px] cursor-pointer border-none transition-all"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text2)" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLElement).style.color       = "var(--accent)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLElement).style.color       = "var(--text2)";
          }}>
          Jump to Today
        </button>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────
// HOLIDAY CHIP
// ─────────────────────────────────────────────────────────────────
function HolidayChip({
  date, reason, onRemove, removing,
}: {
  date: string; reason: string; onRemove: () => void; removing: boolean;
}) {
  const age         = daysAgo(date);
  const canEdit     = age <= EDIT_WINDOW;   // within 30 days — remove allowed
  const isOneTime   = age > EDIT_WINDOW && age <= ENTRY_WINDOW; // 31–90 days — was one-time
  const isDeepPast  = age > ENTRY_WINDOW;   // beyond 90 days — fully locked

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
      style={{
        background: isDeepPast ? "rgba(245,158,11,0.04)" : "rgba(245,158,11,0.07)",
        border:     `1px solid ${isDeepPast ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.20)"}`,
        opacity:    isDeepPast ? 0.7 : 1,
      }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base shrink-0">{isDeepPast ? "🔒" : "🌴"}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#f59e0b" }}>
            {shortMonthDay(date)}
          </p>
          {reason && (
            <p className="font-mono text-[11px] truncate mt-0.5" style={{ color: "var(--text3)" }}>
              {reason}
            </p>
          )}
          {/* Inline status note */}
          {isDeepPast && (
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text4)" }}>
              Beyond {ENTRY_WINDOW} days · locked
            </p>
          )}
          {isOneTime && !isDeepPast && (
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "#d97706" }}>
              One-time entry · cannot be edited
            </p>
          )}
        </div>
      </div>

      {/* Remove button — only for within-edit-window holidays */}
      {canEdit ? (
        <button
          onClick={onRemove}
          disabled={removing}
          className="shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer border-none"
          style={{ background: "transparent", color: "var(--text4)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text4)"; }}
          aria-label="Remove holiday">
          {removing
            ? <RefreshCw size={13} className="animate-spin" />
            : <Trash2 size={13} />}
        </button>
      ) : (
        <div className="shrink-0 p-1.5" title={isDeepPast ? "Locked — beyond 90 days" : "One-time entry — cannot be changed"}>
          <Lock size={13} style={{ color: "var(--text4)" }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN  MarkHoliday component
// ─────────────────────────────────────────────────────────────────
export default function MarkHoliday() {
  const today    = localToday();
  const [ty, tm] = today.split("-").map(Number);

  const [viewY, setViewY] = useState(ty);
  const [viewM, setViewM] = useState(tm - 1);

  const [selected, setSelected] = useState(today);

  const [holidaySet,    setHolidaySet]    = useState<Set<number>>(new Set());
  const [loggedSet,     setLoggedSet]     = useState<Set<number>>(new Set());
  const [monthHolidays, setMonthHolidays] = useState<{ date: string; reason: string }[]>([]);
  const [dotsLoading,   setDotsLoading]   = useState(false);

  const [selectedIsHoliday, setSelectedIsHoliday] = useState(false);
  const [reason,             setReason]             = useState("");

  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMonth = useCallback(async (y: number, m0: number) => {
    setDotsLoading(true);
    try {
      const [logsRes, holRes] = await Promise.all([
        fetch(`/api/work/logged-dates?year=${y}&month=${m0 + 1}`),
        fetch(`/api/work/holidays?year=${y}&month=${m0 + 1}`),
      ]);
      const [logsData, holData] = await Promise.all([logsRes.json(), holRes.json()]);
      if (logsData.success) setLoggedSet(new Set<number>(logsData.days));
      if (holData.success) {
        setHolidaySet(new Set<number>(holData.holidays.map((h: any) => h.day as number)));
        setMonthHolidays(holData.holidays);
      }
    } catch { /* non-critical */ }
    finally { setDotsLoading(false); }
  }, []);

  useEffect(() => { fetchMonth(viewY, viewM); }, [viewY, viewM, fetchMonth]);

  useEffect(() => {
    setReason("");
    const [sy, sm, sd] = selected.split("-").map(Number);
    const inView = sy === viewY && (sm - 1) === viewM;
    if (inView) {
      setSelectedIsHoliday(holidaySet.has(sd));
    } else {
      fetch(`/api/work/date?date=${selected}`)
        .then(r => r.json())
        .then(d => setSelectedIsHoliday(d.data?.isHoliday ?? false))
        .catch(() => setSelectedIsHoliday(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    const [sy, sm, sd] = selected.split("-").map(Number);
    if (sy === viewY && (sm - 1) === viewM) {
      setSelectedIsHoliday(holidaySet.has(sd));
    }
  }, [holidaySet, selected, viewY, viewM]);

  const toggleHoliday = async (markAs: boolean) => {
    setSaving(true);
    try {
      const res  = await fetch("/api/work/holiday", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selected, isHoliday: markAs, reason }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(data.message);
      setReason("");
      await fetchMonth(viewY, viewM);
    } catch { toast.error("Network error — please try again"); }
    finally { setSaving(false); }
  };

  const removeHoliday = async (date: string) => {
    setRemoving(date);
    try {
      const res  = await fetch("/api/work/holiday", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, isHoliday: false }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success("Holiday removed");
      await fetchMonth(viewY, viewM);
    } catch { toast.error("Network error — please try again"); }
    finally { setRemoving(null); }
  };

  // ── Derived state for selected date ──────────────────────────
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selDow       = new Date(sy, sm - 1, sd).getDay();
  const isWeekend    = selDow === 0 || selDow === 6;
  const selAge       = daysAgo(selected);

  // Access level for the selected date
  const isDeepPast    = selAge > ENTRY_WINDOW;          // > 90 days: cannot mark/remove
  const isOneTimeZone = selAge > EDIT_WINDOW && selAge <= ENTRY_WINDOW; // 31–90 days: one-time only
  const isEditable    = selAge <= EDIT_WINDOW;           // ≤ 30 days: fully editable

  // ── Month stats ───────────────────────────────────────────────
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  let weekendsCount = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const w = new Date(viewY, viewM, i).getDay();
    if (w === 0 || w === 6) weekendsCount++;
  }
  const workdays      = daysInMonth - weekendsCount;
  const holidayCount  = monthHolidays.length;
  const effectiveDays = Math.max(0, workdays - holidayCount);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-4">

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Mark Holiday
        </h1>
        <p className="font-mono text-[13px] mt-1" style={{ color: "var(--text3)" }}>
          Mark holidays up to {ENTRY_WINDOW} days back · remove within {EDIT_WINDOW} days only
        </p>
      </div>

      {/* ── Info banner ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(124,110,243,0.07)", border: "1px solid rgba(124,110,243,0.18)" }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <div className="space-y-1">
          <p className="text-[13px]" style={{ color: "var(--text2)" }}>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>Saturdays &amp; Sundays</span>{" "}
            are already excluded automatically. Use this page to mark gazetted holidays, sick days, or personal
            off-days. Holidays are{" "}
            <span style={{ color: "var(--text)", fontWeight: 600 }}>excluded from missing-day counts</span>{" "}
            in your analysis.
          </p>
          {/* Rule summary inline */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
            {[
              { icon: "🗓️", text: `Mark/remove within last ${EDIT_WINDOW} days — fully editable` },
              { icon: "⚠️", text: `Days ${EDIT_WINDOW + 1}–${ENTRY_WINDOW} ago — mark once, cannot remove` },
              { icon: "🔒", text: `Beyond ${ENTRY_WINDOW} days — view only, no changes` },
            ].map(({ icon, text }) => (
              <span key={text} className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>
                {icon} {text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* LEFT — Calendar + action panel */}
        <div className="space-y-4">

          <HolidayCalendar
            selected={selected}
            onSelect={setSelected}
            holidaySet={holidaySet}
            loggedSet={loggedSet}
            dotsLoading={dotsLoading}
            onMonthChange={(y, m0) => { setViewY(y); setViewM(m0); }}
            viewY={viewY}
            viewM={viewM}
          />

          {/* ── Selected date action panel ─────────────────── */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--surface)", border: `1px solid ${isDeepPast ? "var(--border)" : isOneTimeZone && !selectedIsHoliday ? "rgba(245,158,11,0.25)" : "var(--border)"}` }}>

            {/* Date label + badge */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                  {prettyDate(selected)}
                </p>
                <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text3)" }}>
                  {/* Context-aware sub-label */}
                  {isWeekend
                    ? "Weekend — already excluded from averages automatically"
                    : isDeepPast
                    ? `${selAge} days ago — beyond ${ENTRY_WINDOW}-day window, view only`
                    : isOneTimeZone && !selectedIsHoliday
                    ? `${selAge} days ago — one-time mark only, cannot be removed later`
                    : isOneTimeZone && selectedIsHoliday
                    ? `${selAge} days ago — marked as holiday (one-time, locked)`
                    : selectedIsHoliday
                    ? "Currently marked as a holiday 🌴"
                    : `Within ${EDIT_WINDOW} days — fully editable`}
                </p>
              </div>

              {/* Status badge */}
              {isDeepPast && !isWeekend && (
                <span className="shrink-0 flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(90,90,114,0.12)", color: "var(--text4)", border: "1px solid var(--border2)" }}>
                  <Lock size={10} /> Locked
                </span>
              )}
              {isOneTimeZone && selectedIsHoliday && !isWeekend && (
                <span className="shrink-0 flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                  🌴 Holiday · Locked
                </span>
              )}
              {isOneTimeZone && !selectedIsHoliday && !isWeekend && (
                <span className="shrink-0 flex items-center gap-1 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(245,158,11,0.10)", color: "#d97706", border: "1px solid rgba(245,158,11,0.22)" }}>
                  <AlertTriangle size={10} /> One-time
                </span>
              )}
              {isEditable && selectedIsHoliday && !isWeekend && (
                <span className="shrink-0 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                  🌴 Holiday
                </span>
              )}
              {isWeekend && (
                <span className="shrink-0 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: "rgba(90,90,114,0.12)", color: "var(--text3)", border: "1px solid var(--border2)" }}>
                  Weekend
                </span>
              )}
            </div>

            {/* ── DEEP PAST: view-only notice ───────────────── */}
            {isDeepPast && !isWeekend && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(90,90,114,0.08)", border: "1px solid var(--border2)" }}>
                <Lock size={14} className="mt-0.5 shrink-0" style={{ color: "var(--text4)" }} />
                <div>
                  <p className="font-mono text-[12px] font-semibold" style={{ color: "var(--text3)" }}>
                    Cannot change — beyond {ENTRY_WINDOW}-day window
                  </p>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text4)" }}>
                    {selectedIsHoliday
                      ? "This day was marked as a holiday and is now permanently locked."
                      : `This date is ${selAge} days ago. Holidays can only be marked within the last ${ENTRY_WINDOW} days.`}
                  </p>
                </div>
              </div>
            )}

            {/* ── ONE-TIME ZONE: already marked → locked notice ─ */}
            {isOneTimeZone && selectedIsHoliday && !isWeekend && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
                <Lock size={14} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                <div>
                  <p className="font-mono text-[12px] font-semibold" style={{ color: "#d97706" }}>
                    One-time entry — cannot be removed
                  </p>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text3)" }}>
                    This date is {selAge} days ago (beyond the {EDIT_WINDOW}-day edit window).
                    The holiday was saved as a one-time entry and is now locked.
                  </p>
                </div>
              </div>
            )}

            {/* ── ONE-TIME ZONE: not yet marked → warn before marking ─ */}
            {isOneTimeZone && !selectedIsHoliday && !isWeekend && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                <div>
                  <p className="font-mono text-[12px] font-semibold" style={{ color: "#d97706" }}>
                    One-time mark — cannot be removed after saving
                  </p>
                  <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text3)" }}>
                    This date is {selAge} days ago (beyond the {EDIT_WINDOW}-day edit window).
                    Once you mark it as a holiday, <strong>it cannot be undone</strong>.
                    Make sure this is correct before saving.
                  </p>
                </div>
              </div>
            )}

            {/* ── ACTION AREA — only for non-deep-past, non-weekend, non-locked-holiday ─ */}
            {!isWeekend && !isDeepPast && !(isOneTimeZone && selectedIsHoliday) && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--text3)" }}>
                    Reason / Note{" "}
                    <span style={{ color: "var(--text4)", textTransform: "none", fontWeight: 400 }}>
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !saving) toggleHoliday(true); }}
                    placeholder={
                      selectedIsHoliday
                        ? "Update reason..."
                        : isOneTimeZone
                        ? "e.g. Diwali — confirm this is correct before saving"
                        : "e.g. Diwali, Republic Day, Sick leave..."
                    }
                    className="w-full rounded-xl px-4 py-3 font-mono text-[13px] focus:outline-none transition-colors"
                    style={{ background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text)" }}
                    onFocus={e  => (e.currentTarget.style.borderColor = isOneTimeZone ? "#f59e0b" : "#7c6ef3")}
                    onBlur={e   => (e.currentTarget.style.borderColor = "var(--border2)")}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* Primary CTA */}
                  <button
                    onClick={() => toggleHoliday(true)}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[13px] font-medium cursor-pointer border-none transition-all"
                    style={{
                      background: saving
                        ? "rgba(245,158,11,0.35)"
                        : selectedIsHoliday
                        ? "rgba(245,158,11,0.15)"
                        : isOneTimeZone
                        ? "#d97706"         // amber-filled to signal caution
                        : "#f59e0b",
                      color: selectedIsHoliday ? "#f59e0b" : "#0a0a0f",
                      border: selectedIsHoliday ? "1px solid rgba(245,158,11,0.30)" : "1px solid transparent",
                      opacity: saving ? 0.7 : 1,
                    }}>
                    {saving
                      ? <><RefreshCw size={13} className="animate-spin" /> Saving...</>
                      : selectedIsHoliday
                      ? <><Palmtree size={13} /> Update Reason</>
                      : isOneTimeZone
                      ? <><Palmtree size={13} /> Mark Holiday (One-Time)</>
                      : <><Palmtree size={13} /> Mark as Holiday</>}
                  </button>

                  {/* Remove — only shown for fully-editable holidays (≤ 30 days) */}
                  {selectedIsHoliday && isEditable && (
                    <button
                      onClick={() => toggleHoliday(false)}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[13px] font-medium cursor-pointer border-none transition-all"
                      style={{
                        background: "rgba(248,113,113,0.08)",
                        color:      "var(--danger)",
                        border:     "1px solid rgba(248,113,113,0.20)",
                        opacity:    saving ? 0.6 : 1,
                      }}>
                      <X size={13} /> Remove Holiday
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Holiday list + month stats */}
        <div className="space-y-4">

          {/* Holiday list for the viewed month */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

            <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <CalendarDays size={14} style={{ color: "#f59e0b" }} />
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                {MONTHS[viewM]} {viewY}
              </h2>
              <span className="ml-auto font-mono text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.20)" }}>
                {holidayCount} holiday{holidayCount !== 1 ? "s" : ""}
              </span>
            </div>

            {monthHolidays.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="text-3xl select-none">🗓️</span>
                <p className="font-mono text-[12px] text-center" style={{ color: "var(--text4)" }}>
                  No holidays marked<br />for this month yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...monthHolidays]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(h => (
                    <HolidayChip
                      key={h.date}
                      date={h.date}
                      reason={h.reason}
                      removing={removing === h.date}
                      onRemove={() => removeHoliday(h.date)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Month stats */}
          <div className="rounded-2xl px-5 py-4 space-y-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

            <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
              {MONTHS[viewM]} at a glance
            </p>

            <div className="space-y-2">
              {[
                { label: "Total days",          value: daysInMonth,   color: "var(--text)"  },
                { label: "Weekends (auto off)",  value: weekendsCount, color: "var(--text3)" },
                { label: "Work days",            value: workdays,      color: "var(--text2)" },
                { label: "Holidays marked",      value: holidayCount,  color: "#f59e0b"      },
                { label: "Effective work days",  value: effectiveDays, color: "#22d3a0"      },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>{label}</span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Visual bar */}
            <div className="pt-1">
              <div className="flex h-2 rounded-full overflow-hidden gap-px" style={{ background: "var(--border)" }}>
                <div style={{ width: `${(weekendsCount / daysInMonth) * 100}%`, background: "var(--border2)" }} />
                <div style={{ width: `${(holidayCount / daysInMonth) * 100}%`, background: "#f59e0b" }} />
                <div style={{ width: `${(effectiveDays / daysInMonth) * 100}%`, background: "rgba(124,110,243,0.5)" }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>Weekends</span>
                <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>Effective work days</span>
              </div>
            </div>
          </div>

          {/* Access rules reminder card */}
          <div className="rounded-2xl px-4 py-3 space-y-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text3)" }}>
              Holiday rules
            </p>
            {[
              {
                icon: "✅",
                text: `Within ${EDIT_WINDOW} days`,
                detail: "Mark & remove freely",
                color: "var(--green)",
              },
              {
                icon: "⚠️",
                text: `${EDIT_WINDOW + 1}–${ENTRY_WINDOW} days ago`,
                detail: "Mark once — cannot remove",
                color: "#d97706",
              },
              {
                icon: "🔒",
                text: `Beyond ${ENTRY_WINDOW} days`,
                detail: "View only — no changes",
                color: "var(--text4)",
              },
            ].map(({ icon, text, detail, color }) => (
              <div key={text} className="flex items-center gap-2">
                <span className="text-[11px]">{icon}</span>
                <div className="flex flex-1 justify-between items-center gap-2">
                  <span className="font-mono text-[11px]" style={{ color: "var(--text2)" }}>{text}</span>
                  <span className="font-mono text-[10px]" style={{ color }}>{detail}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}