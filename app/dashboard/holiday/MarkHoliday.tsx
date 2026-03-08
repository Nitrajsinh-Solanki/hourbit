// app/dashboard/holiday/MarkHoliday.tsx

"use client";

import {
  useCallback, useEffect, useImperativeHandle,
  forwardRef, useRef, useState,
} from "react";
import toast from "react-hot-toast";
import {
  Palmtree, ChevronLeft, ChevronRight, RefreshCw,
  Trash2, CalendarDays, Info, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// HELPERS  (mirror exactly what date-wise page uses)
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
// CALENDAR  — identical visual to CalendarPicker in date-wise,
//             but adds amber holiday dots and holiday-set awareness
// ─────────────────────────────────────────────────────────────────
export interface HolidayCalHandle { refresh: () => void; }

const HolidayCalendar = forwardRef<HolidayCalHandle, {
  selected:   string;
  onSelect:   (ymd: string) => void;
  holidaySet: Set<number>;   // days in viewed month that are holidays
  loggedSet:  Set<number>;   // days in viewed month that have a work log
  dotsLoading: boolean;
  onMonthChange: (y: number, m0: number) => void;
  viewY: number;
  viewM: number;             // 0-indexed
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
            color:      canGoNext ? "var(--text2)" : "var(--text4)",
            cursor:     canGoNext ? "pointer" : "not-allowed",
            opacity:    canGoNext ? 1 : 0.4,
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

          const dotColor = isHol    ? "#f59e0b"
                         : isLogged ? "#22d3a0"
                         : isMissing? "#f87171"
                         : isWeekend? "var(--border2)"
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
                opacity:    isFuture ? 0.22 : 1,
                background: isSel    ? (isHol ? "#f59e0b" : "var(--accent)")
                           : isToday ? "rgba(124,110,243,0.12)"
                           : isHol   ? "rgba(245,158,11,0.10)"
                           : "transparent",
                color:      isSel    ? "#fff"
                           : isToday ? "var(--accent)"
                           : isHol   ? "#f59e0b"
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
                    : isHol ? "rgba(245,158,11,0.10)"
                    : "transparent";
              }}
            >
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
// HOLIDAY CHIP  — one row in the month's holiday list
// ─────────────────────────────────────────────────────────────────
function HolidayChip({
  date, reason, onRemove, removing,
}: {
  date: string; reason: string;
  onRemove: () => void; removing: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "rgba(245,158,11,0.07)",
        border:     "1px solid rgba(245,158,11,0.20)",
      }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base shrink-0">🌴</span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#f59e0b" }}>
            {shortMonthDay(date)}
          </p>
          {reason && (
            <p className="font-mono text-[11px] truncate mt-0.5" style={{ color: "var(--text3)" }}>
              {reason}
            </p>
          )}
        </div>
      </div>

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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN  MarkHoliday component
// ─────────────────────────────────────────────────────────────────
export default function MarkHoliday() {
  const today    = localToday();
  const [ty, tm] = today.split("-").map(Number);

  // Calendar view state
  const [viewY, setViewY] = useState(ty);
  const [viewM, setViewM] = useState(tm - 1);   // 0-indexed

  // Selection
  const [selected, setSelected] = useState(today);

  // Per-date data
  const [holidaySet,     setHolidaySet]     = useState<Set<number>>(new Set());
  const [loggedSet,      setLoggedSet]      = useState<Set<number>>(new Set());
  const [monthHolidays,  setMonthHolidays]  = useState<{ date: string; reason: string }[]>([]);
  const [dotsLoading,    setDotsLoading]    = useState(false);

  // For the selected-date panel
  const [selectedIsHoliday, setSelectedIsHoliday] = useState(false);
  const [reason,             setReason]             = useState("");

  // Saving flags
  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null); // date string being removed

  // ── Fetch all dots + holiday list for the currently viewed month ──
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

  // ── When selected date changes, refresh its holiday status ───────
  useEffect(() => {
    setReason(""); // always clear reason when switching dates

    const [sy, sm, sd] = selected.split("-").map(Number);
    const inView = sy === viewY && (sm - 1) === viewM;

    if (inView) {
      setSelectedIsHoliday(holidaySet.has(sd));
    } else {
      // Date belongs to a different month — ask the API
      fetch(`/api/work/date?date=${selected}`)
        .then(r => r.json())
        .then(d => setSelectedIsHoliday(d.data?.isHoliday ?? false))
        .catch(() => setSelectedIsHoliday(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Re-sync holiday status when the month data refreshes (e.g., after a toggle)
  useEffect(() => {
    const [sy, sm, sd] = selected.split("-").map(Number);
    if (sy === viewY && (sm - 1) === viewM) {
      setSelectedIsHoliday(holidaySet.has(sd));
    }
  }, [holidaySet, selected, viewY, viewM]);

  // ── Toggle holiday for selected date ─────────────────────────────
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

  // ── Remove holiday from the list directly ───────────────────────
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

  // ── Derived info for selected date ──────────────────────────────
  const [sy, sm, sd]  = selected.split("-").map(Number);
  const selDow        = new Date(sy, sm - 1, sd).getDay();
  const isWeekend     = selDow === 0 || selDow === 6;

  // ── Month stats ─────────────────────────────────────────────────
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
          Mark personal holidays or public holidays — they are excluded from all weekly &amp; monthly averages.
        </p>
      </div>

      {/* ── Info banner ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: "rgba(124,110,243,0.07)",
          border:     "1px solid rgba(124,110,243,0.18)",
        }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <p className="text-[13px]" style={{ color: "var(--text2)" }}>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            Saturdays &amp; Sundays
          </span>{" "}
          are already excluded from averages automatically. Use this page to mark gazetted
          holidays, sick days, or any other personal off-days. Holidays will{" "}
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            not count as missing
          </span>{" "}
          days in your analysis.
        </p>
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
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

            {/* Date label + badge */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                  {prettyDate(selected)}
                </p>
                <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text3)" }}>
                  {isWeekend
                    ? "Weekend — already excluded from averages automatically"
                    : selectedIsHoliday
                    ? "Currently marked as a holiday 🌴"
                    : "Regular work day — not marked as holiday"}
                </p>
              </div>

              {selectedIsHoliday && !isWeekend && (
                <span className="shrink-0 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    color:      "#f59e0b",
                    border:     "1px solid rgba(245,158,11,0.25)",
                  }}>
                  🌴 Holiday
                </span>
              )}
              {isWeekend && (
                <span className="shrink-0 font-mono text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{
                    background: "rgba(90,90,114,0.12)",
                    color:      "var(--text3)",
                    border:     "1px solid var(--border2)",
                  }}>
                  Weekend
                </span>
              )}
            </div>

            {/* Reason input + buttons — only for non-weekend days */}
            {!isWeekend && (
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
                    onKeyDown={e => {
                      if (e.key === "Enter" && !saving) toggleHoliday(true);
                    }}
                    placeholder={
                      selectedIsHoliday
                        ? "Update reason..."
                        : "e.g. Diwali, Republic Day, Sick leave..."
                    }
                    className="w-full rounded-xl px-4 py-3 font-mono text-[13px]
                      focus:outline-none transition-colors"
                    style={{
                      background:  "var(--bg)",
                      border:      "1px solid var(--border2)",
                      color:       "var(--text)",
                    }}
                    onFocus={e  => (e.currentTarget.style.borderColor = "#7c6ef3")}
                    onBlur={e   => (e.currentTarget.style.borderColor = "var(--border2)")}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* Primary CTA — Mark / Update */}
                  <button
                    onClick={() => toggleHoliday(true)}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                      font-mono text-[13px] font-medium cursor-pointer border-none transition-all"
                    style={{
                      background: saving
                        ? "rgba(245,158,11,0.35)"
                        : selectedIsHoliday
                        ? "rgba(245,158,11,0.15)"
                        : "#f59e0b",
                      color:  selectedIsHoliday ? "#f59e0b" : "#0a0a0f",
                      border: selectedIsHoliday
                        ? "1px solid rgba(245,158,11,0.30)"
                        : "1px solid transparent",
                      opacity: saving ? 0.7 : 1,
                    }}>
                    {saving
                      ? <><RefreshCw size={13} className="animate-spin" /> Saving...</>
                      : selectedIsHoliday
                      ? <><Palmtree size={13} /> Update Reason</>
                      : <><Palmtree size={13} /> Mark as Holiday</>}
                  </button>

                  {/* Remove — only shown when already a holiday */}
                  {selectedIsHoliday && (
                    <button
                      onClick={() => toggleHoliday(false)}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                        font-mono text-[13px] font-medium cursor-pointer border-none transition-all"
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

            <div className="flex items-center gap-2 mb-4 pb-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <CalendarDays size={14} style={{ color: "#f59e0b" }} />
              <h2 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                {MONTHS[viewM]} {viewY}
              </h2>
              <span className="ml-auto font-mono text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(245,158,11,0.10)",
                  color:      "#f59e0b",
                  border:     "1px solid rgba(245,158,11,0.20)",
                }}>
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

          {/* Month-at-a-glance stats */}
          <div className="rounded-2xl px-5 py-4 space-y-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

            <p className="font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "var(--text3)" }}>
              {MONTHS[viewM]} at a glance
            </p>

            <div className="space-y-2">
              {[
                { label: "Total days",       value: daysInMonth,   color: "var(--text)"  },
                { label: "Weekends (auto off)",value: weekendsCount, color: "var(--text3)" },
                { label: "Work days",        value: workdays,      color: "var(--text2)" },
                { label: "Holidays marked",  value: holidayCount,  color: "#f59e0b"      },
                { label: "Effective days",   value: effectiveDays, color: "#22d3a0"      },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
                    {label}
                  </span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Visual bar */}
            <div className="pt-1">
              <div className="flex h-2 rounded-full overflow-hidden gap-px"
                style={{ background: "var(--border)" }}>
                {/* Weekends segment */}
                <div style={{
                  width: `${(weekendsCount / daysInMonth) * 100}%`,
                  background: "var(--border2)",
                }} />
                {/* Holidays segment */}
                <div style={{
                  width: `${(holidayCount / daysInMonth) * 100}%`,
                  background: "#f59e0b",
                }} />
                {/* Effective work segment */}
                <div style={{
                  width: `${(effectiveDays / daysInMonth) * 100}%`,
                  background: "rgba(124,110,243,0.5)",
                }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>
                  Weekends
                </span>
                <span className="font-mono text-[9px]" style={{ color: "var(--text4)" }}>
                  Effective work days
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}