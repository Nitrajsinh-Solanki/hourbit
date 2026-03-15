// app/admin/levels/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  BarChart3,
  AlertTriangle,
  Loader2,
  RefreshCw,
  GripVertical,
  CheckCircle,
  Archive,
  Tag,
  Layers,
  FolderOpen,
  Zap,
  Clock,
  Target,
  HelpCircle,
  Shield,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Category {
  _id:          string;
  name:         string;
  status:       string;
  displayOrder: number;
}

interface Subcategory {
  _id:          string;
  categoryId:   string;
  name:         string;
  status:       string;
  displayOrder: number;
}

interface Level {
  _id:                 string;
  subcategoryId:       string;
  levelNumber:         number;
  name:                string;
  difficulty:          "easy" | "medium" | "hard" | "expert";
  xpReward:            number;
  penaltyXpMultiplier: number;
  maxAttempts:         number;
  questionCount:       number;
  timeLimitMinutes:    number;
  displayOrder:        number;
  status:              "active" | "archived" | "deleted";
  createdAt:           string;
}

type StatusFilter = "all" | "active" | "archived" | "deleted";
type Difficulty   = "easy" | "medium" | "hard" | "expert";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        "100%",
  background:   "var(--bg)",
  border:       "1px solid var(--border2)",
  borderRadius: "10px",
  padding:      "9px 13px",
  fontSize:     "13.5px",
  color:        "var(--text)",
  outline:      "none",
};

const labelStyle: React.CSSProperties = {
  display:       "block",
  fontSize:      "11px",
  fontWeight:    600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color:         "var(--text3)",
  marginBottom:  "6px",
};

// ─────────────────────────────────────────────────────────────────────────────
// DIFFICULTY BADGE
// ─────────────────────────────────────────────────────────────────────────────

