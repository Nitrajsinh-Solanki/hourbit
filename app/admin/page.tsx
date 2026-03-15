// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Brain,
  HelpCircle,
  Trophy,
  TrendingUp,
  ShieldCheck,
  Activity,
  Star,
  BarChart2,
  Tag,
} from "lucide-react";

// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accentColor,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accentColor: string;
  bgColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5"
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--border2)",
        cursor:     "default",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: bgColor }}
        >
          <Icon size={19} style={{ color: accentColor }} />
        </div>
        <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--text4)" }}>
          {label}
        </span>
      </div>
      <div>
        <div className="text-3xl font-bold font-mono" style={{ color: accentColor }}>
          {value}
        </div>
        {sub && (
          <div className="text-[12px] mt-1" style={{ color: "var(--text3)" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quick Action Card ─────────────────────────────────────────
function QuickAction({
  icon: Icon,
  title,
  desc,
  href,
  accentColor,
  bgColor,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  href: string;
  accentColor: string;
  bgColor: string;
}) {
  return (
    <a
      href={href}
      className="rounded-2xl p-4 flex items-start gap-3 no-underline transition-all hover:-translate-y-0.5"
      style={{
        background: "var(--surface)",
        border:     "1px solid var(--border2)",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bgColor }}
      >
        <Icon size={17} style={{ color: accentColor }} />
      </div>
      <div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
          {desc}
        </div>
      </div>
    </a>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.success) setAdminName(d.user.fullName || "Admin");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8">

      {/* ── Welcome header ── */}
      <div
        className="rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(232,67,147,0.13) 0%, rgba(124,110,243,0.10) 100%)",
          border:     "1px solid rgba(232,67,147,0.22)",
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} style={{ color: "var(--accent)" }} />
            <span
              className="text-[11px] font-bold tracking-widest uppercase"
              style={{ color: "var(--accent)" }}
            >
              Admin Access
            </span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Welcome back, {adminName} 👑
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
            Manage users, quizzes, analytics and platform settings from here.
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

      {/* ── Stat Cards ── */}
      <section>
        <h2 className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text4)" }}>
          Platform Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value="—"
            sub="Registered employees"
            accentColor="var(--accent)"
            bgColor="rgba(232,67,147,0.12)"
          />
          <StatCard
            icon={Brain}
            label="Brain Quizzes"
            value="—"
            sub="Total questions"
            accentColor="#a78bfa"
            bgColor="rgba(167,139,250,0.12)"
          />
          <StatCard
            icon={Tag}
            label="Categories"
            value="—"
            sub="Active categories"
            accentColor="var(--amber)"
            bgColor="rgba(245,158,11,0.12)"
          />
          <StatCard
            icon={Trophy}
            label="Top XP"
            value="—"
            sub="Highest score"
            accentColor="var(--green)"
            bgColor="rgba(34,211,160,0.12)"
          />
          <StatCard
            icon={Activity}
            label="Active Today"
            value="—"
            sub="Sessions today"
            accentColor="#60a5fa"
            bgColor="rgba(96,165,250,0.12)"
          />
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <h2 className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text4)" }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <QuickAction
            icon={Users}
            title="Manage Users"
            desc="View, edit, block, or promote users"
            href="/admin/users"
            accentColor="var(--accent)"
            bgColor="rgba(232,67,147,0.12)"
          />
          <QuickAction
            icon={HelpCircle}
            title="Add Questions"
            desc="Create new brain challenge questions"
            href="/admin/questions"
            accentColor="#a78bfa"
            bgColor="rgba(167,139,250,0.12)"
          />
          <QuickAction
            icon={Tag}
            title="Manage Categories"
            desc="Organise quiz categories & subcategories"
            href="/admin/categories"
            accentColor="var(--amber)"
            bgColor="rgba(245,158,11,0.12)"
          />
          <QuickAction
            icon={BarChart2}
            title="Brain Analytics"
            desc="See quiz performance & trends"
            href="/admin/brain-analytics"
            accentColor="var(--green)"
            bgColor="rgba(34,211,160,0.12)"
          />
          <QuickAction
            icon={Star}
            title="XP & Rewards"
            desc="Configure XP rules and reward tiers"
            href="/admin/xp-rewards"
            accentColor="#f472b6"
            bgColor="rgba(244,114,182,0.12)"
          />
          <QuickAction
            icon={Trophy}
            title="Leaderboard"
            desc="Top performers and rankings"
            href="/admin/leaderboard"
            accentColor="#60a5fa"
            bgColor="rgba(96,165,250,0.12)"
          />
        </div>
      </section>

      {/* ── Info Banner ── */}
      <div
        className="rounded-2xl px-6 py-4 flex items-start gap-3"
        style={{
          background: "rgba(245,158,11,0.08)",
          border:     "1px solid rgba(245,158,11,0.22)",
        }}
      >
        <TrendingUp size={18} style={{ color: "var(--amber)", marginTop: 2, flexShrink: 0 }} />
        <div>
          <div className="text-[13px] font-semibold" style={{ color: "var(--amber)" }}>
            How Admin Role Works
          </div>
          <div className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text3)" }}>
            Users register as <strong>employees</strong> by default. After registration &amp; email verification, 
            you can manually change their role to <code className="px-1 py-0.5 rounded text-[11px]" style={{ background: "var(--surface2)" }}>admin</code> 
            in MongoDB. On the next login, they will automatically be redirected here.
          </div>
        </div>
      </div>

    </div>
  );
}