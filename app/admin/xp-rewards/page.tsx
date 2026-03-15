// app/admin/xp-rewards/page.tsx
"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Star, Zap, Trophy, Shield,
  Loader2,
  AlertTriangle, CheckCircle, Info,
  RefreshCw, Save, Pencil, X,
  TrendingUp,
  Layers, BarChart3, HelpCircle, Lock,
  Tag, Target,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LevelXPRow {
  _id:                 string;
  subcategoryId:       string;
  subcategoryName:     string;
  categoryName:        string;
  levelNumber:         number;
  name:                string;
  difficulty:          "easy" | "medium" | "hard" | "expert";
  xpReward:            number;
  penaltyXpMultiplier: number;
  maxAttempts:         number;
  questionCount:       number;
  status:              string;
}

type Difficulty = "easy" | "medium" | "hard" | "expert";

// XP rules matrix (penalty multiplier display)
const DIFF_META: Record<Difficulty, { color: string; bg: string; label: string; defaultXP: number }> = {
  easy:   { color: "var(--green)",  bg: "rgba(34,211,160,0.10)",  label: "Easy",   defaultXP: 50  },
  medium: { color: "var(--amber)",  bg: "rgba(245,158,11,0.10)",  label: "Medium", defaultXP: 100 },
  hard:   { color: "#f472b6",       bg: "rgba(244,114,182,0.10)", label: "Hard",   defaultXP: 200 },
  expert: { color: "var(--danger)", bg: "rgba(248,113,113,0.10)", label: "Expert", defaultXP: 400 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  background:   "var(--bg)",
  border:       "1px solid var(--border2)",
  borderRadius: "10px",
  padding:      "8px 12px",
  fontSize:     "13.5px",
  color:        "var(--text)",
  outline:      "none",
  width:        "100%",
};

const labelSt: React.CSSProperties = {
  display:       "block",
  fontSize:      "11px",
  fontWeight:    600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color:         "var(--text3)",
  marginBottom:  "5px",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  color,
  bg,
  title,
  subtitle,
}: {
  icon:     React.ElementType;
  color:    string;
  bg:       string;
  title:    string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <h2 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>{title}</h2>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text3)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

function DiffBadge({ diff }: { diff: Difficulty }) {
  const m = DIFF_META[diff];
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          4,
        padding:      "3px 9px",
        borderRadius: "999px",
        fontSize:     "11.5px",
        fontWeight:   600,
        color:        m.color,
        background:   m.bg,
        border:       `1px solid ${m.color}30`,
        whiteSpace:   "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color }} />
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT LEVEL XP MODAL
// ─────────────────────────────────────────────────────────────────────────────

function EditLevelXPModal({
  level, onSave, onClose, saving,
}: {
  level:   LevelXPRow;
  onSave:  (id: string, data: { xpReward: number; penaltyXpMultiplier: number; maxAttempts: number }) => void;
  onClose: () => void;
  saving:  boolean;
}) {
  const [xpReward,    setXpReward]    = useState(String(level.xpReward));
  const [penalty,     setPenalty]     = useState(String(level.penaltyXpMultiplier));
  const [maxAttempts, setMaxAttempts] = useState(String(level.maxAttempts));

  const xp       = Number(xpReward)    || 0;
  const mult     = Math.min(1, Math.max(0, Number(penalty) || 0.3));
  const penaltyXP = Math.round(xp * mult);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (xp < 0)        { toast.error("XP Reward cannot be negative");        return; }
    if (xp > 10000)    { toast.error("XP Reward max is 10,000");              return; }
    if (mult < 0 || mult > 1) { toast.error("Penalty multiplier must be 0–1"); return; }
    if (Number(maxAttempts) < 1) { toast.error("Max attempts must be at least 1"); return; }
    onSave(level._id, {
      xpReward:            xp,
      penaltyXpMultiplier: mult,
      maxAttempts:         Number(maxAttempts),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.13)" }}>
              <Zap size={15} style={{ color: "var(--amber)" }} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
                Edit XP — Level {level.levelNumber}
                {level.name ? ` · ${level.name}` : ""}
              </h3>
              <p className="text-[11.5px]" style={{ color: "var(--text3)" }}>
                {level.categoryName} → {level.subcategoryName}
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

          {/* XP Reward */}
          <div>
            <label style={labelSt}>
              XP Reward (full completion) <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div className="relative">
              <Zap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#a78bfa" }} />
              <input
                type="number"
                style={{ ...inputSt, paddingLeft: "34px" }}
                value={xpReward}
                onChange={e => setXpReward(e.target.value)}
                min={0} max={10000}
                required
              />
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              XP awarded when user completes this level cleanly
            </p>
          </div>

          {/* Penalty multiplier */}
          <div>
            <label style={labelSt}>
              Penalty Multiplier (0 – 1)
            </label>
            <input
              type="number"
              style={inputSt}
              value={penalty}
              onChange={e => setPenalty(e.target.value)}
              min={0} max={1} step={0.05}
              placeholder="0.30"
            />
            <div
              className="mt-2 rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.20)" }}
            >
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--amber)" }}>
                  Exhaustion Penalty Preview
                </p>
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text3)" }}>
                  If user unlocked this level by exhausting attempts on previous level
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-[18px] font-bold font-mono" style={{ color: "var(--amber)" }}>
                  {penaltyXP} XP
                </p>
                <p className="text-[11px]" style={{ color: "var(--text4)" }}>
                  ({Math.round(mult * 100)}% of {xp} XP)
                </p>
              </div>
            </div>
          </div>

          {/* Max attempts */}
          <div>
            <label style={labelSt}>Max Attempts</label>
            <input
              type="number"
              style={inputSt}
              value={maxAttempts}
              onChange={e => setMaxAttempts(e.target.value)}
              min={1}
              required
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              After this many failed attempts the next level unlocks automatically
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
              style={{ background: "var(--amber)", color: "#0a0a0f", opacity: saving ? 0.7 : 1 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : <><Save size={14} /> Save XP</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function XPRewardsPage() {

  // ── Level XP data ──────────────────────────────────────────────────────────
  const [levels,         setLevels]         = useState<LevelXPRow[]>([]);
  const [levelsLoading,  setLevelsLoading]  = useState(true);
  const [editTarget,     setEditTarget]     = useState<LevelXPRow | null>(null);
  const [xpSaving,       setXpSaving]       = useState(false);

  // ── Category filter for level XP table ─────────────────────────────────────
  const [catFilter,  setCatFilter]  = useState("all");
  const [diffFilter, setDiffFilter] = useState<"all" | Difficulty>("all");
  const [xpSearch,   setXpSearch]   = useState("");

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalLevels:  0,
    totalXP:      0,
    avgXP:        0,
    maxXP:        0,
    minXP:        0,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH ALL LEVELS (with XP data) across all subcategories
  // We fetch categories → subcategories → levels in parallel
  // ─────────────────────────────────────────────────────────────────────────

  const fetchAllLevels = async () => {
    setLevelsLoading(true);
    try {
      // Step 1: get all active categories
      const catRes  = await fetch("/api/admin/categories?status=active&limit=200");
      const catData = await catRes.json();
      if (!catData.success) return;

      const categories: { _id: string; name: string }[] = catData.categories;

      // Step 2: get all subcategories for each category in parallel
      const subResults = await Promise.all(
        categories.map((cat) =>
          fetch(`/api/admin/subcategories?categoryId=${cat._id}&status=active&limit=200`)
            .then(r => r.json())
            .then(d => (d.success ? d.subcategories.map((s: any) => ({ ...s, categoryName: cat.name })) : []))
            .catch(() => [])
        )
      );
      const allSubs: { _id: string; name: string; categoryName: string }[] = subResults.flat();

      // Step 3: get all levels for each subcategory in parallel
      const lvlResults = await Promise.all(
        allSubs.map((sub) =>
          fetch(`/api/admin/levels?subcategoryId=${sub._id}&status=active&limit=200`)
            .then(r => r.json())
            .then(d =>
              d.success
                ? d.levels.map((l: any) => ({
                    ...l,
                    subcategoryName: sub.name,
                    categoryName:    sub.categoryName,
                  }))
                : []
            )
            .catch(() => [])
        )
      );
      const allLevels: LevelXPRow[] = lvlResults.flat();

      // Sort by categoryName → subcategoryName → levelNumber
      allLevels.sort((a, b) => {
        if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
        if (a.subcategoryName !== b.subcategoryName) return a.subcategoryName.localeCompare(b.subcategoryName);
        return a.levelNumber - b.levelNumber;
      });

      setLevels(allLevels);

      // Compute stats
      if (allLevels.length > 0) {
        const xps = allLevels.map(l => l.xpReward);
        setStats({
          totalLevels: allLevels.length,
          totalXP:     xps.reduce((a, b) => a + b, 0),
          avgXP:       Math.round(xps.reduce((a, b) => a + b, 0) / xps.length),
          maxXP:       Math.max(...xps),
          minXP:       Math.min(...xps),
        });
      }
    } catch {
      toast.error("Failed to load level XP data");
    } finally {
      setLevelsLoading(false);
    }
  };

  useEffect(() => { fetchAllLevels(); }, []);

  // ── Unique categories for filter ───────────────────────────────────────────
  const uniqueCategories = Array.from(new Set(levels.map(l => l.categoryName))).sort();

  // ── Filtered levels ────────────────────────────────────────────────────────
  const filteredLevels = levels.filter(l => {
    if (catFilter  !== "all" && l.categoryName !== catFilter) return false;
    if (diffFilter !== "all" && l.difficulty   !== diffFilter) return false;
    if (xpSearch) {
      const q = xpSearch.toLowerCase();
      if (
        !l.categoryName.toLowerCase().includes(q) &&
        !l.subcategoryName.toLowerCase().includes(q) &&
        !String(l.levelNumber).includes(q) &&
        !(l.name?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  // ── Save level XP edit ─────────────────────────────────────────────────────
  const handleSaveXP = async (
    id:   string,
    data: { xpReward: number; penaltyXpMultiplier: number; maxAttempts: number }
  ) => {
    setXpSaving(true);
    try {
      const res  = await fetch(`/api/admin/levels/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("XP updated successfully!");
      setEditTarget(null);
      setLevels(prev => prev.map(l => l._id === id ? { ...l, ...data } : l));
      // Re-compute stats
      const updated = levels.map(l => l._id === id ? { ...l, ...data } : l);
      const xps = updated.map(l => l.xpReward);
      setStats({
        totalLevels: updated.length,
        totalXP:     xps.reduce((a, b) => a + b, 0),
        avgXP:       Math.round(xps.reduce((a, b) => a + b, 0) / xps.length),
        maxXP:       Math.max(...xps),
        minXP:       Math.min(...xps),
      });
    } catch {
      toast.error("Failed to update XP");
    } finally {
      setXpSaving(false);
    }
  };

  const formatXP = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {editTarget && (
        <EditLevelXPModal
          level={editTarget}
          onSave={handleSaveXP}
          onClose={() => setEditTarget(null)}
          saving={xpSaving}
        />
      )}

      <div className="flex flex-col gap-8">

        {/* ── Page Header ── */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(244,114,182,0.10) 100%)",
            border:     "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={18} style={{ color: "var(--amber)" }} />
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--amber)" }}>
                XP & Rewards System
              </span>
            </div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
              Configure XP Rules & Reward Tiers
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              Set XP rewards per level, configure penalty rules, and understand XP calculation scenarios.
            </p>
          </div>
          <button
            onClick={fetchAllLevels}
            disabled={levelsLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.30)" }}
          >
            <RefreshCw size={14} className={levelsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Levels",    value: stats.totalLevels,        icon: BarChart3,  color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
            { label: "Total XP Pool",   value: formatXP(stats.totalXP),  icon: Zap,        color: "var(--amber)",  bg: "rgba(245,158,11,0.12)"  },
            { label: "Average XP",      value: formatXP(stats.avgXP),    icon: TrendingUp, color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
            { label: "Highest XP",      value: formatXP(stats.maxXP),    icon: Trophy,     color: "var(--green)",  bg: "rgba(34,211,160,0.12)"  },
            { label: "Lowest XP",       value: formatXP(stats.minXP),    icon: Target,     color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={17} style={{ color }} />
                </div>
              </div>
              <div>
                <div className="text-[22px] font-bold font-mono" style={{ color }}>
                  {levelsLoading ? "—" : value}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-widest mt-0.5" style={{ color: "var(--text4)" }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── HOW XP WORKS info banner ── */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.20)" }}
        >
          <div className="flex items-center gap-2">
            <Info size={16} style={{ color: "#60a5fa" }} />
            <span className="text-[13.5px] font-bold" style={{ color: "#60a5fa" }}>
              How the XP System Works
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: CheckCircle,
                color: "var(--green)",
                bg:    "rgba(34,211,160,0.10)",
                title: "Clean Completion",
                desc:  "User completes a level successfully within max attempts → earns full XP Reward configured for that level.",
              },
              {
                icon: AlertTriangle,
                color: "var(--amber)",
                bg:    "rgba(245,158,11,0.10)",
                title: "Exhaustion Penalty",
                desc:  "User unlocks next level by exhausting max attempts (not by completing) → earns only Penalty % × XP Reward on that next level's completion.",
              },
              {
                icon: Lock,
                color: "var(--danger)",
                bg:    "rgba(248,113,113,0.10)",
                title: "Anti-Cheat",
                desc:  "If a user starts a level and abandons/refreshes, the attempt is still counted automatically via session tracking.",
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div
                key={title}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>{title}</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text3)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 1 — LEVEL XP CONFIGURATION TABLE
        ════════════════════════════════════════════════════════════════════ */}
        <section
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <SectionHeader
            icon={Zap}
            color="var(--amber)"
            bg="rgba(245,158,11,0.13)"
            title="Level XP Configuration"
            subtitle="View and edit XP reward, penalty multiplier, and max attempts for every level across all categories."
          />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <HelpCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text4)" }} />
              <input
                style={{ ...inputSt, paddingLeft: "34px" }}
                placeholder="Search by category, subcategory, level name…"
                value={xpSearch}
                onChange={e => setXpSearch(e.target.value)}
              />
              {xpSearch && (
                <button
                  onClick={() => setXpSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 border-none cursor-pointer bg-transparent p-0"
                  style={{ color: "var(--text4)" }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category filter */}
            <select
              style={{ ...inputSt, width: "auto", cursor: "pointer", minWidth: "160px" }}
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Difficulty filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border2)" }}>
              {(["all", "easy", "medium", "hard", "expert"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDiffFilter(d)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium border-none cursor-pointer whitespace-nowrap"
                  style={{
                    background: diffFilter === d ? "var(--accent)" : "transparent",
                    color:      diffFilter === d ? "#fff"           : "var(--text3)",
                  }}
                >
                  {d === "all" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {levelsLoading && (
            <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--text3)" }}>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[13px]">Loading levels…</span>
            </div>
          )}

          {/* Empty */}
          {!levelsLoading && filteredLevels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface2)" }}>
                <BarChart3 size={24} style={{ color: "var(--text4)" }} />
              </div>
              <p className="text-[14px]" style={{ color: "var(--text3)" }}>
                {xpSearch || catFilter !== "all" || diffFilter !== "all"
                  ? "No levels match your filters"
                  : "No levels found — create levels in Levels Management first"}
              </p>
            </div>
          )}

          {/* MOBILE CARDS */}
          {!levelsLoading && filteredLevels.length > 0 && (
            <div className="flex flex-col gap-3 md:hidden">
              {filteredLevels.map(level => (
                <div
                  key={level._id}
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: "var(--bg)", border: "1px solid var(--border2)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold truncate" style={{ color: "var(--text)" }}>
                        Level {level.levelNumber}{level.name ? ` — ${level.name}` : ""}
                      </p>
                      <p className="text-[11.5px] truncate" style={{ color: "var(--text4)" }}>
                        {level.categoryName} → {level.subcategoryName}
                      </p>
                    </div>
                    <DiffBadge diff={level.difficulty} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl p-3" style={{ background: "var(--surface2)" }}>
                    <div className="flex flex-col items-center gap-1">
                      <Zap size={13} style={{ color: "#a78bfa" }} />
                      <span className="text-[14px] font-bold font-mono" style={{ color: "#a78bfa" }}>
                        {level.xpReward}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text4)" }}>Full XP</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <AlertTriangle size={13} style={{ color: "var(--amber)" }} />
                      <span className="text-[14px] font-bold font-mono" style={{ color: "var(--amber)" }}>
                        {Math.round(level.xpReward * level.penaltyXpMultiplier)}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text4)" }}>Penalty XP</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Target size={13} style={{ color: "#60a5fa" }} />
                      <span className="text-[14px] font-bold font-mono" style={{ color: "#60a5fa" }}>
                        {level.maxAttempts}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text4)" }}>Max Tries</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditTarget(level)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
                    style={{ background: "rgba(245,158,11,0.12)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.25)" }}
                  >
                    <Pencil size={13} /> Edit XP
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* DESKTOP TABLE */}
          {!levelsLoading && filteredLevels.length > 0 && (
            <div className="rounded-2xl overflow-hidden hidden md:block" style={{ border: "1px solid var(--border2)" }}>
              {/* Header */}
              <div
                className="grid items-center px-5 py-3"
                style={{
                  gridTemplateColumns: "1.6fr 1.4fr 80px 120px 110px 100px 80px 96px",
                  background:         "var(--surface2)",
                  borderBottom:       "1px solid var(--border2)",
                }}
              >
                {["Category / Subcategory", "Level", "Diff.", "Full XP", "Penalty XP", "Max Tries", "Questions", "Actions"].map(h => (
                  <span
                    key={h}
                    style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows — grouped by category with divider */}
              {(() => {
                let lastCat = "";
                return filteredLevels.map(level => {
                  const showDivider = level.categoryName !== lastCat;
                  lastCat = level.categoryName;
                  const penaltyXP = Math.round(level.xpReward * level.penaltyXpMultiplier);

                  return (
                    <div key={level._id}>
                      {showDivider && (
                        <div
                          className="flex items-center gap-3 px-5 py-2"
                          style={{
                            background:   "rgba(232,67,147,0.05)",
                            borderTop:    "1px solid var(--border)",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <Tag size={12} style={{ color: "var(--accent)" }} />
                          <span className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                            {level.categoryName}
                          </span>
                        </div>
                      )}
                      <div
                        className="grid items-center px-5 py-3 transition-colors"
                        style={{
                          gridTemplateColumns: "1.6fr 1.4fr 80px 120px 110px 100px 80px 96px",
                          borderBottom:        "1px solid var(--border)",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent";     }}
                      >
                        {/* Category / Sub */}
                        <div className="min-w-0 pr-2">
                          <p className="text-[12px] truncate" style={{ color: "var(--text3)" }}>
                            {level.subcategoryName}
                          </p>
                        </div>

                        {/* Level */}
                        <div className="min-w-0 pr-2">
                          <p className="text-[13.5px] font-semibold" style={{ color: "var(--text)" }}>
                            Level {level.levelNumber}
                          </p>
                          {level.name && (
                            <p className="text-[11.5px] truncate" style={{ color: "var(--text4)" }}>
                              {level.name}
                            </p>
                          )}
                        </div>

                        {/* Difficulty */}
                        <div>
                          <DiffBadge diff={level.difficulty} />
                        </div>

                        {/* Full XP */}
                        <div>
                          <span
                            className="flex items-center gap-1.5 text-[14px] font-bold font-mono"
                            style={{ color: "#a78bfa" }}
                          >
                            <Zap size={13} style={{ color: "#a78bfa" }} />
                            {level.xpReward} XP
                          </span>
                        </div>

                        {/* Penalty XP */}
                        <div>
                          <span
                            className="flex items-center gap-1.5 text-[13px] font-mono"
                            style={{ color: "var(--amber)" }}
                          >
                            <AlertTriangle size={12} />
                            {penaltyXP} XP
                          </span>
                          <span className="text-[10.5px]" style={{ color: "var(--text4)" }}>
                            ({Math.round(level.penaltyXpMultiplier * 100)}%)
                          </span>
                        </div>

                        {/* Max attempts */}
                        <div>
                          <span
                            className="flex items-center gap-1.5 text-[13.5px] font-semibold font-mono"
                            style={{ color: "#60a5fa" }}
                          >
                            <Target size={13} />
                            {level.maxAttempts}
                          </span>
                        </div>

                        {/* Question count */}
                        <div>
                          <span
                            className="flex items-center gap-1.5 text-[13.5px] font-mono"
                            style={{ color: "var(--text3)" }}
                          >
                            <HelpCircle size={12} />
                            {level.questionCount}
                          </span>
                        </div>

                        {/* Action */}
                        <div>
                          <button
                            onClick={() => setEditTarget(level)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold border-none cursor-pointer"
                            style={{ background: "rgba(245,158,11,0.12)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.25)" }}
                          >
                            <Pencil size={12} /> Edit XP
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Summary */}
          {!levelsLoading && filteredLevels.length > 0 && (
            <p className="text-[12px] mt-3" style={{ color: "var(--text4)" }}>
              Showing <strong style={{ color: "var(--text)" }}>{filteredLevels.length}</strong> of{" "}
              <strong style={{ color: "var(--text)" }}>{levels.length}</strong> levels
            </p>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SECTION 2 — XP RULES REFERENCE
        ════════════════════════════════════════════════════════════════════ */}
        <section
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <SectionHeader
            icon={Shield}
            color="#60a5fa"
            bg="rgba(96,165,250,0.13)"
            title="XP Rules Reference"
            subtitle="Quick-reference for how XP is calculated, applied, and deducted across all scenarios."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon:  CheckCircle,
                color: "var(--green)",
                bg:    "rgba(34,211,160,0.10)",
                title: "Full Completion",
                rule:  "User answers all questions correctly within attempt limit",
                calc:  "Earns = Level xpReward (100%)",
                example: "Level XP = 200 → User earns 200 XP",
              },
              {
                icon:  AlertTriangle,
                color: "var(--amber)",
                bg:    "rgba(245,158,11,0.10)",
                title: "Exhaustion Unlock",
                rule:  "User failed previous level but hit max attempts, auto-unlocked next",
                calc:  "Earns = Level xpReward × penaltyXpMultiplier (default 30%)",
                example: "Level XP = 200, penalty = 0.30 → User earns 60 XP",
              },
              {
                icon:  Zap,
                color: "#a78bfa",
                bg:    "rgba(167,139,250,0.10)",
                title: "Hint Used",
                rule:  "User reveals the hint for a question",
                calc:  "Level total XP − hintXpPenalty per hint used",
                example: "Hint penalty = 10 XP → User earns 200 − 10 = 190 XP",
              },
              {
                icon:  Lock,
                color: "var(--danger)",
                bg:    "rgba(248,113,113,0.10)",
                title: "Abandoned Session",
                rule:  "User starts level, closes or refreshes without submitting",
                calc:  "Attempt counted, no XP earned for that session",
                example: "maxAttempts = 3, user abandons 2× → 1 attempt left",
              },
              {
                icon:  Target,
                color: "#f472b6",
                bg:    "rgba(244,114,182,0.10)",
                title: "Max Attempts Reached",
                rule:  "User exhausts all attempts without completing",
                calc:  "Next level unlocks but XP penalty flag is set on progress doc",
                example: "maxAttempts = 3, all failed → next level unlocks with penalty flag",
              },
              {
                icon:  TrendingUp,
                color: "var(--green)",
                bg:    "rgba(34,211,160,0.10)",
                title: "Cumulative XP",
                rule:  "Total XP = sum of all levels completed (with or without penalty)",
                calc:  "Total XP determines the user's tier from the tier ladder above",
                example: "500 total XP → Explorer tier unlocked",
              },
            ].map(({ icon: Icon, color, bg, title, rule, calc, example }) => (
              <div
                key={title}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: "var(--bg)", border: "1px solid var(--border2)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{title}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--text3)" }}>
                    <span className="font-semibold" style={{ color: "var(--text2)" }}>When:</span> {rule}
                  </p>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--text3)" }}>
                    <span className="font-semibold" style={{ color: "var(--text2)" }}>Formula:</span> {calc}
                  </p>
                  <div
                    className="rounded-lg px-3 py-2 text-[11.5px] font-mono"
                    style={{ background: `${color}0d`, color, border: `1px solid ${color}25` }}
                  >
                    {example}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}