// app/dashboard/date-wise/page.tsx
"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef, useImperativeHandle, forwardRef,
} from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Clock, LogIn, LogOut, Coffee, Zap,
  Plus, Save, RefreshCw, CalendarDays,
  ChevronLeft, ChevronRight, UtensilsCrossed,
  X, CheckCircle2, PencilLine, FilePlus2,
  Palmtree, TrendingUp, Lock, AlertTriangle, Settings2, Eye,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// RULES
// ─────────────────────────────────────────────────────────────────
// VIEW  → any date in history (no restriction)
// ADD   → first-time entry allowed only within last 90 days
//          days 31–90: one-time only, warn user before saving
// EDIT  → update existing log allowed only within last 30 days
// ─────────────────────────────────────────────────────────────────
const EDIT_WINDOW  = 30;   // days: existing logs editable within this window
const ENTRY_WINDOW = 90;   // days: new logs can be added within this window

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
interface BreakEntry {
  id:      string;
  label:   string;
  minutes: number;
  type:    "tea" | "lunch" | "custom";
}

interface SavedSnapshot {
  entryTime:         string;
  exitTime:          string;
  notes:             string;
  breaksKey:         string;
  requiredWorkHours: number;
}

export interface CalendarHandle {
  refreshDots: () => void;
}

type DateMode =
  | "view-only"          // has existing log, older than 30 days — read only
  | "view-empty"         // no log, older than 90 days — can't add, just empty view
  | "one-time-add"       // no log, 31–90 days ago — can add ONCE, warn user
  | "editable-new"       // no log, within 30 days — can add freely
  | "editable-existing"; // has existing log, within 30 days — full edit

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const uid  = () => Math.random().toString(36).slice(2, 9);

function breaksToKey(b: BreakEntry[]): string {
  return b.map(x => `${x.type}:${x.minutes}:${x.label}`).join("|");
}

const EMPTY_SNAPSHOT: SavedSnapshot = {
  entryTime: "", exitTime: "", notes: "", breaksKey: "", requiredWorkHours: 8.5,
};

function fmtDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtHLabel(h: number): string {
  const hrs = Math.floor(h), mins = Math.round((h - hrs) * 60);
  if (!mins) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  return `${pad2(h % 12 || 12)}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
}

function isoToHHMM(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function addMinsToTime(hhmm: string, mins: number): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${pad2(Math.floor(t / 60) % 24)}:${pad2(t % 60)}`;
}

