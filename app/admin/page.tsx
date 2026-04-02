// app/admin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Clock, Coffee, LogOut as LeaveIcon, BookOpen,
  Keyboard, ChevronLeft, ChevronRight, X, Search,
  RefreshCw, TrendingUp, Calendar, Shield, Activity,
  AlertCircle, CheckCircle, Eye, User as UserIcon,
  BarChart2, Zap, FileText, Target, ArrowRight
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  _id:         string;
  fullName:    string;
  email:       string;
  status:      "active" | "suspended" | "banned";
  companyName: string;
  createdAt:   string;
  lastLogin:   string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// All date/time helpers now explicitly use Asia/Kolkata (IST, UTC+5:30)
// This ensures MongoDB's UTC timestamps render correctly regardless of
// where the server or browser is running.

const IST = "Asia/Kolkata";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: IST,
    });
  } catch { return "—"; }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: IST,
    });
  } catch { return "—"; }
}

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  active:    { text: "#22d3a0", bg: "rgba(34,211,160,0.12)",  border: "rgba(34,211,160,0.30)"  },
  suspended: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.30)"  },
  banned:    { text: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
};

// ─── Pagination Controls ──────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center mt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all disabled:opacity-30"
        style={{ background: "var(--surface2)", color: "var(--text3)" }}
      >
        <ChevronLeft size={14} />
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        const p = i + 1;
        return (
          <button
            key={p}
            onClick={() => onPage(p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all text-[13px] font-mono"
            style={{
              background: p === page ? "var(--accent)" : "var(--surface2)",
              color:      p === page ? "#fff" : "var(--text3)",
              fontWeight: p === page ? 700 : 400,
            }}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all disabled:opacity-30"
        style={{ background: "var(--surface2)", color: "var(--text3)" }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user }: { user: UserRow }) {
  const router = useRouter();
  const sc = STATUS_COLORS[user.status] || STATUS_COLORS.active;
  const initials = user.fullName?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  // Navigate to dedicated user detail page — new tab or same tab depending on preference.
  // Using router.push keeps within the Next.js app shell (layout, etc.)
  const handleView = () => router.push(`/admin/users/${user._id}`);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 cursor-pointer group"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      onClick={handleView}
    >
      {/* Avatar + name */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-[15px] shrink-0"
            style={{ background: "rgba(232,67,147,0.13)", color: "var(--accent)" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[14px] truncate" style={{ color: "var(--text)" }}>
              {user.fullName}
            </div>
            <div className="text-[12px] truncate mt-0.5" style={{ color: "var(--text4)" }}>
              {user.email}
            </div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
        >
          {user.status?.toUpperCase()}
        </span>
      </div>

      {/* Company + dates */}
      <div className="flex flex-col gap-1 text-[11px] font-mono" style={{ color: "var(--text4)" }}>
        {user.companyName && (
          <div className="flex items-center gap-1.5">
            <Shield size={10} />
            <span>{user.companyName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar size={10} />
          <span>Joined {fmtDate(user.createdAt)}</span>
        </div>
        {user.lastLogin && (
          <div className="flex items-center gap-1.5">
            <Activity size={10} />
            <span>Last login {fmtDate(user.lastLogin)}</span>
          </div>
        )}
      </div>

      {/* View button */}
      <button
        onClick={e => { e.stopPropagation(); handleView(); }}
        className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl py-2 text-[13px] font-semibold border-none cursor-pointer transition-all"
        style={{
          background: "rgba(232,67,147,0.10)",
          color:      "var(--accent)",
          border:     "1px solid rgba(232,67,147,0.20)",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.20)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.10)";
        }}
      >
        <Eye size={13} />
        View All Activity
        <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ─── Main Admin Dashboard Page ────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [adminName,     setAdminName]     = useState("Admin");
  const [users,         setUsers]         = useState<UserRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalUsers,    setTotalUsers]    = useState(0);

  const LIMIT = 12;

  // ── Fetch admin name ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.success) setAdminName(d.user.fullName || "Admin"); })
      .catch(() => {});
  }, []);

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        page:   String(page),
        limit:  String(LIMIT),
        status: statusFilter,
        search,
      });
      const res  = await fetch(`/api/admin/users?${p}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.pages || 1);
        setTotalUsers(data.pagination.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-8">

      {/* ── Welcome Banner ── */}
      <div
        className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(232,67,147,0.13) 0%, rgba(124,110,243,0.10) 100%)",
          border:     "1px solid rgba(232,67,147,0.22)",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
              Super Admin · Full Access
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Welcome back, {adminName} 👑
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
            Monitor all employee activity — attendance, breaks, diary entries, and typing performance.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold"
          style={{
            background: "rgba(34,211,160,0.12)",
            border:     "1px solid rgba(34,211,160,0.25)",
            color:      "var(--green)",
            whiteSpace: "nowrap",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          System Online
        </div>
      </div>

      {/* ── Employee Activity Monitor ── */}
      <section>
        {/* Section header */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users size={16} style={{ color: "var(--accent)" }} />
              <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>
                Employee Activity Monitor
              </h2>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text4)" }}>
              {totalUsers} employees registered · Click any card to inspect full activity
            </p>
          </div>
          <button
            onClick={() => { setPage(1); fetchUsers(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
            style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border2)" }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1" style={{ minWidth: "200px" }}>
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text4)" }}
            />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email…"
              className="w-full border-none rounded-xl px-3 py-2.5 text-[13px] pl-9"
              style={{
                background: "var(--surface2)",
                color:      "var(--text2)",
                outline:    "none",
                border:     "1px solid var(--border2)",
              }}
            />
          </div>

          {(["all", "active", "suspended", "banned"] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all capitalize"
              style={{
                background: statusFilter === s
                  ? s === "all" ? "rgba(232,67,147,0.15)" : STATUS_COLORS[s]?.bg
                  : "var(--surface2)",
                color: statusFilter === s
                  ? s === "all" ? "var(--accent)" : STATUS_COLORS[s]?.text
                  : "var(--text4)",
                border: statusFilter === s
                  ? s === "all" ? "1px solid rgba(232,67,147,0.30)" : `1px solid ${STATUS_COLORS[s]?.border}`
                  : "1px solid transparent",
              }}
            >
              {s === "all" ? "All Users" : s}
            </button>
          ))}
        </div>

        {/* User Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
              />
              <p className="text-[13px] font-mono" style={{ color: "var(--text3)" }}>Loading employees…</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div
            className="rounded-2xl p-16 flex flex-col items-center gap-4 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <UserIcon size={36} style={{ color: "var(--text4)" }} />
            <div>
              <div className="font-semibold text-[15px]" style={{ color: "var(--text3)" }}>
                No employees found
              </div>
              <div className="text-[13px] mt-1" style={{ color: "var(--text4)" }}>
                Try adjusting your search or filter
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {users.map(u => (
                <UserCard key={u._id} user={u} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
              <span className="text-[12px] font-mono" style={{ color: "var(--text4)" }}>
                Page {page} of {totalPages} · {totalUsers} total employees
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all disabled:opacity-30"
                  style={{ background: "var(--surface2)", color: "var(--text3)" }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer font-mono text-[13px] transition-all"
                        style={{
                          background: p === page ? "var(--accent)" : "var(--surface2)",
                          color:      p === page ? "#fff" : "var(--text3)",
                          fontWeight: p === page ? 700 : 400,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all disabled:opacity-30"
                  style={{ background: "var(--surface2)", color: "var(--text3)" }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Info Banner ── */}
      <div
        className="rounded-2xl px-6 py-4 flex items-start gap-3"
        style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.18)" }}
      >
        <AlertCircle size={16} style={{ color: "#60a5fa", marginTop: 2, flexShrink: 0 }} />
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "#60a5fa" }}>
            What you can monitor per employee
          </div>
          <div className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text3)" }}>
            For each employee: complete attendance history with clock-in/out times · break logs (tea, lunch, custom) ·
            daily productive hours · diary entries with full content · typing test history with WPM, accuracy and errors per session.
            All data is paginated and filterable by date range.
          </div>
        </div>
      </div>

    </div>
  );
}