const DIFF_MAP: Record<Difficulty, { color: string; bg: string; label: string }> = {
  easy:   { color: "var(--green)",  bg: "rgba(34,211,160,0.10)",  label: "Easy"   },
  medium: { color: "var(--amber)",  bg: "rgba(245,158,11,0.10)",  label: "Medium" },
  hard:   { color: "#f472b6",       bg: "rgba(244,114,182,0.10)", label: "Hard"   },
  expert: { color: "var(--danger)", bg: "rgba(248,113,113,0.10)", label: "Expert" },
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const d = DIFF_MAP[difficulty] ?? DIFF_MAP.easy;
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          5,
        padding:      "3px 10px",
        borderRadius: "999px",
        fontSize:     "11.5px",
        fontWeight:   600,
        color:        d.color,
        background:   d.bg,
        border:       `1px solid ${d.color}30`,
        whiteSpace:   "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
      {d.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Level["status"] }) {
  const map = {
    active:   { color: "var(--green)",  bg: "rgba(34,211,160,0.10)",  label: "Active"   },
    archived: { color: "var(--amber)",  bg: "rgba(245,158,11,0.10)",  label: "Archived" },
    deleted:  { color: "var(--danger)", bg: "rgba(248,113,113,0.10)", label: "Deleted"  },
  };
  const s = map[status] ?? map.active;
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          5,
        padding:      "3px 10px",
        borderRadius: "999px",
        fontSize:     "11.5px",
        fontWeight:   600,
        color:        s.color,
        background:   s.bg,
        border:       `1px solid ${s.color}30`,
        whiteSpace:   "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// XP BADGE
// ─────────────────────────────────────────────────────────────────────────────

function XpBadge({ xp }: { xp: number }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        padding:      "3px 9px",
        borderRadius: "999px",
        fontSize:     "12px",
        fontWeight:   700,
        color:        "#a78bfa",
        background:   "rgba(167,139,250,0.12)",
        border:       "1px solid rgba(167,139,250,0.25)",
        whiteSpace:   "nowrap",
      }}
    >
      <Zap size={11} />
      {xp} XP
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({
  level,
  onConfirm,
  onCancel,
  loading,
}: {
  level:     Level;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(248,113,113,0.13)" }}
          >
            <AlertTriangle size={22} style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>
              Delete Level
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              You are about to delete{" "}
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                Level {level.levelNumber}
                {level.name ? ` — ${level.name}` : ""}
              </span>
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 text-[13px] leading-relaxed"
          style={{
            background: "rgba(248,113,113,0.07)",
            border:     "1px solid rgba(248,113,113,0.22)",
            color:      "var(--danger)",
          }}
        >
          ⚠️ <strong>This action is permanent and cannot be undone.</strong>{" "}
          Deleting this level will permanently remove all questions assigned to it from the system.
        </div>

        <div className="flex gap-3 justify-end flex-wrap">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
            style={{ background: "var(--danger)", color: "#fff", opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Deleting…" : "Yes, Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({
  level,
  onSave,
  onClose,
  loading,
}: {
  level:   Level;
  onSave:  (id: string, data: Partial<Level>) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [levelNumber,        setLevelNumber]        = useState(String(level.levelNumber));
  const [name,               setName]               = useState(level.name || "");
  const [difficulty,         setDifficulty]         = useState<Difficulty>(level.difficulty);
  const [xpReward,           setXpReward]           = useState(String(level.xpReward));
  const [penaltyMult,        setPenaltyMult]        = useState(String(level.penaltyXpMultiplier));
  const [maxAttempts,        setMaxAttempts]        = useState(String(level.maxAttempts));
  const [questionCount,      setQuestionCount]      = useState(String(level.questionCount));
  const [timeLimitMinutes,   setTimeLimitMinutes]   = useState(String(level.timeLimitMinutes));
  const [displayOrder,       setDisplayOrder]       = useState(String(level.displayOrder));
  const [status,             setStatus]             = useState<Level["status"]>(level.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelNumber || Number(levelNumber) < 1) { toast.error("Level number must be ≥ 1");        return; }
    if (Number(xpReward) < 0)                    { toast.error("XP Reward cannot be negative");    return; }
    if (Number(maxAttempts) < 1)                 { toast.error("Max Attempts must be at least 1"); return; }
    if (Number(questionCount) < 1)               { toast.error("Question count must be at least 1"); return; }
    onSave(level._id, {
      levelNumber:         Number(levelNumber),
      name:                name.trim(),
      difficulty,
      xpReward:            Number(xpReward),
      penaltyXpMultiplier: Math.min(1, Math.max(0, Number(penaltyMult))),
      maxAttempts:         Number(maxAttempts),
      questionCount:       Number(questionCount),
      timeLimitMinutes:    Number(timeLimitMinutes),
      displayOrder:        Number(displayOrder) || 0,
      status,
    });
  };

  const fieldRow = "grid grid-cols-2 gap-4";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl flex flex-col"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border2)",
          maxHeight:  "92vh",
          overflowY:  "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", zIndex: 1 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(232,67,147,0.13)" }}
            >
              <Pencil size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
                Edit Level {level.levelNumber}
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                Changes apply immediately after saving
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

          {/* ── Identity ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
              Identity
            </p>
            <div className={fieldRow}>
              <div>
                <label style={labelStyle}>
                  Level Number <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="number"
                  style={inputStyle}
                  value={levelNumber}
                  onChange={e => setLevelNumber(e.target.value)}
                  min={1}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Custom Name (optional)</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Warm Up"
                  maxLength={120}
                />
              </div>
            </div>
          </div>

          {/* ── Difficulty & XP ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
              Difficulty & XP
            </p>
            <div className={fieldRow}>
              <div>
                <label style={labelStyle}>Difficulty</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as Difficulty)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>XP Reward</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={xpReward}
                  onChange={e => setXpReward(e.target.value)}
                  min={0}
                  placeholder="100"
                />
              </div>
            </div>
            <div className="mt-3">
              <label style={labelStyle}>XP Penalty Multiplier (0 – 1)</label>
              <input
                type="number"
                style={inputStyle}
                value={penaltyMult}
                onChange={e => setPenaltyMult(e.target.value)}
                min={0}
                max={1}
                step={0.05}
                placeholder="0.30"
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
                If a user unlocks this level via max-attempts exhaustion on the previous level,
                they earn <strong>{Math.round(Number(penaltyMult || 0.3) * 100)}%</strong> of XP
                = <strong>{Math.round(Number(xpReward || 100) * Number(penaltyMult || 0.3))} XP</strong>
              </p>
            </div>
          </div>

          {/* ── Attempt & Question rules ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
              Rules
            </p>
            <div className={fieldRow}>
              <div>
                <label style={labelStyle}>Max Attempts</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(e.target.value)}
                  min={1}
                  placeholder="3"
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
                  After this many failed attempts the next level unlocks.
                </p>
              </div>
              <div>
                <label style={labelStyle}>Question Count</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={questionCount}
                  onChange={e => setQuestionCount(e.target.value)}
                  min={1}
                  placeholder="10"
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
                  Number of questions to assign in Question Management.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <label style={labelStyle}>Time Limit (minutes)</label>
              <input
                type="number"
                style={inputStyle}
                value={timeLimitMinutes}
                onChange={e => setTimeLimitMinutes(e.target.value)}
                min={0}
                placeholder="0 = unlimited"
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
                Set 0 for no time limit.
              </p>
            </div>
          </div>

          {/* ── Display & Status ── */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
              Display & Status
            </p>
            <div className={fieldRow}>
              <div>
                <label style={labelStyle}>Display Order</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={displayOrder}
                  onChange={e => setDisplayOrder(e.target.value)}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={status}
                  onChange={e => setStatus(e.target.value as Level["status"])}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-1 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
              style={{ background: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE LEVEL CARD
// ─────────────────────────────────────────────────────────────────────────────

function LevelCard({
  level,
  onEdit,
  onDelete,
  onQuickStatusToggle,
  onOrderBlur,
  onOrderChange,
}: {
  level:               Level;
  onEdit:              (l: Level) => void;
  onDelete:            (l: Level) => void;
  onQuickStatusToggle: (l: Level) => void;
  onOrderBlur:         (id: string, v: number) => void;
  onOrderChange:       (id: string, v: number) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[15px] font-bold"
              style={{ color: "var(--text)" }}
            >
              Level {level.levelNumber}
            </span>
            {level.name && (
              <span className="text-[12.5px]" style={{ color: "var(--text3)" }}>
                — {level.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <DifficultyBadge difficulty={level.difficulty} />
            <StatusBadge status={level.status} />
          </div>
        </div>
        <XpBadge xp={level.xpReward} />
      </div>

      {/* Stats grid */}
      <div
        className="grid grid-cols-3 gap-2 rounded-xl p-3"
        style={{ background: "var(--surface2)" }}
      >
        <div className="flex flex-col items-center gap-1">
          <Target size={13} style={{ color: "var(--text4)" }} />
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>
            {level.maxAttempts}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text4)" }}>Attempts</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <HelpCircle size={13} style={{ color: "var(--text4)" }} />
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>
            {level.questionCount}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text4)" }}>Questions</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Clock size={13} style={{ color: "var(--text4)" }} />
          <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>
            {level.timeLimitMinutes > 0 ? `${level.timeLimitMinutes}m` : "∞"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text4)" }}>Time</span>
        </div>
      </div>

      {/* Order + date row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
            Order
          </span>
          <input
            type="number"
            value={level.displayOrder}
            onChange={e => onOrderChange(level._id, Number(e.target.value))}
            onBlur={e  => onOrderBlur(level._id,   Number(e.target.value))}
            className="w-12 text-center rounded-lg border-none text-[13px] font-mono py-1"
            style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
          />
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--text4)" }}>
          {new Date(level.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 pt-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={() => onQuickStatusToggle(level)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{
            background: level.status === "active" ? "rgba(245,158,11,0.10)" : "rgba(34,211,160,0.10)",
            color:      level.status === "active" ? "var(--amber)"          : "var(--green)",
          }}
        >
          {level.status === "active"
            ? <><Archive size={13} /> Archive</>
            : <><CheckCircle size={13} /> Activate</>}
        </button>
        <button
          onClick={() => onEdit(level)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => onDelete(level)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LevelsPage() {

  // ── Hierarchy selectors ────────────────────────────────────────────────────
  const [categories,      setCategories]      = useState<Category[]>([]);
  const [subcategories,   setSubcategories]   = useState<Subcategory[]>([]);
  const [selectedCatId,   setSelectedCatId]   = useState("");
  const [selectedSubId,   setSelectedSubId]   = useState("");
  const [catsLoading,     setCatsLoading]     = useState(true);
  const [subsLoading,     setSubsLoading]     = useState(false);

  // ── Levels data ────────────────────────────────────────────────────────────
  const [levels,      setLevels]     = useState<Level[]>([]);
  const [total,       setTotal]      = useState(0);
  const [page,        setPage]       = useState(1);
  const [totalPages,  setTotalPages] = useState(1);
  const LIMIT = 50;

  // ── UI state ───────────────────────────────────────────────────────────────
  const [fetchLoading,  setFetchLoading]  = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");

  // ── Add form ───────────────────────────────────────────────────────────────
  const [addOpen,             setAddOpen]             = useState(false);
  const [addLoading,          setAddLoading]          = useState(false);
  const [addLevelNumber,      setAddLevelNumber]      = useState("");
  const [addName,             setAddName]             = useState("");
  const [addDifficulty,       setAddDifficulty]       = useState<Difficulty>("easy");
  const [addXpReward,         setAddXpReward]         = useState("100");
  const [addMaxAttempts,      setAddMaxAttempts]      = useState("3");
  const [addQuestionCount,    setAddQuestionCount]    = useState("10");
  const [addTimeLimit,        setAddTimeLimit]        = useState("0");
  const [addDisplayOrder,     setAddDisplayOrder]     = useState("");
  const [addStatus,           setAddStatus]           = useState<"active" | "archived">("active");

  // ── Edit / Delete state ────────────────────────────────────────────────────
  const [editTarget,    setEditTarget]    = useState<Level | null>(null);
  const [editLoading,   setEditLoading]   = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<Level | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"displayOrder" | "levelNumber" | "xpReward" | "createdAt">("displayOrder");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");

  // ── Drag ───────────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);

  // ── Debounced search ───────────────────────────────────────────────────────
  const searchTimer                           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Fetch all active categories ────────────────────────────────────────────
  useEffect(() => {
    const fetchCats = async () => {
      setCatsLoading(true);
      try {
        const res  = await fetch("/api/admin/categories?status=active&limit=200");
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories);
          if (data.categories.length > 0) {
            setSelectedCatId(data.categories[0]._id);
          }
        }
      } catch {
        toast.error("Failed to load categories");
      } finally {
        setCatsLoading(false);
      }
    };
    fetchCats();
  }, []);

  // ── Fetch subcategories when category changes ──────────────────────────────
  useEffect(() => {
    if (!selectedCatId) { setSubcategories([]); setSelectedSubId(""); return; }
    setSubsLoading(true);
    setSelectedSubId("");
    setLevels([]);
    fetch(`/api/admin/subcategories?categoryId=${selectedCatId}&status=active&limit=200`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSubcategories(data.subcategories);
          if (data.subcategories.length > 0) {
            setSelectedSubId(data.subcategories[0]._id);
          }
        }
      })
      .catch(() => toast.error("Failed to load subcategories"))
      .finally(() => setSubsLoading(false));
  }, [selectedCatId]);

  // ── Fetch levels ───────────────────────────────────────────────────────────
  const fetchLevels = useCallback(async (pg = page) => {
    if (!selectedSubId) { setLevels([]); setTotal(0); return; }
    setFetchLoading(true);
    try {
      const p = new URLSearchParams({
        subcategoryId: selectedSubId,
        status:        statusFilter,
        search:        debouncedSearch,
        page:          String(pg),
        limit:         String(LIMIT),
      });
      const res  = await fetch(`/api/admin/levels?${p}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "Failed to load"); return; }
      setLevels(data.levels);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Network error");
    } finally {
      setFetchLoading(false);
    }
  }, [selectedSubId, statusFilter, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [selectedSubId, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchLevels(page);
  }, [selectedSubId, statusFilter, debouncedSearch, page]); // eslint-disable-line

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId)               { toast.error("Select a subcategory first");     return; }
    if (!addLevelNumber || Number(addLevelNumber) < 1) { toast.error("Level number must be ≥ 1"); return; }
    if (Number(addXpReward)     < 0)  { toast.error("XP Reward cannot be negative");   return; }
    if (Number(addMaxAttempts)  < 1)  { toast.error("Max Attempts must be at least 1"); return; }
    if (Number(addQuestionCount)< 1)  { toast.error("Question count must be at least 1"); return; }

    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/levels", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          subcategoryId:    selectedSubId,
          levelNumber:      Number(addLevelNumber),
          name:             addName.trim(),
          difficulty:       addDifficulty,
          xpReward:         Number(addXpReward),
          maxAttempts:      Number(addMaxAttempts),
          questionCount:    Number(addQuestionCount),
          timeLimitMinutes: Number(addTimeLimit),
          displayOrder:     Number(addDisplayOrder) || 0,
          status:           addStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(`Level ${data.level.levelNumber} created!`);
      // Reset form
      setAddLevelNumber(""); setAddName(""); setAddDifficulty("easy");
      setAddXpReward("100"); setAddMaxAttempts("3"); setAddQuestionCount("10");
      setAddTimeLimit("0"); setAddDisplayOrder(""); setAddStatus("active");
      setAddOpen(false);
      fetchLevels(1); setPage(1);
    } catch {
      toast.error("Failed to create level");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Save (from edit modal) ─────────────────────────────────────────────────
  const saveLevel = async (id: string, data: Partial<Level>) => {
    setEditLoading(true);
    try {
      const res  = await fetch(`/api/admin/levels/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("Level updated!");
      setEditTarget(null);
      setLevels(prev => prev.map(l => l._id === id ? { ...l, ...data } : l));
    } catch {
      toast.error("Failed to update level");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Quick status toggle ────────────────────────────────────────────────────
  const handleQuickStatusToggle = (level: Level) => {
    const newStatus = level.status === "active" ? "archived" : "active";
    saveLevel(level._id, { status: newStatus });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res  = await fetch(`/api/admin/levels/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success(`Level ${deleteTarget.levelNumber} and all questions deleted.`);
      setDeleteTarget(null);
      fetchLevels(page);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Inline order ───────────────────────────────────────────────────────────
  const handleOrderBlur = async (id: string, newOrder: number) => {
    try {
      await fetch("/api/admin/levels", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates: [{ id, displayOrder: newOrder }] }),
      });
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleOrderChange = (id: string, v: number) => {
    setLevels(prev => prev.map(l => l._id === id ? { ...l, displayOrder: v } : l));
  };

  // ── Drag reorder ───────────────────────────────────────────────────────────
  const onDragStart = (idx: number) => { dragIdx.current = idx; };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const reordered = [...levels];
    const [moved]   = reordered.splice(dragIdx.current, 1);
    reordered.splice(idx, 0, moved);
    dragIdx.current = idx;
    setLevels(reordered.map((l, i) => ({ ...l, displayOrder: i })));
  };

  const onDragEnd = async () => {
    dragIdx.current = null;
    try {
      await fetch("/api/admin/levels", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          updates: levels.map(l => ({ id: l._id, displayOrder: l.displayOrder })),
        }),
      });
      toast.success("Order saved");
    } catch {
      toast.error("Failed to save order");
    }
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = [...levels].sort((a, b) => {
    const va = a[sortField] as number;
    const vb = b[sortField] as number;
    if (va < vb) return sortDir === "asc" ? -1 :  1;
    if (va > vb) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField !== field
      ? <ChevronUp   size={12} style={{ opacity: 0.3 }} />
      : sortDir === "asc"
        ? <ChevronUp   size={12} style={{ color: "var(--accent)" }} />
        : <ChevronDown size={12} style={{ color: "var(--accent)" }} />;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",      label: "All"      },
    { key: "active",   label: "Active"   },
    { key: "archived", label: "Archived" },
    { key: "deleted",  label: "Deleted"  },
  ];

  const selectedCat = categories.find(c  => c._id === selectedCatId)  ?? null;
  const selectedSub = subcategories.find(s => s._id === selectedSubId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Modals ── */}
      {editTarget && (
        <EditModal
          level={editTarget}
          onSave={saveLevel}
          onClose={() => setEditTarget(null)}
          loading={editLoading}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          level={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="flex flex-col gap-5">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(232,67,147,0.13)" }}
              >
                <BarChart3 size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-bold" style={{ color: "var(--text)" }}>
                Levels Management
              </h1>
            </div>
            <p className="text-[13px] ml-10" style={{ color: "var(--text3)" }}>
              Category → Subcategory → <strong style={{ color: "var(--accent)" }}>Level</strong> → Question
            </p>
          </div>

          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <button
              onClick={() => fetchLevels(page)}
              disabled={fetchLoading || !selectedSubId}
              className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer shrink-0"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
              title="Refresh"
            >
              <RefreshCw size={15} className={fetchLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setAddOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-semibold border-none cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {addOpen ? <X size={15} /> : <Plus size={15} />}
              <span>{addOpen ? "Cancel" : "Add Level"}</span>
            </button>
          </div>
        </div>

        {/* ── Hierarchy Selector Panel ── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: "var(--accent)" }} />
            <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              Select Context
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label style={labelStyle}>
                <Tag size={11} className="inline mr-1" />
                Category
              </label>
              {catsLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text3)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[13px]">Loading…</span>
                </div>
              ) : categories.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--danger)" }}>
                  No active categories. Create one first.
                </p>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={selectedCatId}
                  onChange={e => {
                    setSelectedCatId(e.target.value);
                    setSearch(""); setStatusFilter("all"); setPage(1);
                  }}
                >
                  <option value="">— Select Category —</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Subcategory */}
            <div>
              <label style={labelStyle}>
                <Layers size={11} className="inline mr-1" />
                Subcategory
              </label>
              {subsLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text3)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[13px]">Loading…</span>
                </div>
              ) : !selectedCatId ? (
                <div
                  className="rounded-xl px-3 py-2.5 text-[13px]"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text4)" }}
                >
                  Select a category first
                </div>
              ) : subcategories.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--danger)" }}>
                  No active subcategories in this category.
                </p>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={selectedSubId}
                  onChange={e => {
                    setSelectedSubId(e.target.value);
                    setSearch(""); setStatusFilter("all"); setPage(1);
                  }}
                >
                  <option value="">— Select Subcategory —</option>
                  {subcategories.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Breadcrumb chips */}
          {(selectedCat || selectedSub) && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCat && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{
                    background: "rgba(232,67,147,0.10)",
                    border:     "1px solid rgba(232,67,147,0.25)",
                    color:      "var(--accent)",
                  }}
                >
                  <Tag size={11} /> {selectedCat.name}
                </span>
              )}
              {selectedCat && selectedSub && (
                <ChevronUp size={13} className="rotate-90" style={{ color: "var(--text4)" }} />
              )}
              {selectedSub && (
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{
                    background: "rgba(167,139,250,0.10)",
                    border:     "1px solid rgba(167,139,250,0.25)",
                    color:      "#a78bfa",
                  }}
                >
                  <Layers size={11} /> {selectedSub.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Add Level Form ── */}
        {addOpen && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h2 className="text-[14px] font-bold mb-5 flex items-center gap-2" style={{ color: "var(--text)" }}>
              <Plus size={15} style={{ color: "var(--accent)" }} />
              New Level
              {selectedSub && (
                <span className="text-[12px] font-normal ml-1" style={{ color: "var(--text3)" }}>
                  in {selectedSub.name}
                </span>
              )}
            </h2>

            {!selectedSubId ? (
              <p className="text-[13px]" style={{ color: "var(--danger)" }}>
                ⚠️ Please select a category and subcategory above before adding a level.
              </p>
            ) : (
              <form onSubmit={handleAdd} className="flex flex-col gap-4">

                {/* Row 1: Level Number + Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>
                      Level Number <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addLevelNumber}
                      onChange={e => setAddLevelNumber(e.target.value)}
                      placeholder="1"
                      min={1}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Custom Name (optional)</label>
                    <input
                      style={inputStyle}
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder="e.g. Warm Up"
                      maxLength={120}
                    />
                  </div>
                </div>

                {/* Row 2: Difficulty + XP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>Difficulty</label>
                    <select
                      style={{ ...inputStyle, cursor: "pointer" }}
                      value={addDifficulty}
                      onChange={e => setAddDifficulty(e.target.value as Difficulty)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>XP Reward</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addXpReward}
                      onChange={e => setAddXpReward(e.target.value)}
                      min={0}
                      placeholder="100"
                    />
                  </div>
                </div>

                {/* Row 3: Max Attempts + Question Count + Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label style={labelStyle}>Max Attempts</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addMaxAttempts}
                      onChange={e => setAddMaxAttempts(e.target.value)}
                      min={1}
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Question Count</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addQuestionCount}
                      onChange={e => setAddQuestionCount(e.target.value)}
                      min={1}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time Limit (min)</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addTimeLimit}
                      onChange={e => setAddTimeLimit(e.target.value)}
                      min={0}
                      placeholder="0 = ∞"
                    />
                  </div>
                </div>

                {/* Row 4: Order + Status + Submit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label style={labelStyle}>Display Order</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={addDisplayOrder}
                      onChange={e => setAddDisplayOrder(e.target.value)}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      style={{ ...inputStyle, cursor: "pointer" }}
                      value={addStatus}
                      onChange={e => setAddStatus(e.target.value as "active" | "archived")}
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="w-full py-[9px] rounded-xl text-[13.5px] font-semibold border-none cursor-pointer flex items-center justify-center gap-2"
                      style={{ background: "var(--accent)", color: "#fff", opacity: addLoading ? 0.7 : 1 }}
                    >
                      {addLoading && <Loader2 size={14} className="animate-spin" />}
                      {addLoading ? "Creating…" : "Create Level"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── No Subcategory Selected ── */}
        {!selectedSubId && !fetchLoading && (
          <div
            className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface2)" }}
            >
              <BarChart3 size={26} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              Select a category and subcategory above to manage levels
            </p>
          </div>
        )}

        {/* ── Search + Filter ── */}
        {selectedSubId && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text4)" }}
                />
                <input
                  style={{ ...inputStyle, paddingLeft: "36px", paddingRight: search ? "36px" : "13px" }}
                  placeholder="Search by level number or difficulty…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 border-none cursor-pointer bg-transparent p-0"
                    style={{ color: "var(--text4)" }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div
                className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
                style={{ background: "var(--surface)", border: "1px solid var(--border2)", flexShrink: 0 }}
              >
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border-none cursor-pointer whitespace-nowrap"
                    style={{
                      background: statusFilter === tab.key ? "var(--accent)" : "transparent",
                      color:      statusFilter === tab.key ? "#fff"          : "var(--text3)",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-4 flex-wrap"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                <strong style={{ color: "var(--text)" }}>{levels.length}</strong> of{" "}
                <strong style={{ color: "var(--text)" }}>{total}</strong> shown
              </span>
              <span className="hidden sm:inline text-[12px]" style={{ color: "var(--text3)" }}>
                Drag <GripVertical size={12} className="inline" /> to reorder
              </span>
              {totalPages > 1 && (
                <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                  Page <strong style={{ color: "var(--text)" }}>{page}</strong> / {totalPages}
                </span>
              )}
            </div>
          </>
        )}

        {/* ── Loading ── */}
        {fetchLoading && (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--text3)" }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading levels…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!fetchLoading && selectedSubId && sorted.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface2)" }}
            >
              <BarChart3 size={24} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              {search
                ? "No levels match your search"
                : `No levels in "${selectedSub?.name ?? ""}"`}
            </p>
            {!search && (
              <button
                onClick={() => setAddOpen(true)}
                className="text-[13px] font-medium border-none cursor-pointer bg-transparent"
                style={{ color: "var(--accent)" }}
              >
                + Create the first level
              </button>
            )}
          </div>
        )}

        {/* ── MOBILE CARDS ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map(level => (
              <LevelCard
                key={level._id}
                level={level}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                onQuickStatusToggle={handleQuickStatusToggle}
                onOrderBlur={handleOrderBlur}
                onOrderChange={handleOrderChange}
              />
            ))}
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden hidden md:block"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            {/* Table Header */}
            <div
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: "36px 48px 64px 100px 90px 78px 80px 78px 90px 104px 112px",
                background:          "var(--surface2)",
                borderBottom:        "1px solid var(--border2)",
              }}
            >
              {([
                { label: "",           field: null           },
                { label: "#",          field: "displayOrder" },
                { label: "Lvl",        field: "levelNumber"  },
                { label: "Difficulty", field: null           },
                { label: "XP",         field: "xpReward"     },
                { label: "Attempts",   field: null           },
                { label: "Questions",  field: null           },
                { label: "Time",       field: null           },
                { label: "Status",     field: null           },
                { label: "Created",    field: "createdAt"    },
                { label: "Actions",    field: null           },
              ] as { label: string; field: string | null }[]).map(({ label, field }, i) => (
                <div key={i}>
                  {field ? (
                    <button
                      onClick={() => toggleSort(field as typeof sortField)}
                      className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                      style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
                    >
                      {label} <SortIcon field={field as typeof sortField} />
                    </button>
                  ) : (
                    <span style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((level, idx) => (
              <div
                key={level._id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                className="grid items-center px-4 py-3 transition-colors"
                style={{
                  gridTemplateColumns: "36px 48px 64px 100px 90px 78px 80px 78px 90px 104px 112px",
                  borderBottom:        "1px solid var(--border)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent";     }}
              >
                {/* Drag handle */}
                <div className="flex items-center justify-center cursor-grab" style={{ color: "var(--text4)" }}>
                  <GripVertical size={16} />
                </div>

                {/* Display Order */}
                <div>
                  <input
                    type="number"
                    value={level.displayOrder}
                    onChange={e => handleOrderChange(level._id, Number(e.target.value))}
                    onBlur={e  => handleOrderBlur(level._id,   Number(e.target.value))}
                    className="w-10 text-center rounded-lg border-none text-[12px] font-mono py-1"
                    style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
                  />
                </div>

                {/* Level Number */}
                <div>
                  <span
                    className="text-[13px] font-bold font-mono"
                    style={{ color: "var(--text)" }}
                  >
                    L{level.levelNumber}
                  </span>
                </div>

                {/* Difficulty */}
                <div>
                  <DifficultyBadge difficulty={level.difficulty} />
                </div>

                {/* XP */}
                <div>
                  <XpBadge xp={level.xpReward} />
                </div>

                {/* Max Attempts */}
                <div>
                  <span
                    className="flex items-center gap-1 text-[12.5px]"
                    style={{ color: "var(--text2)" }}
                  >
                    <Target size={12} style={{ color: "var(--text4)" }} />
                    {level.maxAttempts}
                  </span>
                </div>

                {/* Question Count */}
                <div>
                  <span
                    className="flex items-center gap-1 text-[12.5px]"
                    style={{ color: "var(--text2)" }}
                  >
                    <HelpCircle size={12} style={{ color: "var(--text4)" }} />
                    {level.questionCount}
                  </span>
                </div>

                {/* Time Limit */}
                <div>
                  <span
                    className="flex items-center gap-1 text-[12.5px]"
                    style={{ color: "var(--text2)" }}
                  >
                    <Clock size={12} style={{ color: "var(--text4)" }} />
                    {level.timeLimitMinutes > 0 ? `${level.timeLimitMinutes}m` : "∞"}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={level.status} />
                </div>

                {/* Created */}
                <div>
                  <span className="text-[12px]" style={{ color: "var(--text4)" }}>
                    {formatDate(level.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickStatusToggle(level)}
                    title={level.status === "active" ? "Archive" : "Activate"}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{
                      background: level.status === "active" ? "rgba(245,158,11,0.10)" : "rgba(34,211,160,0.10)",
                      color:      level.status === "active" ? "var(--amber)"          : "var(--green)",
                    }}
                  >
                    {level.status === "active" ? <Archive size={14} /> : <CheckCircle size={14} />}
                  </button>
                  <button
                    onClick={() => setEditTarget(level)}
                    title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(level)}
                    title="Delete"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-9 h-9 rounded-xl text-[13px] font-medium border-none cursor-pointer"
                  style={{
                    background: page === p ? "var(--accent)" : "var(--surface)",
                    color:      page === p ? "#fff"          : "var(--text2)",
                    border:     "1px solid var(--border2)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}