function toMins(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** How many calendar days ago is `ymd` relative to today? Negative = future */
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

function shortDate(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─────────────────────────────────────────────────────────────────
// CALENDAR — no date restriction on viewing, visual states only
// ─────────────────────────────────────────────────────────────────
const CalendarPicker = forwardRef<CalendarHandle, {
  value:    string;
  onChange: (v: string) => void;
}>(function CalendarPicker({ value, onChange }, ref) {
  const today    = localToday();
  const [ty, tm] = today.split("-").map(Number);

  const [selY, selM, selD] = value.split("-").map(Number);
  const [viewY, setViewY]  = useState(selY);
  const [viewM, setViewM]  = useState(selM - 1); // 0-indexed

  const [loggedDays,  setLoggedDays]  = useState<Set<number>>(new Set());
  const [holidayDays, setHolidayDays] = useState<Set<number>>(new Set());
  const [dotsLoading, setDotsLoading] = useState(false);

  const fetchDots = useCallback(async (year: number, month0: number) => {
    setDotsLoading(true);
    try {
      const [logsRes, holRes] = await Promise.all([
        fetch(`/api/work/logged-dates?year=${year}&month=${month0 + 1}`),
        fetch(`/api/work/holidays?year=${year}&month=${month0 + 1}`),
      ]);
      const [logsData, holData] = await Promise.all([logsRes.json(), holRes.json()]);
      if (logsData.success) setLoggedDays(new Set<number>(logsData.days));
      if (holData.success)  setHolidayDays(new Set<number>(holData.holidays.map((h: any) => h.day as number)));
    } catch { /* non-critical */ } finally {
      setDotsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDots(viewY, viewM); }, [viewY, viewM, fetchDots]);

  useImperativeHandle(ref, () => ({
    refreshDots: () => fetchDots(viewY, viewM),
  }), [viewY, viewM, fetchDots]);

  // Calendar can navigate anywhere in the past + current month (not future months)
  const canGoNext = viewY < ty || (viewY === ty && viewM < tm - 1);

  function navMonth(delta: number) {
    let nm = viewM + delta, ny = viewY;
    if (nm < 0)  { nm = 11; ny--; }
    if (nm > 11) { nm = 0;  ny++; }
    // Don't go into future months
    if (ny > ty || (ny === ty && nm > tm - 1)) return;
    setViewM(nm); setViewY(ny);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
        {[
          { color: "#22d3a0",        label: "Logged"   },
          { color: "#f87171",        label: "Missing"  },
          { color: "#f59e0b",        label: "Holiday"  },
          { color: "var(--border2)", label: "Weekend"  },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="font-mono text-[10px]" style={{ color: "var(--text3)" }}>{label}</span>
          </div>
        ))}
        {dotsLoading && <RefreshCw size={10} className="animate-spin ml-auto" style={{ color: "var(--text3)" }} />}
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
        <p className="font-syne font-bold text-[15px]" style={{ color: "var(--text)" }}>
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
          <p key={d} className="text-center font-mono text-[10px] py-1" style={{ color: "var(--text3)" }}>{d}</p>
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
          const age       = daysAgo(ymd); // negative = future, 0 = today
          const isHol     = !isFuture && holidayDays.has(day);
          const isLogged  = !isFuture && loggedDays.has(day) && !isHol;
          const dow       = new Date(viewY, viewM, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isMissing = !isFuture && !isToday && !isLogged && !isWeekend && !isHol;

          // Visual fade: beyond entry window & no log = very faded (view only, empty)
          const isDeepPast = age > ENTRY_WINDOW && !isLogged;
          // Muted: 31-90 days, no log yet (one-time add zone)
          const isOneTimeZone = age > EDIT_WINDOW && age <= ENTRY_WINDOW && !isLogged;

          const dotColor = isHol     ? "#f59e0b"
                         : isLogged  ? "#22d3a0"
                         : isMissing ? "#f87171"
                         : isWeekend ? "var(--border2)"
                         : "transparent";

          return (
            <button
              key={day}
              onClick={() => !isFuture && onChange(ymd)}
              disabled={isFuture}
              className="w-full flex flex-col items-center justify-center rounded-xl font-mono text-[12px] transition-all border-none py-1 gap-0.5"
              style={{
                minHeight:  "38px",
                cursor:     isFuture ? "not-allowed" : "pointer",
                opacity:    isFuture ? 0.22 : isDeepPast ? 0.35 : 1,
                background: isSel    ? (isHol ? "#f59e0b" : "var(--accent)")
                           : isToday ? "rgba(124,110,243,0.12)"
                           : isHol   ? "rgba(245,158,11,0.10)"
                           : "transparent",
                color:      isSel       ? "#fff"
                           : isToday    ? "var(--accent)"
                           : isHol      ? "#f59e0b"
                           : isDeepPast ? "var(--text4)"
                           : "var(--text2)",
                border: isToday && !isSel ? "1px solid rgba(124,110,243,0.35)" : "1px solid transparent",
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
                    isToday ? "rgba(124,110,243,0.12)" : isHol ? "rgba(245,158,11,0.10)" : "transparent";
              }}>
              <span style={{ lineHeight: 1 }}>{day}</span>
              <span style={{
                display: "block", width: "4px", height: "4px", borderRadius: "50%",
                background: dotColor, flexShrink: 0, opacity: isSel ? 0.7 : 1,
              }} />
            </button>
          );
        })}
      </div>

      {/* Jump to today */}
      {value !== today && (
        <button
          onClick={() => {
            onChange(today);
            const [ty2, tm2] = today.split("-").map(Number);
            setViewY(ty2); setViewM(tm2 - 1);
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
// CLOCK PICKER
// ─────────────────────────────────────────────────────────────────
type ClockMode = "hour" | "minute";

function ClockPicker({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const parsed = value ? value.split(":").map(Number) : [9, 0];
  const [hour,   setHour]   = useState(parsed[0]);
  const [minute, setMinute] = useState(parsed[1]);
  const [mode,   setMode]   = useState<ClockMode>("hour");
  const [ampm,   setAmpm]   = useState<"AM" | "PM">(parsed[0] >= 12 ? "PM" : "AM");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const d12 = hour % 12 === 0 ? 12 : hour % 12;

  function pickHour(h12: number) {
    let h24 = h12 % 12;
    if (ampm === "PM") h24 += 12;
    setHour(h24); setMode("minute");
  }
  function pickMinute(m: number) {
    setMinute(m); onChange(`${pad2(hour)}:${pad2(m)}`); onClose();
  }
  function toggleAP(ap: "AM" | "PM") {
    setAmpm(ap);
    if (ap === "AM" && hour >= 12) setHour(h => h - 12);
    if (ap === "PM" && hour < 12)  setHour(h => h + 12);
  }
  function clockPos(i: number, r = 38) {
    const a = ((i / 12) * 360 - 90) * (Math.PI / 180);
    return { left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` };
  }

  const hrs  = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const handAngle = mode === "hour"
    ? ((d12 % 12) / 12) * 360 - 90
    : (minute / 60) * 360 - 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
      <div ref={ref} className="rounded-3xl p-6 w-[300px]"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 0 60px rgba(124,110,243,0.20)" }}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
            {mode === "hour" ? "Select hour" : "Select minute"}
          </span>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer p-0" style={{ color: "var(--text3)" }}>
            <X size={14} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="flex items-center rounded-2xl px-4 py-2 gap-1.5"
            style={{ background: "var(--bg)", border: "1px solid var(--border2)" }}>
            <button onClick={() => setMode("hour")}
              className="font-syne font-bold text-[28px] bg-transparent border-none cursor-pointer p-0"
              style={{ color: mode === "hour" ? "var(--accent)" : "var(--text2)" }}>{pad2(d12)}</button>
            <span className="font-syne font-bold text-[28px]" style={{ color: "var(--text4)" }}>:</span>
            <button onClick={() => setMode("minute")}
              className="font-syne font-bold text-[28px] bg-transparent border-none cursor-pointer p-0"
              style={{ color: mode === "minute" ? "var(--accent)" : "var(--text2)" }}>{pad2(minute)}</button>
          </div>
          <div className="flex flex-col gap-1">
            {(["AM", "PM"] as const).map(ap => (
              <button key={ap} onClick={() => toggleAP(ap)}
                className="font-mono text-[12px] font-medium px-3 py-1 rounded-lg cursor-pointer border-none"
                style={ampm === ap
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "transparent", border: "1px solid var(--border2)", color: "var(--text3)" }}>
                {ap}
              </button>
            ))}
          </div>
        </div>
        <div className="relative mx-auto mb-5" style={{ width: "200px", height: "200px" }}>
          <div className="absolute inset-0 rounded-full" style={{ background: "var(--bg)", border: "2px solid var(--border2)" }} />
          <div className="absolute rounded-full"
            style={{
              width: "2px", height: "38%", left: "calc(50% - 1px)", top: "12%",
              transformOrigin: "bottom center",
              transform: `rotate(${handAngle + 90}deg)`,
              transition: "transform 0.2s ease",
              background: "rgba(124,110,243,0.55)",
            }} />
          <div className="absolute w-3 h-3 rounded-full"
            style={{ top: "calc(50% - 6px)", left: "calc(50% - 6px)", background: "var(--accent)" }} />
          {(mode === "hour" ? hrs : mins).map((num, i) => {
            const p = clockPos(i), sel = mode === "hour" ? d12 === num : minute === num;
            return (
              <button key={num}
                onClick={() => mode === "hour" ? pickHour(num) : pickMinute(num)}
                className="absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono text-[12px] font-medium cursor-pointer border-none transition-all"
                style={{
                  left: p.left, top: p.top,
                  background: sel ? "var(--accent)" : "transparent",
                  color:      sel ? "#fff" : "var(--text2)",
                  boxShadow:  sel ? "0 0 12px rgba(124,110,243,0.5)" : "none",
                }}>
                {mode === "minute" ? pad2(num) : num}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {mode === "minute" && (
            <button onClick={() => setMode("hour")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[12px] cursor-pointer"
              style={{ background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text2)" }}>
              <ChevronLeft size={13} /> Hours
            </button>
          )}
          <button onClick={() => { onChange(`${pad2(hour)}:${pad2(minute)}`); onClose(); }}
            className="flex-1 py-2.5 rounded-xl font-mono font-medium text-[13px] text-white cursor-pointer border-none transition-all"
            style={{ background: "var(--accent)", boxShadow: "0 0 18px rgba(124,110,243,0.35)" }}>
            Confirm {to12h(`${pad2(hour)}:${pad2(minute)}`)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TIME BUTTON
// ─────────────────────────────────────────────────────────────────
function TimeButton({ label, icon: Icon, value, accentColor, onClick, readOnly = false }: {
  label: string; icon: React.ElementType; value: string;
  accentColor: string; onClick: () => void; readOnly?: boolean;
}) {
  return (
    <button onClick={() => !readOnly && onClick()}
      className="w-full group flex flex-col gap-3 rounded-2xl p-5 text-left transition-all border-none"
      style={{
        background: "var(--surface2)", border: "1px solid var(--border)",
        cursor: readOnly ? "default" : "pointer",
        opacity: readOnly && !value ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!readOnly) (e.currentTarget.style.borderColor = "var(--border2)"); }}
      onMouseLeave={e => { (e.currentTarget.style.borderColor = "var(--border)"); }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
          {label}
        </span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}18` }}>
          <Icon size={15} style={{ color: accentColor }} />
        </div>
      </div>
      {value ? (
        <div>
          <p className="font-syne font-extrabold text-[30px] leading-none tracking-tight" style={{ color: "var(--text)" }}>
            {to12h(value).split(" ")[0]}
          </p>
          <p className="font-mono text-[12px] mt-1 font-semibold" style={{ color: accentColor }}>
            {to12h(value).split(" ")[1]}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-syne font-bold text-[22px] leading-none" style={{ color: "var(--text4)" }}>
            {readOnly ? "Not recorded" : "Tap to set"}
          </p>
          <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text4)" }}>
            {readOnly ? "—" : "click to open clock"}
          </p>
        </div>
      )}
      {!readOnly && (
        <div className="h-px w-full opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
          style={{ background: `linear-gradient(to right,transparent,${accentColor}60,transparent)` }} />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// REQUIRED HOURS EDITOR
// ─────────────────────────────────────────────────────────────────
function RequiredHoursEditor({
  value, defaultValue, hasOverride, onChange, onClear, readOnly = false,
}: {
  value: number; defaultValue: number; hasOverride: boolean;
  onChange: (h: number) => void; onClear: () => void; readOnly?: boolean;
}) {
  const [editing,  setEditing]  = useState(false);
  const [inputVal, setInputVal] = useState(String(value));
  const presets = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

  function commit(raw: string) {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 24) {
      onChange(Math.round(parsed * 2) / 2);
      setEditing(false);
    }
  }

  if (readOnly) {
    return (
      <div className="rounded-2xl p-5 space-y-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Settings2 size={13} style={{ color: "var(--text3)" }} />
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
            Required Hours
          </span>
        </div>
        <p className="font-syne font-extrabold text-[30px] leading-none" style={{ color: "var(--text)" }}>
          {fmtHLabel(value)}
        </p>
        <p className="font-mono text-[11px]" style={{ color: "var(--text4)" }}>
          {hasOverride ? `Custom for this day · Default is ${fmtHLabel(defaultValue)}` : "From profile default"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{
        background: "var(--surface)",
        border: `1px solid ${hasOverride ? "rgba(124,110,243,0.45)" : "var(--border)"}`,
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 size={13} style={{ color: hasOverride ? "var(--accent)" : "var(--text3)" }} />
          <span className="font-mono text-[11px] uppercase tracking-widest"
            style={{ color: hasOverride ? "var(--accent)" : "var(--text3)" }}>
            Required Hours This Day
          </span>
          {hasOverride && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(124,110,243,0.15)", color: "var(--accent)", border: "1px solid rgba(124,110,243,0.3)" }}>
              Custom
            </span>
          )}
        </div>
        {hasOverride && (
          <button onClick={onClear}
            className="font-mono text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg border-none cursor-pointer"
            style={{ background: "rgba(248,113,113,0.12)", color: "#ef4444" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}>
            <X size={10} /> Reset to {fmtHLabel(defaultValue)}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map(p => (
              <button key={p} onClick={() => { onChange(p); setEditing(false); }}
                className="px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer border-none transition-all"
                style={Math.abs(value - p) < 0.01
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text2)" }}>
                {fmtHLabel(p)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" min="0.5" max="24" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commit(inputVal); if (e.key === "Escape") setEditing(false); }}
              className="w-24 rounded-xl px-3 py-2 font-mono text-[13px] focus:outline-none text-center"
              style={{ background: "var(--bg)", border: "1px solid var(--accent)", color: "var(--text)" }}
              autoFocus />
            <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>hours</span>
            <button onClick={() => commit(inputVal)}
              className="px-4 py-2 rounded-xl text-white font-mono text-[12px] font-medium cursor-pointer border-none"
              style={{ background: "var(--accent)" }}>Set</button>
            <button onClick={() => setEditing(false)}
              className="bg-transparent border-none cursor-pointer p-0" style={{ color: "var(--text3)" }}>
              <X size={14} />
            </button>
          </div>
          <p className="font-mono text-[11px]" style={{ color: "var(--text4)" }}>
            Only changes this date. Your profile default stays {fmtHLabel(defaultValue)}.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-syne font-extrabold text-[32px] leading-none" style={{ color: "var(--text)" }}>
              {fmtHLabel(value)}
            </p>
            <p className="font-mono text-[11px] mt-1" style={{ color: hasOverride ? "var(--accent)" : "var(--text4)" }}>
              {hasOverride ? `This date only · Default is ${fmtHLabel(defaultValue)}` : "From your profile default"}
            </p>
          </div>
          <button onClick={() => { setInputVal(String(value)); setEditing(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[12px] cursor-pointer border-none transition-all"
            style={{ background: "rgba(124,110,243,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,243,0.25)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,110,243,0.22)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,110,243,0.12)")}>
            <Settings2 size={12} /> Change
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BREAK CHIP
// ─────────────────────────────────────────────────────────────────
function BreakChip({ br, onRemove, readOnly = false }: {
  br: BreakEntry; onRemove: () => void; readOnly?: boolean;
}) {
  const c = {
    tea:    { bg: "#fbbf2415", border: "#fbbf2445", text: "#d97706" },
    lunch:  { bg: "#22d3a015", border: "#22d3a045", text: "#059669" },
    custom: { bg: "#a78bfa15", border: "#a78bfa45", text: "#7c6ef3" },
  }[br.type];
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="font-mono text-[13px] font-medium" style={{ color: c.text }}>{br.label}</span>
      <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>·</span>
      <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>{br.minutes}m</span>
      {!readOnly && (
        <button onClick={onRemove}
          className="ml-1 bg-transparent border-none cursor-pointer p-0"
          style={{ color: "var(--text4)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text4)")}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CARD HELPERS
// ─────────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}
function CardHeader({ icon: Icon, iconColor, title, right }: {
  icon: React.ElementType; iconColor: string; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 mb-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <Icon size={14} style={{ color: iconColor }} />
      <h2 className="font-syne font-semibold text-[14px]" style={{ color: "var(--text)" }}>{title}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODE BANNERS
// ─────────────────────────────────────────────────────────────────
function ViewOnlyBanner({ date }: { date: string }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 rounded-2xl"
      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(245,158,11,0.15)" }}>
        <Lock size={18} style={{ color: "#f59e0b" }} />
      </div>
      <div>
        <p className="font-syne font-semibold text-[15px]" style={{ color: "#d97706" }}>
          Viewing Only — Editing Locked
        </p>
        <p className="font-mono text-[12px] mt-1" style={{ color: "var(--text2)" }}>
          {prettyDate(date)} is more than {EDIT_WINDOW} days ago. This log is read-only.
        </p>
      </div>
    </div>
  );
}

function ViewEmptyBanner({ date }: { date: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(124,110,243,0.10)" }}>
        <Eye size={24} style={{ color: "var(--accent)" }} />
      </div>
      <div className="text-center px-6 space-y-2">
        <p className="font-syne font-bold text-[17px]" style={{ color: "var(--text)" }}>
          No log for this date
        </p>
        <p className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
          {prettyDate(date)}
        </p>
        <p className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
          This date is beyond {ENTRY_WINDOW} days — no new entries can be added.
          <br />You can still view logs for any past date that was logged.
        </p>
      </div>
    </div>
  );
}

function OneTimeWarningBanner({ date }: { date: string }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 rounded-2xl"
      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(245,158,11,0.15)" }}>
        <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
      </div>
      <div>
        <p className="font-syne font-semibold text-[15px]" style={{ color: "#d97706" }}>
          One-Time Entry — Cannot Be Edited Later
        </p>
        <p className="font-mono text-[12px] mt-1" style={{ color: "var(--text2)" }}>
          {prettyDate(date)} is {daysAgo(date)} days ago (beyond the {EDIT_WINDOW}-day edit window).
          Once you save this log, <strong>it cannot be changed</strong>. Please double-check your data before saving.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOLIDAY BANNER
// ─────────────────────────────────────────────────────────────────
function HolidayBanner({ date, notes }: { date: string; notes: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid rgba(245,158,11,0.30)" }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(245,158,11,0.12)" }}>
        <Palmtree size={28} style={{ color: "#f59e0b" }} />
      </div>
      <div className="text-center space-y-2 px-6">
        <h2 className="font-syne font-bold text-[20px]" style={{ color: "#d97706" }}>Holiday 🌴</h2>
        <p className="font-mono text-[13px]" style={{ color: "var(--text2)" }}>{prettyDate(date)}</p>
        {notes && (
          <p className="font-mono text-[12px] px-4 py-2 rounded-xl"
            style={{ color: "var(--text2)", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
            {notes}
          </p>
        )}
        <p className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
          Work logging is disabled for this date.
        </p>
      </div>
      <Link href="/dashboard/holiday"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[13px] font-medium no-underline"
        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.30)", color: "#d97706" }}>
        <Palmtree size={14} /> Manage Holidays
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOG FORM — single form for all editable modes
// ─────────────────────────────────────────────────────────────────
function LogForm({
  selectedDate, dateMode, hasExisting,
  entryTime, setEntryTime, exitTime, setExitTime,
  breaks, setBreaks, notes, setNotes,
  requiredWorkHours, requiredWorkHoursOverride, userDefaultHours,
  onRequiredChange, onRequiredClear,
  isDirty, everSaved, saving, onSave,
}: {
  selectedDate: string; dateMode: DateMode; hasExisting: boolean;
  entryTime: string; setEntryTime: (v: string) => void;
  exitTime:  string; setExitTime:  (v: string) => void;
  breaks:    BreakEntry[]; setBreaks: React.Dispatch<React.SetStateAction<BreakEntry[]>>;
  notes:     string; setNotes: (v: string) => void;
  requiredWorkHours: number; requiredWorkHoursOverride: number | null; userDefaultHours: number;
  onRequiredChange: (h: number) => void; onRequiredClear: () => void;
  isDirty: boolean; everSaved: boolean; saving: boolean; onSave: () => void;
}) {
  const readOnly    = dateMode === "view-only";
  const isOneTime   = dateMode === "one-time-add";

  const [activePicker, setActivePicker] = useState<"entry" | "exit" | null>(null);
  const [showCustom,   setShowCustom]   = useState(false);
  const [customMins,   setCustomMins]   = useState("10");
  const [customLabel,  setCustomLabel]  = useState("");

  const calc = useMemo(() => {
    const em = toMins(entryTime), xm = toMins(exitTime);
    const tb = breaks.reduce((a, b) => a + b.minutes, 0);
    const om = xm > em && em > 0 ? xm - em : 0;
    const pr = Math.max(0, om - tb);
    const rq = requiredWorkHours * 60;
    return {
      totalBreak: tb, officeMins: om, productive: pr,
      remaining: Math.max(0, rq - pr),
      pct:       rq > 0 ? (pr / rq) * 100 : 0,
      overtime:  Math.max(0, pr - rq),
    };
  }, [entryTime, exitTime, breaks, requiredWorkHours]);

  function addQuickBreak(type: "tea" | "lunch", label: string, mins: number) {
    if (readOnly) return;
    setBreaks(p => [...p, { id: uid(), label, minutes: mins, type }]);
  }
  function addCustomBreak() {
    if (readOnly) return;
    const mins = parseInt(customMins, 10);
    if (!mins || mins <= 0) { toast.error("Enter valid minutes"); return; }
    setBreaks(p => [...p, { id: uid(), label: customLabel.trim() || "Custom Break", minutes: mins, type: "custom" }]);
    setShowCustom(false); setCustomMins("10"); setCustomLabel("");
  }

  return (
    <>
      {activePicker && !readOnly && (
        <ClockPicker
          value={activePicker === "entry" ? (entryTime || "09:00") : (exitTime || "18:00")}
          onChange={v => { if (activePicker === "entry") setEntryTime(v); else setExitTime(v); }}
          onClose={() => setActivePicker(null)}
        />
      )}

      {/* Mode banners */}
      {readOnly    && <ViewOnlyBanner date={selectedDate} />}
      {isOneTime   && <OneTimeWarningBanner date={selectedDate} />}

      {/* Work done */}
      {calc.pct >= 100 && exitTime && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(34,211,160,0.15)" }}>
            <Zap size={15} style={{ color: "var(--green)" }} />
          </div>
          <p className="font-syne font-bold text-[18px]" style={{ color: "var(--green)" }}>
            {fmtHLabel(requiredWorkHours)} productive hours completed ✓
          </p>
        </div>
      )}

      {/* Time entry */}
      <Card>
        <CardHeader icon={Clock} iconColor="var(--accent)" title="Work Hours"
          right={
            readOnly
              ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <Lock size={10} style={{ color: "#d97706" }} />
                  <span className="font-mono text-[10px]" style={{ color: "#d97706" }}>View only</span>
                </div>
              : <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>tap to change time</span>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <TimeButton label="Entry Time" icon={LogIn}  value={entryTime} accentColor="#7c6ef3"
            onClick={() => setActivePicker("entry")} readOnly={readOnly} />
          <TimeButton label="Exit Time"  icon={LogOut} value={exitTime}  accentColor="#22d3a0"
            onClick={() => setActivePicker("exit")}  readOnly={readOnly} />
        </div>
      </Card>

      {/* Required hours */}
      <RequiredHoursEditor
        value={requiredWorkHours} defaultValue={userDefaultHours}
        hasOverride={requiredWorkHoursOverride !== null}
        onChange={onRequiredChange} onClear={onRequiredClear}
        readOnly={readOnly}
      />

      {/* Breaks */}
      <Card>
        <CardHeader icon={Coffee} iconColor="var(--amber)" title="Breaks"
          right={calc.totalBreak > 0
            ? <span className="font-mono text-[11px] px-2 py-0.5 rounded-md"
                style={{ color: "var(--amber)", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                Total: {fmtDuration(calc.totalBreak)}
              </span>
            : undefined}
        />

        {!readOnly && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => addQuickBreak("tea", "Tea / Coffee", 15)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
              style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)", color: "var(--amber)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.20)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.10)")}>
              <Coffee size={13} /> Tea / Coffee <span style={{ color: "var(--text3)", fontSize: "10px" }}>15m</span>
            </button>
            <button onClick={() => addQuickBreak("lunch", "Lunch Break", 30)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
              style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.25)", color: "var(--green)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,160,0.20)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(34,211,160,0.10)")}>
              <UtensilsCrossed size={13} /> Lunch Break <span style={{ color: "var(--text3)", fontSize: "10px" }}>30m</span>
            </button>
            <button onClick={() => setShowCustom(!showCustom)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
              style={{ background: "rgba(124,110,243,0.10)", border: "1px solid rgba(124,110,243,0.25)", color: "var(--accent2)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,110,243,0.20)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,110,243,0.10)")}>
              <Plus size={13} /> Custom
            </button>
          </div>
        )}

        {showCustom && !readOnly && (
          <div className="flex flex-col sm:flex-row gap-2 p-4 rounded-xl mb-4"
            style={{ background: "var(--bg)", border: "1px solid rgba(124,110,243,0.25)" }}>
            <input placeholder="Label (e.g. Prayer Break)" value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustomBreak()}
              className="flex-1 rounded-xl px-3 py-2 font-mono text-[13px] focus:outline-none"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="480" value={customMins}
                onChange={e => setCustomMins(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCustomBreak()}
                className="w-20 rounded-xl px-3 py-2 font-mono text-[13px] focus:outline-none text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
              <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>min</span>
              <button onClick={addCustomBreak}
                className="px-4 py-2 rounded-xl text-white font-mono text-[12px] font-medium cursor-pointer border-none"
                style={{ background: "var(--accent)" }}>Add</button>
              <button onClick={() => { setShowCustom(false); setCustomMins("10"); setCustomLabel(""); }}
                className="bg-transparent border-none cursor-pointer p-0" style={{ color: "var(--text3)" }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {breaks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {breaks.map(br => (
              <BreakChip key={br.id} br={br}
                onRemove={() => !readOnly && setBreaks(p => p.filter(b => b.id !== br.id))}
                readOnly={readOnly} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-[12px] text-center py-3" style={{ color: "var(--text4)" }}>
            {readOnly ? "No breaks recorded for this day." : "No breaks yet — tap a button above to add one"}
          </p>
        )}
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Office Time",  value: fmtDuration(calc.officeMins), color: "var(--text2)",  icon: CalendarDays, bg: "var(--surface2)"       },
          { label: "Break Time",   value: fmtDuration(calc.totalBreak), color: "var(--amber)",  icon: Coffee,      bg: "rgba(245,158,11,0.12)"   },
          { label: "Productive",   value: fmtDuration(calc.productive), color: "var(--accent)", icon: Zap,         bg: "rgba(124,110,243,0.12)"  },
          {
            label: calc.pct >= 100 ? "Completed!" : "Remaining",
            value: calc.pct >= 100 ? "Done ✓" : fmtDuration(calc.remaining),
            color: calc.pct >= 100 ? "var(--green)" : "var(--text2)",
            icon:  calc.pct >= 100 ? Zap : Clock,
            bg:    calc.pct >= 100 ? "rgba(34,211,160,0.12)" : "var(--surface2)",
          },
        ].map(({ label, value, color, icon: Icon, bg }) => (
          <div key={label} className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>{label}</span>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon size={12} style={{ color }} />
              </div>
            </div>
            <p className="font-syne font-extrabold text-[20px] leading-none" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Overtime / underwork */}
      {exitTime && calc.overtime > 0 && (
        <div className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,211,160,0.15)" }}>
              <TrendingUp size={15} style={{ color: "#22d3a0" }} />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#22d3a0" }}>Overtime</p>
              <p className="font-syne font-bold text-[18px]" style={{ color: "var(--text)" }}>
                Extra {fmtDuration(calc.overtime)} worked 🎉
              </p>
            </div>
          </div>
          <p className="font-syne font-extrabold text-[22px]" style={{ color: "#22d3a0" }}>
            +{fmtDuration(calc.overtime)}
          </p>
        </div>
      )}

      {exitTime && calc.pct < 100 && calc.productive > 0 && (
        <div className="flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(248,113,113,0.15)" }}>
              <Clock size={15} style={{ color: "#f87171" }} />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#f87171" }}>Short of Target</p>
              <p className="font-syne font-bold text-[18px]" style={{ color: "var(--text)" }}>
                {fmtDuration(calc.remaining)} below {fmtHLabel(requiredWorkHours)} target
              </p>
            </div>
          </div>
          <p className="font-syne font-extrabold text-[22px]" style={{ color: "#f87171" }}>-{fmtDuration(calc.remaining)}</p>
        </div>
      )}

      {/* Progress bar */}
      {(entryTime || exitTime) && (
        <div className="rounded-2xl px-5 py-4 space-y-2"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>
              Daily progress — {fmtHLabel(requiredWorkHours)} target
              {requiredWorkHoursOverride !== null && (
                <span style={{ color: "var(--accent)" }}> · custom</span>
              )}
            </span>
            <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--text2)" }}>
              {Math.min(100, Math.round(calc.pct))}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border2)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width:      `${Math.min(100, calc.pct)}%`,
                background: calc.pct >= 100 ? "#22d3a0" : calc.pct >= 60 ? "#7c6ef3" : "#f59e0b",
              }} />
          </div>
        </div>
      )}

      {/* Notes */}
      <Card>
        <label className="font-mono text-[11px] uppercase tracking-widest block mb-3" style={{ color: "var(--text3)" }}>
          Notes {readOnly ? "(read-only)" : "(optional)"}
        </label>
        <textarea rows={3} value={notes}
          onChange={e => !readOnly && setNotes(e.target.value)}
          placeholder={readOnly ? "No notes for this day." : "What did you work on this day?"}
          readOnly={readOnly}
          className="w-full rounded-xl px-4 py-3 font-mono text-[13px] resize-none focus:outline-none"
          style={{
            background: readOnly ? "var(--surface2)" : "var(--bg)",
            border: "1px solid var(--border2)",
            color: readOnly ? "var(--text3)" : "var(--text)",
            cursor: readOnly ? "default" : "text",
          }}
          onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
      </Card>

      {/* Save row — only shown in editable modes */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3 flex-wrap">
          {everSaved && !isDirty && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
              <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
                {hasExisting ? "All changes saved" : "Log saved"}
              </span>
            </div>
          )}
          {isDirty && (
            <span className="font-mono text-[11px]" style={{ color: "var(--amber)" }}>● Unsaved changes</span>
          )}
          <button
            onClick={onSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-mono font-medium text-[14px] border-none transition-all"
            style={{
              background: isDirty ? (isOneTime ? "#d97706" : "var(--accent)") : "var(--border2)",
              boxShadow:  isDirty ? `0 0 24px ${isOneTime ? "rgba(217,119,6,0.35)" : "rgba(124,110,243,0.35)"}` : "none",
              cursor:     isDirty ? "pointer" : "not-allowed",
              opacity:    isDirty ? 1 : 0.55,
              color:      isDirty ? "#fff" : "var(--text3)",
            }}
            onMouseEnter={e => { if (isDirty) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; }}>
            {saving
              ? <><RefreshCw size={15} className="animate-spin" /> Saving...</>
              : hasExisting
              ? <><PencilLine size={15} /> Update Log</>
              : isOneTime
              ? <><Save size={15} /> Save (One-Time)</>
              : <><Save size={15} /> Save Log</>
            }
          </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────
export default function DateWisePage() {
  const today = localToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [entryTime,    setEntryTime]    = useState("");
  const [exitTime,     setExitTime]     = useState("");
  const [breaks,       setBreaks]       = useState<BreakEntry[]>([]);
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [fetching,     setFetching]     = useState(false);

  const [hasExisting,   setHasExisting]   = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot>(EMPTY_SNAPSHOT);
  const [everSaved,     setEverSaved]     = useState(false);

  const [requiredWorkHours,         setRequiredWorkHours]         = useState(8.5);
  const [requiredWorkHoursOverride, setRequiredWorkHoursOverride] = useState<number | null>(null);
  const [userDefaultHours,          setUserDefaultHours]          = useState(8.5);

  const [isHoliday,    setIsHoliday]    = useState(false);
  const [holidayNotes, setHolidayNotes] = useState("");

  const calRef = useRef<CalendarHandle>(null);

  // ── Determine the mode for the selected date ─────────────────
  const age = daysAgo(selectedDate); // how many days ago

  const dateMode: DateMode = useMemo(() => {
    if (isHoliday) return "view-only"; // holiday = handled separately
    const a = daysAgo(selectedDate);
    if (hasExisting) {
      // Has a log → editable only within 30 days, otherwise view-only
      return a <= EDIT_WINDOW ? "editable-existing" : "view-only";
    } else {
      // No log yet
      if (a > ENTRY_WINDOW) return "view-empty";          // beyond 90 days: can't add
      if (a > EDIT_WINDOW)  return "one-time-add";        // 31–90 days: one-time add with warning
      return "editable-new";                              // within 30 days: add freely
    }
  }, [selectedDate, hasExisting, isHoliday]);

  const isDirty = useMemo(() => {
    if (dateMode === "view-only" || dateMode === "view-empty") return false;
    if (!everSaved) return !!(entryTime || exitTime || breaks.length || notes.trim() ||
      Math.abs(requiredWorkHours - userDefaultHours) > 0.01);
    return (
      entryTime           !== savedSnapshot.entryTime           ||
      exitTime            !== savedSnapshot.exitTime            ||
      notes.trim()        !== savedSnapshot.notes               ||
      breaksToKey(breaks) !== savedSnapshot.breaksKey           ||
      Math.abs(requiredWorkHours - savedSnapshot.requiredWorkHours) > 0.01
    );
  }, [dateMode, entryTime, exitTime, breaks, notes, savedSnapshot, everSaved, requiredWorkHours, userDefaultHours]);

  function onRequiredChange(h: number) {
    setRequiredWorkHours(h);
    setRequiredWorkHoursOverride(h);
  }
  function onRequiredClear() {
    setRequiredWorkHours(userDefaultHours);
    setRequiredWorkHoursOverride(null);
  }

  const fetchLog = useCallback(async (date: string) => {
    setFetching(true);
    setEntryTime(""); setExitTime(""); setBreaks([]); setNotes("");
    setSavedSnapshot(EMPTY_SNAPSHOT); setEverSaved(false); setHasExisting(false);
    setIsHoliday(false); setHolidayNotes(""); setRequiredWorkHoursOverride(null);

    try {
      const [logRes, userRes] = await Promise.all([
        fetch(`/api/work/date?date=${date}`),
        fetch("/api/work/today"), // to get user's defaultWorkHours
      ]);
      const [logData, userData] = await Promise.all([logRes.json(), userRes.json()]);

      const defHours: number = userData?.defaults?.requiredWorkHours ?? 8.5;
      setUserDefaultHours(defHours);
      setRequiredWorkHours(defHours);

      if (logData.success && logData.data) {
        const d = logData.data;
        if (d.isHoliday) {
          setIsHoliday(true); setHolidayNotes(d.notes || ""); setHasExisting(true); return;
        }

        const effectiveH: number     = d.requiredWorkHours ?? defHours;
        const overrideH: number|null = d.requiredWorkHoursOverride ?? null;
        setRequiredWorkHours(effectiveH);
        setRequiredWorkHoursOverride(overrideH);

        const loadedEntry  = isoToHHMM(d.entryTime);
        const loadedExit   = isoToHHMM(d.exitTime);
        const loadedNotes  = d.notes || "";
        const loadedBreaks: BreakEntry[] = (d.breaks || []).map((b: any) => ({
          id:      uid(),
          label:   b.label || (b.type === "tea" ? "Tea Break" : b.type === "lunch" ? "Lunch Break" : "Custom Break"),
          minutes: Math.round(b.duration / 60),
          type:    b.type || "custom",
        }));

        setEntryTime(loadedEntry); setExitTime(loadedExit);
        setNotes(loadedNotes);    setBreaks(loadedBreaks);
        setSavedSnapshot({
          entryTime: loadedEntry, exitTime: loadedExit,
          notes: loadedNotes.trim(), breaksKey: breaksToKey(loadedBreaks),
          requiredWorkHours: effectiveH,
        });
        setHasExisting(true); setEverSaved(true);
      }
    } catch {
      toast.error("Failed to fetch log for this date");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchLog(selectedDate); }, [selectedDate, fetchLog]);

  const handleSave = async () => {
    if (!entryTime) { toast.error("Entry time is required"); return; }
    if (!isDirty)   return;

    setSaving(true);
    try {
      let cursor = entryTime;
      const apiBreaks = breaks.map(b => {
        const start = cursor, end = addMinsToTime(start, b.minutes);
        cursor = end;
        return { start, end, type: b.type, label: b.label };
      });
      const res  = await fetch("/api/work/save-date", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          date: selectedDate, entryTime,
          exitTime: exitTime || null, breaks: apiBreaks, notes,
          requiredWorkHours: requiredWorkHoursOverride,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(hasExisting ? "Log updated ✓" : "Log saved! 🎉");
        const savedH = data.data?.requiredWorkHours ?? requiredWorkHours;
        setSavedSnapshot({ entryTime, exitTime, notes: notes.trim(), breaksKey: breaksToKey(breaks), requiredWorkHours: savedH });
        setEverSaved(true); setHasExisting(true);
        calRef.current?.refreshDots();
      } else {
        toast.error(data.message || "Save failed");
      }
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSaving(false);
    }
  };

  // ── Sidebar status badge ──────────────────────────────────────
  const statusBadge = useMemo(() => {
    if (fetching)    return null;
    if (isHoliday)   return { icon: Palmtree,     color: "#f59e0b",        bg: "rgba(245,158,11,0.12)",    border: "rgba(245,158,11,0.25)",    label: "Holiday"             };
    switch (dateMode) {
      case "view-only":        return { icon: Lock,         color: "#d97706",        bg: "rgba(245,158,11,0.12)",    border: "rgba(245,158,11,0.25)",    label: "View only"           };
      case "view-empty":       return { icon: Eye,          color: "var(--text3)",   bg: "var(--surface2)",          border: "var(--border)",            label: "No log"              };
      case "one-time-add":     return { icon: AlertTriangle,color: "#d97706",        bg: "rgba(245,158,11,0.12)",    border: "rgba(245,158,11,0.25)",    label: "One-time add"        };
      case "editable-existing":return { icon: PencilLine,   color: "var(--accent)",  bg: "rgba(124,110,243,0.10)",   border: "rgba(124,110,243,0.25)",   label: "Editing log"         };
      case "editable-new":     return { icon: FilePlus2,    color: "var(--green)",   bg: "rgba(34,211,160,0.10)",    border: "rgba(34,211,160,0.25)",    label: "New entry"           };
    }
  }, [fetching, isHoliday, dateMode]);

  return (
    <div className="max-w-6xl mx-auto pb-6">
      <div className="mb-5">
        <h1 className="font-syne font-extrabold text-[22px] tracking-tight" style={{ color: "var(--text)" }}>
          Date-Wise Log
        </h1>
        <p className="font-mono text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
          View any date · Add within {ENTRY_WINDOW} days · Edit within {EDIT_WINDOW} days
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* LEFT — sticky calendar + info */}
        <div className="w-full lg:w-[300px] lg:sticky lg:top-5 shrink-0 space-y-3">

          <CalendarPicker ref={calRef} value={selectedDate} onChange={setSelectedDate} />

          {/* Selected date info */}
          <div className="rounded-2xl px-4 py-3 space-y-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>Selected</p>
            <p className="font-syne font-bold text-[14px] leading-snug" style={{ color: "var(--text)" }}>
              {prettyDate(selectedDate)}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {fetching ? (
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={11} className="animate-spin" style={{ color: "var(--text3)" }} />
                  <span className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>Loading…</span>
                </div>
              ) : statusBadge ? (() => {
                const { icon: BadgeIcon, color, bg, border, label } = statusBadge;
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: bg, border: `1px solid ${border}` }}>
                    <BadgeIcon size={10} style={{ color }} />
                    <span className="font-mono text-[10px]" style={{ color }}>{label}</span>
                  </div>
                );
              })() : null}
              {selectedDate === today && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(124,110,243,0.12)", border: "1px solid rgba(124,110,243,0.3)", color: "var(--accent)" }}>
                  Today
                </span>
              )}
            </div>
          </div>

          {/* Access rules card */}
          <div className="rounded-2xl px-4 py-3 space-y-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text3)" }}>Access Rules</p>
            {[
              { label: "View any date",              detail: "All history",             icon: Eye,          color: "var(--text3)"  },
              { label: `Add new entry`,              detail: `Within ${ENTRY_WINDOW} days`,icon: FilePlus2,    color: "var(--green)"  },
              { label: `30–${ENTRY_WINDOW} days ago`,detail: "One-time only",           icon: AlertTriangle,color: "#d97706"       },
              { label: `Edit existing`,              detail: `Within ${EDIT_WINDOW} days`, icon: PencilLine,   color: "var(--accent)" },
            ].map(({ label, detail, icon: RuleIcon, color }) => (
              <div key={label} className="flex items-center gap-2">
                <RuleIcon size={11} style={{ color }} />
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-mono text-[11px]" style={{ color: "var(--text2)" }}>{label}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>{detail}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Current date status */}
          {!fetching && !isHoliday && (
            <div className="rounded-2xl px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text3)" }}>
                This date
              </p>
              <div className="space-y-1">
                {age <= 0 && (
                  <p className="font-mono text-[11px]" style={{ color: "var(--green)" }}>Today — fully editable</p>
                )}
                {age > 0 && age <= EDIT_WINDOW && (
                  <p className="font-mono text-[11px]" style={{ color: "var(--green)" }}>
                    {age} day{age > 1 ? "s" : ""} ago — fully editable
                  </p>
                )}
                {age > EDIT_WINDOW && age <= ENTRY_WINDOW && !hasExisting && (
                  <p className="font-mono text-[11px]" style={{ color: "#d97706" }}>
                    {age} days ago — one-time add only
                  </p>
                )}
                {age > EDIT_WINDOW && hasExisting && (
                  <p className="font-mono text-[11px]" style={{ color: "#d97706" }}>
                    {age} days ago — view only
                  </p>
                )}
                {age > ENTRY_WINDOW && !hasExisting && (
                  <p className="font-mono text-[11px]" style={{ color: "var(--text4)" }}>
                    {age} days ago — cannot add
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Refresh */}
          <button onClick={() => fetchLog(selectedDate)} disabled={fetching}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-[12px] cursor-pointer transition-all border-none"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.4)";
              (e.currentTarget as HTMLElement).style.color       = "var(--text)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color       = "var(--text2)";
            }}>
            <RefreshCw size={12} className={fetching ? "animate-spin" : ""} />
            {fetching ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* RIGHT — form panel */}
        <div className="flex-1 min-w-0 space-y-5">

          {fetching && (
            <div className="flex items-center justify-center py-24 rounded-2xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
                  Fetching log for {shortDate(selectedDate)}…
                </p>
              </div>
            </div>
          )}

          {!fetching && isHoliday && <HolidayBanner date={selectedDate} notes={holidayNotes} />}

          {!fetching && !isHoliday && dateMode === "view-empty" && (
            <ViewEmptyBanner date={selectedDate} />
          )}

          {!fetching && !isHoliday && dateMode !== "view-empty" && (
            <LogForm
              selectedDate={selectedDate}
              dateMode={dateMode}
              hasExisting={hasExisting}
              entryTime={entryTime}   setEntryTime={setEntryTime}
              exitTime={exitTime}     setExitTime={setExitTime}
              breaks={breaks}         setBreaks={setBreaks}
              notes={notes}           setNotes={setNotes}
              requiredWorkHours={requiredWorkHours}
              requiredWorkHoursOverride={requiredWorkHoursOverride}
              userDefaultHours={userDefaultHours}
              onRequiredChange={onRequiredChange}
              onRequiredClear={onRequiredClear}
              isDirty={isDirty}
              everSaved={everSaved}
              saving={saving}
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    </div>
  );
}