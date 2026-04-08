"use client";
// app/dashboard/todo/page.tsx
// FIXES:
// 1. Removed all migration logic (no more auto-carry-forward of tasks)
// 2. Fixed edit bug — no optimistic update for edit; waits for server, prevents duplicate
// 3. Fixed delete bug — correct query param encoding + stable optimistic removal
// 4. Full-width layout — removed max-w-2xl constraint, uses full available space
// 5. Fully responsive for all screen sizes

import { useEffect, useState, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Pencil,
  CheckCheck,
  History,
  ListTodo,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TASKS = 20;
const MAX_CHAR  = 150;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id:          string;
  text:        string;
  completed:   boolean;
  createdAt:   string;
  completedAt: string | null;
}

interface HistoryDay {
  date:       string;
  tasks:      Task[];
  totalTasks: number;
  completed:  number;
}

// ─── Motivational Messages ────────────────────────────────────────────────────

const ALL_DONE_MESSAGES = [
  "hey {name}, today was handled properly. keep building this rhythm.",
  "solid work, {name}. consistency like this compounds fast.",
  "well done, {name}. one more day that actually counted.",
  "clean execution, {name}. no wasted effort today.",
  "you followed through today, {name}. that matters more than motivation.",
  "good work, {name}. discipline showed up today.",
  "everything done, {name}. that's a strong standard.",
  "another completed day, {name}. this is how progress looks.",
  "you did what you said you would, {name}. respect.",
  "steady progress, {name}. keep stacking days like this.",
  "today moved forward because you did, {name}.",
  "great finish, {name}. keep protecting this focus.",
  "this is how results are built, {name}. one day at a time.",
  "nothing flashy, just real progress. good work, {name}.",
  "you stayed consistent today, {name}. that's rare.",
  "this is what discipline feels like, {name}.",
  "another solid day, {name}. don't break the chain.",
  "today wasn't wasted. that's already a win, {name}.",
  "good execution, {name}. clean and focused.",
  "you showed up properly today, {name}. keep that standard.",
  "all done, {name}. this level of efficiency is slightly suspicious.",
  "everything finished, {name}. even procrastination gave up.",
  "task list cleared, {name}. didn't expect that honestly.",
  "well well, {name}. look at you being consistent.",
  "you actually finished everything, {name}. rare moment.",
  "0 tasks left, {name}. chaos avoided today.",
  "hey {name}, aaj ka kaam proper complete hua. keep going.",
  "aaj ka din waste nahi gaya, {name}. that's solid.",
  "kaam finish ho gaya, {name}. good control today.",
  "aaj ka output strong tha, {name}. continue this.",
  "you did the work today, {name}. that's what changes everything.",
  "motivation comes and goes. today you relied on discipline, {name}.",
  "this is how self-respect is built, {name}.",
  "you chose action over comfort today, {name}.",
  "progress isn't loud. today proved that, {name}.",
];

function getMotivationalToast(name: string): string {
  const msg = ALL_DONE_MESSAGES[Math.floor(Math.random() * ALL_DONE_MESSAGES.length)];
  return msg.replace("{name}", name.split(" ")[0] || name);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });
}

function isYesterday(iso: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return iso === y;
}

// ─── Motivational Toast Component ─────────────────────────────────────────────

function MotivationalToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible]   = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) {
          clearInterval(interval);
          setVisible(false);
          setTimeout(() => onDone(), 0);
          return 0;
        }
        return p - 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-4 z-[999] w-[calc(100vw-2rem)] max-w-sm"
      style={{ filter: "drop-shadow(0 8px 40px rgba(124,110,243,0.40))" }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:     "linear-gradient(135deg, rgba(30,27,50,0.97) 0%, rgba(20,30,40,0.97) 100%)",
          border:         "1px solid rgba(124,110,243,0.45)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="px-4 pt-4 pb-2 flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(124,110,243,0.35), rgba(34,211,160,0.35))",
              border:     "1px solid rgba(124,110,243,0.3)",
            }}
          >
            <Sparkles size={18} style={{ color: "#a78bfa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: "#22d3a0" }}
            >
              🎉 All Done!
            </p>
            <p className="text-[13px] font-medium leading-snug" style={{ color: "#e8e8f0" }}>
              {message}
            </p>
          </div>
          <button
            onClick={() => { setVisible(false); onDone(); }}
            className="border-none bg-transparent cursor-pointer p-1 rounded-lg"
            style={{ color: "#7a8499" }}
          >
            <X size={13} />
          </button>
        </div>
        <div className="mx-4 mb-4 mt-2 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width:      `${progress}%`,
              background: "linear-gradient(90deg, #7c6ef3, #22d3a0)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  readOnly,
}: {
  task:     Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (id: string, text: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(task.text);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Keep draft in sync if task.text changes externally (e.g. server refresh)
  useEffect(() => {
    if (!editing) setDraft(task.text);
  }, [task.text, editing]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setDraft(task.text); setEditing(false); return; }
    if (trimmed === task.text) { setEditing(false); return; } // no change
    if (trimmed.length > MAX_CHAR) { toast.error(`Max ${MAX_CHAR} characters`); return; }
    setSaving(true);
    try {
      await onEdit(task.id, trimmed);
      setEditing(false);
    } catch {
      // error handled in parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      onDelete(task.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="group flex items-start gap-3 rounded-xl px-4 py-3 transition-all duration-200"
      style={{
        background: task.completed
          ? "rgba(34,211,160,0.05)"
          : "var(--surface)",
        border: task.completed
          ? "1px solid rgba(34,211,160,0.15)"
          : "1px solid var(--border2)",
        opacity: deleting ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      {!readOnly ? (
        <button
          onClick={() => !editing && onToggle(task.id)}
          className="shrink-0 mt-0.5 border-none bg-transparent cursor-pointer p-0 transition-transform active:scale-90"
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed
            ? <CheckCircle2 size={20} style={{ color: "#22d3a0" }} />
            : <Circle size={20} style={{ color: "var(--text4)" }} />}
        </button>
      ) : (
        <span className="shrink-0 mt-0.5">
          {task.completed
            ? <CheckCircle2 size={18} style={{ color: "#22d3a0" }} />
            : <Circle size={18} style={{ color: "var(--text4)" }} />}
        </span>
      )}

      {/* Text / Edit input */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  handleSave();
                if (e.key === "Escape") { setDraft(task.text); setEditing(false); }
              }}
              maxLength={MAX_CHAR}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none transition-all min-w-0"
              style={{
                background: "var(--surface2)",
                border:     "1px solid rgba(124,110,243,0.5)",
                color:      "var(--text)",
                boxShadow:  "0 0 0 3px rgba(124,110,243,0.10)",
              }}
            />
            <span className="text-[11px] shrink-0" style={{ color: "var(--text4)" }}>
              {draft.length}/{MAX_CHAR}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer shrink-0 disabled:opacity-50"
              style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button
              onClick={() => { setDraft(task.text); setEditing(false); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer shrink-0"
              style={{ background: "var(--surface2)", color: "var(--text4)" }}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <p
            className="text-[14px] leading-relaxed break-words transition-all duration-200"
            style={{
              color:          task.completed ? "var(--text4)" : "var(--text)",
              textDecoration: task.completed ? "line-through" : "none",
              fontStyle:      task.completed ? "italic" : "normal",
            }}
          >
            {task.text}
          </p>
        )}

        {task.completedAt && task.completed && (
          <p className="text-[11px] mt-0.5" style={{ color: "#22d3a0" }}>
            ✓ Completed at {new Date(task.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {/* Actions — always visible on mobile, hover on desktop */}
      {!readOnly && !editing && (
        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
          {!task.completed && (
            <button
              onClick={() => { setDraft(task.text); setEditing(true); }}
              className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
              style={{ background: "transparent", color: "var(--text4)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.12)";
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text4)";
              }}
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all disabled:opacity-40"
            style={{ background: "transparent", color: "var(--text4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.12)";
              (e.currentTarget as HTMLElement).style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--text4)";
            }}
            title="Delete"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── History Day Card ─────────────────────────────────────────────────────────

function HistoryDayCard({ day }: { day: HistoryDay }) {
  const [expanded, setExpanded] = useState(false);
  const pct    = day.totalTasks > 0 ? Math.round((day.completed / day.totalTasks) * 100) : 0;
  const color  = pct === 100 ? "#22d3a0" : pct >= 50 ? "#f59e0b" : "#f87171";
  const isYest = isYesterday(day.date);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 border-none bg-transparent cursor-pointer text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              {fmtDate(day.date)}
            </p>
            {isYest && (
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: "rgba(124,110,243,0.12)", color: "var(--accent)", border: "1px solid rgba(124,110,243,0.2)" }}
              >
                Yesterday
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap sm:flex-nowrap">
            <div className="flex-1 max-w-[160px] h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }}
              />
            </div>
            <p className="text-[12px] font-mono shrink-0" style={{ color }}>
              {day.completed}/{day.totalTasks} done · {pct}%
            </p>
          </div>
        </div>
        <div style={{ color: "var(--text4)", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-3 flex flex-col gap-2">
            {day.tasks.length === 0 ? (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--text4)" }}>
                No tasks recorded this day.
              </p>
            ) : (
              day.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  readOnly
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onEdit={async () => {}}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Today Tab ────────────────────────────────────────────────────────────────

function TodayTab({ userName }: { userName: string }) {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inputVal, setInputVal] = useState("");
  const [adding, setAdding]     = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastShownToday, setToastShownToday] = useState(false);

  const inputRef     = useRef<HTMLInputElement>(null);
  const toastFiredRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res  = await fetch("/api/todo");
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
        setToastShownToday(data.allCompletedToastShown);
      }
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: only fetch tasks — NO migration
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Show motivational toast when all tasks are done
  useEffect(() => {
    if (tasks.length === 0 || toastShownToday || toastFiredRef.current) return;
    const allDone = tasks.every((t) => t.completed);
    if (!allDone) return;

    toastFiredRef.current = true;
    const msg = getMotivationalToast(userName || "Legend");
    setToastMsg(msg);

    fetch("/api/todo", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "toast-shown" }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.success) setToastShownToday(true); })
      .catch(() => {});
  }, [tasks, toastShownToday, userName]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const allDone        = tasks.length > 0 && completedCount === tasks.length;
  const progress       = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const progressColor  = allDone ? "#22d3a0" : progress >= 50 ? "#f59e0b" : "var(--accent)";

  // ── Add task ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const text = inputVal.trim();
    if (!text) return;
    if (text.length > MAX_CHAR)    { toast.error(`Max ${MAX_CHAR} characters`); return; }
    if (tasks.length >= MAX_TASKS) { toast.error(`Max ${MAX_TASKS} tasks per day`); return; }

    setAdding(true);
    try {
      const res  = await fetch("/api/todo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks); // use server state — source of truth
        setInputVal("");
        inputRef.current?.focus();
      } else {
        toast.error(data.message || "Failed to add task");
      }
    } catch {
      toast.error("Failed to add task");
    } finally {
      setAdding(false);
    }
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  const handleToggle = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      const res  = await fetch("/api/todo", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "toggle", taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
        setToastShownToday(data.allCompletedToastShown);
      } else {
        fetchTasks(); // revert on error
      }
    } catch {
      toast.error("Failed to update task");
      fetchTasks();
    }
  };

  // ── Delete — FIX: use correct query param format ──────────────────────────
  const handleDelete = async (taskId: string) => {
    // Optimistic removal
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const url = `/api/todo?taskId=${encodeURIComponent(taskId)}&date=${todayISO()}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to delete task");
        fetchTasks(); // revert
      }
      // On success, server returns updated tasks — sync them
      if (data.success && data.tasks) {
        setTasks(data.tasks);
      }
    } catch {
      toast.error("Failed to delete task");
      fetchTasks(); // revert
    }
  };

  // ── Edit — FIX: no optimistic update; wait for server to avoid duplicates ─
  const handleEdit = async (taskId: string, text: string): Promise<void> => {
    try {
      const res  = await fetch("/api/todo", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "edit", taskId, text }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks); // server is source of truth
      } else {
        toast.error(data.message || "Failed to update task");
        throw new Error(data.message);
      }
    } catch (e) {
      toast.error("Failed to update task");
      throw e;
    }
  };

  // ── Mark All ──────────────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    if (allDone) return;
    // Optimistic
    setTasks((prev) =>
      prev.map((t) => ({ ...t, completed: true, completedAt: t.completedAt || new Date().toISOString() }))
    );
    try {
      const res  = await fetch("/api/todo", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "mark-all" }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
        setToastShownToday(data.allCompletedToastShown);
      } else {
        fetchTasks();
      }
    } catch {
      toast.error("Failed to mark all");
      fetchTasks();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks  = tasks.filter((t) => t.completed);

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* Motivational Toast */}
      {toastMsg && (
        <MotivationalToast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}

      {/* ── Progress Card ── */}
      <div
        className="rounded-2xl px-4 sm:px-5 py-4 w-full"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-[13px] font-semibold" style={{ color: "var(--text2)" }}>
            {allDone
              ? "🎉 All done for today!"
              : tasks.length === 0
              ? "No tasks yet — add your first task"
              : "Today's progress"}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg"
              style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border2)" }}
            >
              {tasks.length} total
            </span>
            <span
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(34,211,160,0.08)", color: "#22d3a0", border: "1px solid rgba(34,211,160,0.15)" }}
            >
              {completedCount} done
            </span>
            <span
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg"
              style={{
                background: tasks.length - completedCount > 0 ? "rgba(245,158,11,0.08)" : "rgba(34,211,160,0.08)",
                color:      tasks.length - completedCount > 0 ? "#f59e0b" : "#22d3a0",
                border:     tasks.length - completedCount > 0 ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(34,211,160,0.15)",
              }}
            >
              {tasks.length - completedCount} left
            </span>
            <p className="font-mono font-bold text-[13px]" style={{ color: progressColor }}>
              {progress}%
            </p>
          </div>
        </div>

        <div className="rounded-full overflow-hidden" style={{ height: 7, background: "var(--surface2)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${progress}%`,
              background: `linear-gradient(90deg, ${progressColor}, ${progressColor}99)`,
              minWidth:   progress > 0 ? 12 : 0,
            }}
          />
        </div>
      </div>

      {/* ── Input Card ── */}
      <div
        className="rounded-2xl p-4 sm:p-5 w-full"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Plus size={13} style={{ color: "var(--accent)" }} />
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
            Add Task
          </p>
          <span
            className="ml-auto text-[11px] font-mono"
            style={{ color: tasks.length >= MAX_TASKS ? "#f87171" : "var(--text4)" }}
          >
            {tasks.length}/{MAX_TASKS}
          </span>
        </div>

        <div className="flex gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value.slice(0, MAX_CHAR))}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="What needs to be done today?"
              disabled={tasks.length >= MAX_TASKS || adding}
              className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all disabled:opacity-50"
              style={{
                background:   "var(--surface2)",
                border:       "1px solid var(--border2)",
                color:        "var(--text)",
                paddingRight: "4rem",
                boxSizing:    "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,110,243,0.5)";
                e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(124,110,243,0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
                e.currentTarget.style.boxShadow   = "none";
              }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono pointer-events-none"
              style={{ color: inputVal.length > MAX_CHAR - 20 ? "#f59e0b" : "var(--text4)" }}
            >
              {inputVal.length}/{MAX_CHAR}
            </span>
          </div>

          <button
            onClick={handleAdd}
            disabled={adding || !inputVal.trim() || tasks.length >= MAX_TASKS}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{
              background: "var(--accent)",
              color:      "#fff",
              boxShadow:  "0 0 20px rgba(124,110,243,0.25)",
              minWidth:   "80px",
              justifyContent: "center",
            }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            <span>Add</span>
          </button>
        </div>

        {tasks.length >= MAX_TASKS && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle size={13} style={{ color: "#f87171" }} />
            <p className="text-[12px]" style={{ color: "#f87171" }}>
              Daily limit of {MAX_TASKS} tasks reached.
            </p>
          </div>
        )}
      </div>

      {/* ── Task List Card ── */}
      <div
        className="rounded-2xl overflow-hidden w-full"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        {/* Header */}
        <div
          className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap"
          style={{ borderBottom: "1px solid var(--border2)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ListTodo size={15} style={{ color: "var(--accent)" }} />
            <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>
              Today&apos;s Tasks
            </p>
            <span
              className="text-[11px] font-mono px-2 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(124,110,243,0.10)", color: "var(--accent)" }}
            >
              {fmtDate(todayISO()).split(",")[0]}
            </span>
          </div>

          {tasks.length > 0 && !allDone && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all shrink-0"
              style={{
                background: "rgba(34,211,160,0.10)",
                color:      "#22d3a0",
                border:     "1px solid rgba(34,211,160,0.22)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,160,0.20)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(34,211,160,0.10)"; }}
            >
              <CheckCheck size={13} />
              Mark All Done
            </button>
          )}
        </div>

        {/* Tasks */}
        <div className="p-3 sm:p-4 flex flex-col gap-2.5">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--surface2)" }}
              >
                <ListTodo size={24} style={{ color: "var(--text4)" }} />
              </div>
              <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>No tasks yet</p>
              <p className="text-[12px] text-center max-w-xs" style={{ color: "var(--text4)" }}>
                Add up to {MAX_TASKS} tasks to plan your day.
              </p>
            </div>
          ) : (
            <>
              {/* Incomplete tasks */}
              {incompleteTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}

              {/* Divider between incomplete and complete */}
              {incompleteTasks.length > 0 && completedTasks.length > 0 && (
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
                    Completed
                  </span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>
              )}

              {/* Completed tasks */}
              {completedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/todo/history?limit=30");
        const data = await res.json();
        if (data.success) setHistory(data.history);
      } catch {
        toast.error("Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface2)" }}>
          <CalendarDays size={28} style={{ color: "var(--text4)" }} />
        </div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--text3)" }}>No history yet</p>
        <p className="text-[13px] text-center max-w-sm" style={{ color: "var(--text4)" }}>
          Your completed day&apos;s task history will appear here.
        </p>
      </div>
    );
  }

  const totalDays      = history.length;
  const perfectDays    = history.filter((d) => d.totalTasks > 0 && d.completed === d.totalTasks).length;
  const totalCompleted = history.reduce((acc, d) => acc + d.completed, 0);
  const totalTasksAll  = history.reduce((acc, d) => acc + d.totalTasks, 0);
  const overallPct     = totalTasksAll > 0 ? Math.round((totalCompleted / totalTasksAll) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Days Tracked", value: totalDays,        color: "var(--accent)" },
          { label: "Perfect Days", value: perfectDays,      color: "#22d3a0" },
          { label: "Tasks Done",   value: totalCompleted,   color: "#f59e0b" },
          { label: "Completion %", value: `${overallPct}%`, color: overallPct >= 70 ? "#22d3a0" : overallPct >= 40 ? "#f59e0b" : "#f87171" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <p className="font-mono font-bold text-[20px]" style={{ color }}>{value}</p>
            <p className="text-[11px] uppercase tracking-wider mt-1" style={{ color: "var(--text4)" }}>{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full">
        {history.map((day) => (
          <HistoryDayCard key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodoPage() {
  const [tab, setTab]           = useState<"today" | "history">("today");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setUserName(d.user.fullName || d.user.email || ""); })
      .catch(() => {});
  }, []);

  const TABS = [
    { key: "today",   label: "Today's Tasks", icon: ListTodo },
    { key: "history", label: "History",        icon: History  },
  ] as const;

  return (
    // Full width — no max-w constraint, uses all available dashboard space
    <div className="flex flex-col gap-4 w-full px-0">

      {/* ── Header: title left, tabs right ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(124,110,243,0.20), rgba(34,211,160,0.15))",
              border:     "1px solid rgba(124,110,243,0.25)",
            }}
          >
            <ListTodo size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-tight" style={{ color: "var(--text)" }}>
              To-Do List
            </h1>
            <p className="text-[11px]" style={{ color: "var(--text4)" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all duration-150 whitespace-nowrap"
              style={{
                background: tab === key ? "var(--accent)" : "transparent",
                color:      tab === key ? "#fff" : "var(--text3)",
                boxShadow:  tab === key ? "0 2px 12px rgba(124,110,243,0.25)" : "none",
              }}
            >
              <Icon size={13} />
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content — full width ── */}
      <div className="w-full">
        {tab === "today"   && <TodayTab userName={userName} />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}