// app/dashboard/today/page.tsx

"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef,
} from "react";
import toast from "react-hot-toast";
import {
  Clock, LogIn, LogOut, Coffee, Zap, Timer,
  Plus, Save, RefreshCw, CalendarDays,
  ChevronLeft, UtensilsCrossed, X, CheckCircle2,
  Palmtree,
} from "lucide-react";
import Link from "next/link";

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
  entryTime: string;
  exitTime:  string;
  notes:     string;
  breaksKey: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const uid  = () => Math.random().toString(36).slice(2, 9);

function breaksToKey(breaks: BreakEntry[]): string {
  return breaks.map(b => `${b.type}:${b.minutes}:${b.label}`).join("|");
}

const EMPTY_SNAPSHOT: SavedSnapshot = {
  entryTime: "",
  exitTime:  "",
  notes:     "",
  breaksKey: "",
};

function fmtDuration(mins: number): string {
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtSecs(totalSecs: number): string {
  if (totalSecs <= 0) return "00:00:00";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${pad2(h % 12 || 12)}:${pad2(m)} ${ap}`;
}

function isoToHHMM(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function addMinsToTime(hhmm: string, mins: number): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

function toMins(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ─────────────────────────────────────────────────────────────────
// CLOCK PICKER
// ─────────────────────────────────────────────────────────────────
type ClockMode = "hour" | "minute";

function ClockPicker({ value, onChange, onClose }: {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}) {
  const parsed   = value ? value.split(":").map(Number) : [new Date().getHours(), new Date().getMinutes()];
  const [hour,   setHour]   = useState(parsed[0]);
  const [minute, setMinute] = useState(parsed[1]);
  const [mode,   setMode]   = useState<ClockMode>("hour");
  const [ampm,   setAmpm]   = useState<"AM" | "PM">(parsed[0] >= 12 ? "PM" : "AM");
  const clockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (clockRef.current && !clockRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const display12h = hour % 12 === 0 ? 12 : hour % 12;

  function confirmTime() {
    onChange(`${pad2(hour)}:${pad2(minute)}`);
    onClose();
  }

  function pickHour(h12: number) {
    let h24 = h12 % 12;
    if (ampm === "PM") h24 += 12;
    setHour(h24);
    setMode("minute");
  }

  function pickMinute(m: number) {
    setMinute(m);
    onChange(`${pad2(hour)}:${pad2(m)}`);
    onClose();
  }

  function toggleAmPm(ap: "AM" | "PM") {
    setAmpm(ap);
    if (ap === "AM" && hour >= 12) setHour(h => h - 12);
    if (ap === "PM" && hour < 12)  setHour(h => h + 12);
  }

  function clockPos(i: number, total: number, r = 38) {
    const angle = ((i / total) * 360 - 90) * (Math.PI / 180);
    return { left: `${50 + r * Math.cos(angle)}%`, top: `${50 + r * Math.sin(angle)}%` };
  }

  const hours   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const handAngle = mode === "hour"
    ? ((display12h % 12) / 12) * 360 - 90
    : (minute / 60) * 360 - 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
      <div ref={clockRef} className="relative rounded-3xl p-6 w-[300px]"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border2)",
          boxShadow:  "0 0 60px rgba(124,110,243,0.20)",
          animation:  "fadeUp 0.18s ease",
        }}>

        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
            {mode === "hour" ? "Select hour" : "Select minute"}
          </span>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer p-0 transition-colors"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="flex items-center rounded-2xl px-4 py-2 gap-1.5"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <button onClick={() => setMode("hour")}
              className="font-syne font-bold text-[28px] bg-transparent border-none cursor-pointer p-0 transition-colors"
              style={{ color: mode === "hour" ? "var(--accent)" : "var(--text2)" }}>
              {pad2(display12h)}
            </button>
            <span className="font-syne font-bold text-[28px]" style={{ color: "var(--text4)" }}>:</span>
            <button onClick={() => setMode("minute")}
              className="font-syne font-bold text-[28px] bg-transparent border-none cursor-pointer p-0 transition-colors"
              style={{ color: mode === "minute" ? "var(--accent)" : "var(--text2)" }}>
              {pad2(minute)}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {(["AM","PM"] as const).map(ap => (
              <button key={ap} onClick={() => toggleAmPm(ap)}
                className="font-mono text-[12px] font-medium px-3 py-1 rounded-lg cursor-pointer border-none transition-all"
                style={ampm === ap
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "transparent", border: "1px solid var(--border2)", color: "var(--text3)" }}>
                {ap}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mb-5" style={{ width: "200px", height: "200px" }}>
          <div className="absolute inset-0 rounded-full"
            style={{ background: "var(--bg)", border: "2px solid var(--border)" }} />
          <div className="absolute rounded-full"
            style={{
              width: "2px", height: "38%",
              left: "calc(50% - 1px)", top: "12%",
              transformOrigin: "bottom center",
              transform: `rotate(${handAngle + 90}deg)`,
              transition: "transform 0.2s ease",
              background: "rgba(124,110,243,0.45)",
            }} />
          <div className="absolute w-3 h-3 rounded-full"
            style={{ top: "calc(50% - 6px)", left: "calc(50% - 6px)", background: "var(--accent)" }} />

          {(mode === "hour" ? hours : minutes).map((num, i) => {
            const pos        = clockPos(i, 12);
            const isSelected = mode === "hour" ? display12h === num : minute === num;
            return (
              <button key={num}
                onClick={() => mode === "hour" ? pickHour(num) : pickMinute(num)}
                className="absolute w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-mono text-[12px] font-medium transition-all cursor-pointer border-none"
                style={{
                  left:       pos.left, top:  pos.top,
                  background: isSelected ? "var(--accent)" : "transparent",
                  color:      isSelected ? "#fff"          : "var(--text2)",
                  boxShadow:  isSelected ? "0 0 12px rgba(124,110,243,0.5)" : "none",
                }}>
                {mode === "minute" ? pad2(num) : num}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {mode === "minute" && (
            <button onClick={() => setMode("hour")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[12px] transition-all cursor-pointer"
              style={{ background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text2)" }}>
              <ChevronLeft size={13} /> Hours
            </button>
          )}
          <button onClick={confirmTime}
            className="flex-1 py-2.5 rounded-xl font-mono font-medium text-[13px] text-white transition-all hover:-translate-y-0.5 cursor-pointer border-none"
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
function TimeButton({ label, icon: Icon, value, accentColor, onClick }: {
  label: string; icon: React.ElementType; value: string;
  accentColor: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full group flex flex-col gap-3 rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border2)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
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
          <p className="font-syne font-extrabold text-[30px] leading-none tracking-tight"
            style={{ color: "var(--text)" }}>
            {to12h(value).split(" ")[0]}
          </p>
          <p className="font-mono text-[12px] mt-1" style={{ color: accentColor }}>
            {to12h(value).split(" ")[1]}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-syne font-bold text-[22px] leading-none" style={{ color: "var(--text4)" }}>
            Tap to set
          </p>
          <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text4)" }}>
            click to open clock
          </p>
        </div>
      )}
      <div className="h-px w-full opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
        style={{ background: `linear-gradient(to right, transparent, ${accentColor}60, transparent)` }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// LIVE TIMER
// ─────────────────────────────────────────────────────────────────
function LiveTimer({ entryHHMM, breakMinutes }: { entryHHMM: string; breakMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function tick() {
      if (!entryHHMM) { setElapsed(0); return; }
      const [h, m] = entryHHMM.split(":").map(Number);
      const entryMs  = new Date().setHours(h, m, 0, 0);
      const diffSecs = Math.max(0, Math.floor((Date.now() - entryMs) / 1000));
      setElapsed(Math.max(0, diffSecs - breakMinutes * 60));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entryHHMM, breakMinutes]);

  const pct      = Math.min(100, (elapsed / (8.5 * 3600)) * 100);
  const rawColor = pct >= 100 ? "#22d3a0" : pct >= 70 ? "#7c6ef3" : pct >= 40 ? "#a78bfa" : "#fbbf24";

  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--green)" }} />
        <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
          Live productive time
        </span>
      </div>
      <p className="font-syne font-extrabold text-[36px] tracking-tight leading-none" style={{ color: rawColor }}>
        {fmtSecs(elapsed)}
      </p>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: rawColor }} />
      </div>
      <p className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>
        {Math.round(pct)}% of 8h 30m target
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BREAK CHIP
// ─────────────────────────────────────────────────────────────────
function BreakChip({ br, onRemove }: { br: BreakEntry; onRemove: () => void }) {
  const colors = {
    tea:    { bg: "#fbbf2415", border: "#fbbf2445", text: "#d97706" },
    lunch:  { bg: "#22d3a015", border: "#22d3a045", text: "#10b981" },
    custom: { bg: "#a78bfa15", border: "#a78bfa45", text: "#8b7cf8" },
  };
  const c = colors[br.type];
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="font-mono text-[13px] font-medium" style={{ color: c.text }}>{br.label}</span>
      <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>·</span>
      <span className="font-mono text-[12px]" style={{ color: "var(--text2)" }}>{br.minutes}m</span>
      <button onClick={onRemove}
        className="ml-1 bg-transparent border-none cursor-pointer p-0 transition-colors"
        style={{ color: "var(--text4)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--text4)")}
        aria-label="Remove break">
        <X size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CARD HELPERS
// ─────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, iconColor, title, right }: {
  icon: React.ElementType; iconColor: string; title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 mb-4"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <Icon size={14} style={{ color: iconColor }} />
      <h2 className="font-syne font-semibold text-[14px]" style={{ color: "var(--text)" }}>{title}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOLIDAY BANNER  (shown instead of the form when today is a holiday)
// ─────────────────────────────────────────────────────────────────
function HolidayBanner({ notes }: { notes: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid rgba(245,158,11,0.30)" }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(245,158,11,0.12)" }}>
        <Palmtree size={28} style={{ color: "#f59e0b" }} />
      </div>
      <div className="text-center space-y-2 px-6">
        <h2 className="font-syne font-bold text-[20px]" style={{ color: "#f59e0b" }}>
          Today is a Holiday 🌴
        </h2>
        {notes && (
          <p className="font-mono text-[13px]" style={{ color: "var(--text2)" }}>{notes}</p>
        )}
        <p className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
          Work logging is disabled for holidays.<br />
          This day is excluded from all weekly &amp; monthly averages.
        </p>
      </div>
      <Link href="/dashboard/holiday"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[13px] font-medium transition-all no-underline"
        style={{
          background: "rgba(245,158,11,0.12)",
          border:     "1px solid rgba(245,158,11,0.30)",
          color:      "#f59e0b",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) =>
          (e.currentTarget.style.background = "rgba(245,158,11,0.22)")}
        onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) =>
          (e.currentTarget.style.background = "rgba(245,158,11,0.12)")}>
        <Palmtree size={14} /> Manage Holidays
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function TodayTrackPage() {
  const [entryTime,    setEntryTime]    = useState("");
  const [exitTime,     setExitTime]     = useState("");
  const [breaks,       setBreaks]       = useState<BreakEntry[]>([]);
  const [notes,        setNotes]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [activePicker, setActivePicker] = useState<"entry" | "exit" | null>(null);
  const [showCustom,   setShowCustom]   = useState(false);
  const [customMins,   setCustomMins]   = useState(10);
  const [customLabel,  setCustomLabel]  = useState("");

  // ── Holiday flag ─────────────────────────────────────────────
  const [isHoliday,    setIsHoliday]    = useState(false);
  const [holidayNotes, setHolidayNotes] = useState("");

  // ── Dirty tracking ───────────────────────────────────────────
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot>(EMPTY_SNAPSHOT);
  const [everSaved,     setEverSaved]     = useState(false);

  const isDirty = useMemo(() => {
    if (!everSaved) {
      return !!(entryTime || exitTime || breaks.length || notes.trim());
    }
    return (
      entryTime                !== savedSnapshot.entryTime ||
      exitTime                 !== savedSnapshot.exitTime  ||
      notes.trim()             !== savedSnapshot.notes     ||
      breaksToKey(breaks)      !== savedSnapshot.breaksKey
    );
  }, [entryTime, exitTime, breaks, notes, savedSnapshot, everSaved]);

  // ── Load today's log ─────────────────────────────────────────
  const loadTodayLog = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/work/today");
      const data = await res.json();

      if (data.success && data.data) {
        const d = data.data;

        // ── Holiday check: if today is a holiday, show banner ──
        if (d.isHoliday) {
          setIsHoliday(true);
          setHolidayNotes(d.notes || "");
          return; // do not populate form fields
        }

        setIsHoliday(false);
        const loadedEntry  = isoToHHMM(d.entryTime);
        const loadedExit   = isoToHHMM(d.exitTime);
        const loadedNotes  = d.notes || "";
        const loadedBreaks = (d.breaks || []).map((b: any) => ({
          id:      uid(),
          label:   b.type === "tea" ? "Tea Break" : b.type === "lunch" ? "Lunch Break" : "Custom Break",
          minutes: Math.round(b.duration / 60),
          type:    b.type || "custom",
        })) as BreakEntry[];

        setEntryTime(loadedEntry);
        setExitTime(loadedExit);
        setNotes(loadedNotes);
        setBreaks(loadedBreaks);
        setSavedSnapshot({
          entryTime: loadedEntry,
          exitTime:  loadedExit,
          notes:     loadedNotes.trim(),
          breaksKey: breaksToKey(loadedBreaks),
        });
        setEverSaved(true);
      } else {
        setIsHoliday(false);
        setSavedSnapshot(EMPTY_SNAPSHOT);
        setEverSaved(false);
      }
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTodayLog(); }, [loadTodayLog]);

  // ── Calculations ─────────────────────────────────────────────
  const calc = useMemo(() => {
    const entryMins  = toMins(entryTime);
    const exitMins   = toMins(exitTime);
    const totalBreak = breaks.reduce((a, b) => a + b.minutes, 0);
    const officeMins = exitMins > entryMins && entryMins > 0 ? exitMins - entryMins : 0;
    const productive = Math.max(0, officeMins - totalBreak);
    const required   = 8.5 * 60;
    const remaining  = Math.max(0, required - productive);
    const pct        = (productive / required) * 100;
    const predictedLeave = entryTime && !exitTime
      ? addMinsToTime(entryTime, required + totalBreak) : "";
    return { totalBreak, officeMins, productive, remaining, pct, predictedLeave };
  }, [entryTime, exitTime, breaks]);

  // ── Break helpers ────────────────────────────────────────────
  function addQuickBreak(type: "tea" | "lunch", label: string, mins: number) {
    setBreaks(p => [...p, { id: uid(), label, minutes: mins, type }]);
  }

  function addCustomBreak() {
    if (customMins <= 0) return;
    const label = customLabel.trim() || "Custom Break";
    setBreaks(p => [...p, { id: uid(), label, minutes: customMins, type: "custom" }]);
    setShowCustom(false);
    setCustomMins(10);
    setCustomLabel("");
  }

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!entryTime) { toast.error("Entry time is required"); return; }
    if (!isDirty)   return;

    setSaving(true);
    try {
      let cursor = entryTime;
      const apiBreaks = breaks.map(b => {
        const start = cursor;
        const end   = addMinsToTime(start, b.minutes);
        cursor      = end;
        return { start, end, type: b.type };
      });

      const res  = await fetch("/api/work/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entryTime, exitTime: exitTime || null, breaks: apiBreaks, notes }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Work log saved! 🎉");
        setSavedSnapshot({
          entryTime,
          exitTime,
          notes:     notes.trim(),
          breaksKey: breaksToKey(breaks),
        });
        setEverSaved(true);
      } else {
        toast.error(data.message || "Save failed");
      }
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
            Loading today&apos;s log...
          </p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {activePicker && (
        <ClockPicker
          value={activePicker === "entry" ? (entryTime || nowHHMM()) : (exitTime || nowHHMM())}
          onChange={val => {
            if (activePicker === "entry") setEntryTime(val);
            else setExitTime(val);
          }}
          onClose={() => setActivePicker(null)}
        />
      )}

      <div className="max-w-3xl mx-auto pb-6 space-y-5">

        {/* ── HEADER ──────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-syne font-extrabold text-[22px] tracking-tight" style={{ color: "var(--text)" }}>
              Today&apos;s Work Log
            </h1>
            <p className="font-mono text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--text3)" }}>
              <CalendarDays size={11} />
              {todayLabel()}
            </p>
          </div>
          <button onClick={loadTodayLog}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-[11px] transition-all cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.4)";
              (e.currentTarget as HTMLElement).style.color       = "var(--text)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color       = "var(--text2)";
            }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* ── HOLIDAY BANNER — replaces the entire form ───── */}
        {isHoliday && <HolidayBanner notes={holidayNotes} />}

        {/* ── NORMAL WORK LOG — only shown when NOT a holiday */}
        {!isHoliday && (
          <>
            {/* ── LIVE TIMER ──────────────────────────────── */}
            {entryTime && !exitTime && (
              <LiveTimer entryHHMM={entryTime} breakMinutes={calc.totalBreak} />
            )}

            {/* ── PREDICTED LEAVE ─────────────────────────── */}
            {calc.predictedLeave && (
              <div className="flex items-center justify-between px-5 py-4 rounded-2xl"
                style={{ background: "rgba(124,110,243,0.08)", border: "1px solid rgba(124,110,243,0.25)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(124,110,243,0.15)" }}>
                    <Clock size={15} style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                      Predicted Leave
                    </p>
                    <p className="font-syne font-bold text-[18px]" style={{ color: "var(--text)" }}>
                      You can leave at {to12h(calc.predictedLeave)} 🎉
                    </p>
                  </div>
                </div>
                <p className="font-mono text-[12px] whitespace-nowrap" style={{ color: "var(--text3)" }}>
                  {fmtDuration(calc.remaining)} left
                </p>
              </div>
            )}

            {/* ── WORK DONE BANNER ────────────────────────── */}
            {calc.pct >= 100 && exitTime && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(34,211,160,0.15)" }}>
                  <Zap size={15} style={{ color: "var(--green)" }} />
                </div>
                <p className="font-syne font-bold text-[18px]" style={{ color: "var(--green)" }}>
                  Work done! Full {fmtDuration(8.5 * 60)} completed ✓
                </p>
              </div>
            )}

            {/* ── TIME ENTRY ──────────────────────────────── */}
            <Card>
              <CardHeader
                icon={Clock} iconColor="var(--accent)" title="Work Hours"
                right={
                  <span className="font-mono text-[10px]" style={{ color: "var(--text4)" }}>
                    tap to change time
                  </span>
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <TimeButton label="Entry Time" icon={LogIn}  value={entryTime} accentColor="#7c6ef3" onClick={() => setActivePicker("entry")} />
                <TimeButton label="Exit Time"  icon={LogOut} value={exitTime}  accentColor="#22d3a0" onClick={() => setActivePicker("exit")}  />
              </div>

              {!entryTime && (
                <button onClick={() => setEntryTime(nowHHMM())}
                  className="w-full py-2.5 rounded-xl border border-dashed font-mono text-[12px] transition-all cursor-pointer mt-3"
                  style={{ borderColor: "rgba(124,110,243,0.35)", color: "var(--accent)", background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,110,243,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  ⚡ Clock in now — {to12h(nowHHMM())}
                </button>
              )}
              {entryTime && !exitTime && (
                <button onClick={() => setExitTime(nowHHMM())}
                  className="w-full py-2.5 rounded-xl border border-dashed font-mono text-[12px] transition-all cursor-pointer mt-3"
                  style={{ borderColor: "rgba(34,211,160,0.35)", color: "var(--green)", background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,160,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  ⚡ Clock out now — {to12h(nowHHMM())}
                </button>
              )}
            </Card>

            {/* ── BREAKS ──────────────────────────────────── */}
            <Card>
              <CardHeader
                icon={Coffee} iconColor="var(--amber)" title="Breaks"
                right={
                  calc.totalBreak > 0 ? (
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md"
                      style={{
                        color:      "var(--amber)",
                        background: "rgba(251,191,36,0.10)",
                        border:     "1px solid rgba(251,191,36,0.25)",
                      }}>
                      Total: {fmtDuration(calc.totalBreak)}
                    </span>
                  ) : undefined
                }
              />

              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => addQuickBreak("tea", "Tea / Coffee", 15)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
                  style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.25)", color: "var(--amber)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,191,36,0.20)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(251,191,36,0.10)")}>
                  <Coffee size={13} />Tea / Coffee
                  <span style={{ color: "var(--text3)", fontSize: "10px" }}>15m</span>
                </button>

                <button onClick={() => addQuickBreak("lunch", "Lunch Break", 30)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
                  style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.25)", color: "var(--green)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,211,160,0.20)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(34,211,160,0.10)")}>
                  <UtensilsCrossed size={13} />Lunch Break
                  <span style={{ color: "var(--text3)", fontSize: "10px" }}>30m</span>
                </button>

                <button onClick={() => setShowCustom(!showCustom)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[12px] hover:-translate-y-0.5 transition-all cursor-pointer"
                  style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.25)", color: "var(--accent2)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.20)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.10)")}>
                  <Plus size={13} />Custom
                </button>
              </div>

              {showCustom && (
                <div className="flex flex-col sm:flex-row gap-2 p-4 rounded-xl mb-4"
                  style={{ background: "var(--bg)", border: "1px solid rgba(167,139,250,0.25)" }}>
                  <input
                    placeholder="Label (e.g. Prayer Break)"
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomBreak()}
                    className="flex-1 rounded-xl px-3 py-2 font-mono text-[13px] focus:outline-none transition-colors"
                    style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--accent2)")}
                    onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max="120" value={customMins}
                      onChange={e => setCustomMins(Number(e.target.value))}
                      className="w-20 rounded-xl px-3 py-2 font-mono text-[13px] focus:outline-none transition-colors text-center"
                      style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "var(--accent2)")}
                      onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
                    <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>min</span>
                    <button onClick={addCustomBreak}
                      className="px-4 py-2 rounded-xl text-white font-mono text-[12px] transition-all hover:-translate-y-0.5 cursor-pointer border-none"
                      style={{ background: "var(--accent2)" }}>
                      Add
                    </button>
                    <button onClick={() => setShowCustom(false)}
                      className="bg-transparent border-none cursor-pointer p-0 transition-colors"
                      style={{ color: "var(--text3)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {breaks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {breaks.map(br => (
                    <BreakChip key={br.id} br={br}
                      onRemove={() => setBreaks(p => p.filter(b => b.id !== br.id))} />
                  ))}
                </div>
              ) : (
                <p className="font-mono text-[12px] text-center py-3" style={{ color: "var(--text4)" }}>
                  No breaks yet — tap a button above to add one
                </p>
              )}
            </Card>

            {/* ── SUMMARY STATS ────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Office Time",  value: fmtDuration(calc.officeMins), color: "var(--text)",   icon: Timer,  bg: "var(--border)"            },
                { label: "Break Time",   value: fmtDuration(calc.totalBreak), color: "var(--amber)",  icon: Coffee, bg: "rgba(251,191,36,0.12)"     },
                { label: "Productive",   value: fmtDuration(calc.productive), color: "var(--accent)", icon: Zap,    bg: "rgba(124,110,243,0.12)"    },
                {
                  label: calc.pct >= 100 ? "Completed!" : "Remaining",
                  value: calc.pct >= 100 ? "Done ✓"     : fmtDuration(calc.remaining),
                  color: calc.pct >= 100 ? "var(--green)" : "var(--text2)",
                  icon:  calc.pct >= 100 ? Zap : Clock,
                  bg:    calc.pct >= 100 ? "rgba(34,211,160,0.12)" : "var(--border)",
                },
              ].map(({ label, value, color, icon: Icon, bg }) => (
                <div key={label} className="rounded-2xl p-4 flex flex-col gap-2"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text3)" }}>
                      {label}
                    </span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon size={12} style={{ color }} />
                    </div>
                  </div>
                  <p className="font-syne font-extrabold text-[20px] leading-none" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── PROGRESS BAR ─────────────────────────────── */}
            {(entryTime || exitTime) && (
              <div className="rounded-2xl px-5 py-4 space-y-2"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px]" style={{ color: "var(--text3)" }}>
                    Daily progress — 8.5h target
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--text2)" }}>
                    {Math.min(100, Math.round(calc.pct))}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width:      `${Math.min(100, calc.pct)}%`,
                      background: calc.pct >= 100 ? "#22d3a0" : calc.pct >= 60 ? "#7c6ef3" : "#fbbf24",
                    }} />
                </div>
              </div>
            )}

            {/* ── NOTES ────────────────────────────────────── */}
            <Card>
              <label className="font-mono text-[11px] uppercase tracking-widest block mb-3"
                style={{ color: "var(--text3)" }}>
                Notes (optional)
              </label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="What did you work on today?"
                className="w-full rounded-xl px-4 py-3 font-mono text-[13px] resize-none focus:outline-none transition-colors"
                style={{ background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "var(--border2)")} />
            </Card>

            {/* ── SAVE BUTTON ──────────────────────────────── */}
            <div className="flex items-center justify-end gap-3">
              {everSaved && !isDirty && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
                  <span className="font-mono text-[12px]" style={{ color: "var(--text3)" }}>
                    All changes saved
                  </span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                title={!isDirty ? "No changes to save" : "Save today's work log"}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-mono font-medium text-[14px] text-white transition-all border-none"
                style={{
                  background:  isDirty ? "var(--accent)" : "var(--border2)",
                  boxShadow:   isDirty ? "0 0 24px rgba(124,110,243,0.35)" : "none",
                  cursor:      isDirty ? "pointer" : "not-allowed",
                  opacity:     isDirty ? 1 : 0.55,
                  color:       isDirty ? "#fff" : "var(--text3)",
                  transform:   "none",
                }}
                onMouseEnter={e => {
                  if (isDirty) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {saving
                  ? <><RefreshCw size={15} className="animate-spin" /> Saving...</>
                  : <><Save size={15} /> Save Today&apos;s Log</>
                }
              </button>
            </div>
          </>
        )}

      </div>
    </>
  );
}