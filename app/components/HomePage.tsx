// app/components/HomePage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Fully redesigned — 2025
// Showcases: Work Tracker · Brain Quiz · Diary · Typing Test · Expense Tracker
// Fully SEO + AEO (Answer Engine Optimization) optimised
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
interface Tool {
  id:       string;
  emoji:    string;
  accent:   string;
  accentBg: string;
  title:    string;
  tagline:  string;
  bullets:  string[];
}

interface Step    { num: string; title: string; desc: string; }
interface FAQ     { q: string; a: string; }
interface Compare { label: string; ours: boolean; theirs: boolean | "partial"; }

/* ─── Data ───────────────────────────────────────────────── */

const TOOLS: Tool[] = [
  {
    id:       "work-tracker",
    emoji:    "⏱️",
    accent:   "#a78bfa",
    accentBg: "rgba(124,110,243,0.10)",
    title:    "Work Hours Tracker",
    tagline:  "Know exactly when you've done 8.5 hours — live.",
    bullets: [
      "Real-time productive hours counter",
      "Smart break deduction every second",
      "Predicted leave time — auto-updated",
      "Edit any past date's attendance log",
      "Holiday management & auto-exclusion",
      "Analytics — CSV & PDF export",
    ],
  },
  {
    id:       "brain-quiz",
    emoji:    "🧠",
    accent:   "#fbbf24",
    accentBg: "rgba(251,191,36,0.10)",
    title:    "Brain Quiz & XP",
    tagline:  "Challenge your mind. Earn XP. Climb the leaderboard.",
    bullets: [
      "Multiple categories & subcategories",
      "Level-based quiz progression",
      "XP rewards for correct answers",
      "Hint system with XP deductions",
      "Live leaderboard ranking",
      "Detailed result breakdown per question",
    ],
  },
  {
    id:       "diary",
    emoji:    "📓",
    accent:   "#f472b6",
    accentBg: "rgba(244,114,182,0.10)",
    title:    "Personal Diary",
    tagline:  "Your private daily journal — secured by your account.",
    bullets: [
      "Date-tagged journal entries",
      "Full-text search across all entries",
      "Custom diary settings",
      "Diary reminder notifications",
      "Calendar-based date picker",
      "Completely private to your account",
    ],
  },
  {
    id:       "typing-test",
    emoji:    "⌨️",
    accent:   "#22d3a0",
    accentBg: "rgba(34,211,160,0.10)",
    title:    "Typing Speed Test",
    tagline:  "Measure your WPM. Track improvement. Type faster.",
    bullets: [
      "Accurate WPM & accuracy measurement",
      "Multiple timer modes",
      "Full test history saved",
      "Performance analytics & trends",
      "Compare sessions over time",
      "Track your personal best",
    ],
  },
  {
    id:       "expenses",
    emoji:    "💰",
    accent:   "#34d399",
    accentBg: "rgba(52,211,153,0.10)",
    title:    "Expense Tracker",
    tagline:  "Log spending, manage your wallet, understand your habits.",
    bullets: [
      "Personal digital wallet",
      "Add money & log expenses",
      "Category-based transaction tagging",
      "Transaction history & batch delete",
      "Spending analysis with charts",
      "Daily & monthly financial breakdown",
    ],
  },
];

const STATS = [
  { num: "5",       label: "Free Tools"          },
  { num: "Live",    label: "Work Hours Counter"   },
  { num: "XP",      label: "Brain Quiz Rewards"   },
  { num: "WPM",     label: "Typing Speed Tracked" },
  { num: "₹/$ 0",   label: "Forever Free"         },
];

const STEPS: Step[] = [
  {
    num:   "01",
    title: "Create Your Free Account",
    desc:  "Sign up in under 60 seconds — no credit card, no setup fees. Verify your email and you're immediately inside your personal productivity workspace.",
  },
  {
    num:   "02",
    title: "Pick Your Tool & Start",
    desc:  "Clock in for the day, take a Brain Quiz, write a diary entry, run a typing test, or add an expense. Each tool is independent — use what you need, when you need it.",
  },
  {
    num:   "03",
    title: "Build Habits. See Growth.",
    desc:  "Your work logs, quiz XP, diary entries, WPM scores, and expenses are all tracked over time. Review your analytics and watch your productivity compound every week.",
  },
];

const FAQS: FAQ[] = [
  {
    q: "Is Hour Bit completely free?",
    a: "Yes — Hour Bit is 100% free. No credit card required, no subscription tiers, no hidden fees. All five tools are fully accessible from the moment you create your account.",
  },
  {
    q: "What tools does Hour Bit include?",
    a: "Hour Bit includes: (1) Work Hours Tracker with real-time leave prediction, (2) Brain Quiz with XP & leaderboard, (3) Personal Diary for private journaling, (4) Typing Speed Test to measure WPM, and (5) Expense Tracker with wallet and spending analysis.",
  },
  {
    q: "How does the work hours leave time prediction work?",
    a: "Hour Bit tracks your clock-in time, deducts all logged break durations from the running total, and calculates the exact moment you will complete your target productive hours (default 8.5h). The predicted leave time updates live every second throughout the day.",
  },
  {
    q: "Can I edit past work attendance records?",
    a: "Yes. Use the 'Go Date Wise' feature to retroactively add or update any past date's work log — including entry time, individual breaks, and exit time — as accurately as if you had tracked it live on that day.",
  },
  {
    q: "How does the Brain Quiz XP system work?",
    a: "You earn base XP for completing a quiz level correctly. Using hints deducts XP. A leaderboard ranks all users by total XP. You can progress through levels in each subcategory — correct answers advance you, while exhausting attempts unlocks the next level with a penalty multiplier.",
  },
  {
    q: "Is the personal diary private?",
    a: "Yes. Your diary entries are tied to your account and secured by JWT authentication. No one else can access your entries. You can search past entries, configure diary settings, and enable reminder notifications.",
  },
  {
    q: "Can I use Hour Bit for flexible work hours (not 9-to-5)?",
    a: "Yes. Hour Bit is purpose-built for flexible timing employees. Set your own daily target hours and the tracker adapts. You are not locked into a fixed 9-to-5 or any set schedule.",
  },
  {
    q: "Is Hour Bit secure?",
    a: "Yes. Hour Bit uses JWT authentication, bcrypt password hashing, email OTP verification for sensitive account changes, per-device session management, and rate limiting on all API endpoints.",
  },
];

const COMPARE: Compare[] = [
  { label: "Work hours tracker for flexible schedules", ours: true,  theirs: false       },
  { label: "Real-time leave time prediction",           ours: true,  theirs: false       },
  { label: "Brain Quiz with XP & leaderboard",         ours: true,  theirs: false       },
  { label: "Personal diary & journaling",               ours: true,  theirs: false       },
  { label: "Typing speed test with history",            ours: true,  theirs: false       },
  { label: "Expense tracking with analytics",           ours: true,  theirs: "partial"   },
  { label: "Past attendance record editing",            ours: true,  theirs: false       },
  { label: "Holiday auto-exclusion from stats",         ours: true,  theirs: false       },
  { label: "All features in one free account",          ours: true,  theirs: false       },
  { label: "100% free — no credit card ever",           ours: true,  theirs: false       },
];

/* ─── Component ──────────────────────────────────────────── */
export default function HomePage() {
  return (
    <main
      className="bg-[#0a0a0f] text-[#e8e8f0] overflow-x-hidden"
      itemScope
      itemType="https://schema.org/WebPage"
    >

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Hour Bit — Free Productivity Suite for Employees"
        className="relative w-full flex flex-col items-center justify-center text-center px-6 pb-24"
        style={{ minHeight: "calc(100vh - 60px)", paddingTop: "80px" }}
      >
        {/* grid overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(30,30,46,0.5) 1px,transparent 1px)," +
              "linear-gradient(90deg,rgba(30,30,46,0.5) 1px,transparent 1px)",
            backgroundSize: "56px 56px",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 0%,black 20%,transparent 80%)",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 0%,black 20%,transparent 80%)",
          }}
        />

        {/* hero glow */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "rgba(124,110,243,0.09)", filter: "blur(140px)" }}
        />

        {/* floating tool icons */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { emoji: "⏱️", top: "18%", left: "8%",  size: 28, delay: "0s"    },
            { emoji: "🧠", top: "22%", right: "9%",  size: 30, delay: "0.6s"  },
            { emoji: "📓", top: "65%", left: "6%",  size: 26, delay: "1.2s"  },
            { emoji: "⌨️", top: "70%", right: "8%",  size: 28, delay: "1.8s"  },
            { emoji: "💰", top: "42%", left: "4%",  size: 24, delay: "0.9s"  },
          ].map(({ emoji, top, left, right, size, delay }, i) => (
            <span
              key={i}
              className="absolute animate-float-slow select-none opacity-20"
              style={{ top, left, right, fontSize: size, animationDelay: delay }}
            >
              {emoji}
            </span>
          ))}
        </div>

        {/* badge */}
        <div className="relative z-10 inline-flex items-center gap-2 bg-[#111118] border border-[#2a2a35] rounded-full px-4 py-2 mb-8 animate-fade-up">
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse-glow block"
          />
          <span className="font-mono text-[12px] text-[#9898b0]">
            5 Free Tools · 1 Productivity Workspace
          </span>
        </div>

        {/* H1 */}
        <h1
          className="relative z-10 font-extrabold leading-[0.92] tracking-tight mb-6 animate-fade-up delay-1"
          style={{ fontSize: "clamp(42px, 7vw, 84px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          itemProp="headline"
        >
          Your Free
          <br />
          <span className="gradient-text">Productivity Suite</span>
          <br />
          for Employees
        </h1>

        {/* subtitle */}
        <p
          className="relative z-10 font-mono text-[15px] text-[#9898b0] leading-[1.88] mb-10 animate-fade-up delay-2"
          style={{ maxWidth: 560 }}
          itemProp="description"
        >
          Track work hours &amp; predict leave time · Challenge yourself with Brain Quizzes ·
          Journal your day · Measure typing speed · Manage expenses.{" "}
          <strong className="text-[#e8e8f0] font-normal">
            Five tools. One free account. Zero credit card.
          </strong>
        </p>

        {/* CTA */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-20 animate-fade-up delay-3">
          <Link
            href="/auth/register"
            className="font-mono text-[14px] font-semibold text-white px-8 py-3.5 rounded-xl transition-all no-underline"
            style={{
              background: "linear-gradient(135deg,#7c6ef3,#6c5ee3)",
              boxShadow:  "0 0 30px rgba(124,110,243,0.4)",
            }}
            aria-label="Create free Hour Bit account — all 5 tools, no credit card"
          >
            Start Free — All 5 Tools →
          </Link>
          <Link
            href="/auth/login"
            className="font-mono text-[14px] text-[#9898b0] hover:text-[#e8e8f0] px-8 py-3.5 rounded-xl border border-[#2a2a35] hover:border-[#7c6ef3]/40 hover:bg-[#7c6ef3]/10 transition-all no-underline"
            aria-label="Sign in to your Hour Bit account"
          >
            Sign In
          </Link>
        </div>

        {/* stats bar */}
        <div
          className="relative z-10 w-full max-w-[760px] grid grid-cols-5 bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden animate-fade-up delay-4"
          role="list"
          aria-label="Hour Bit key stats"
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              role="listitem"
              className={`flex flex-col items-center justify-center py-5 px-2 ${i < 4 ? "border-r border-[#1e1e2e]" : ""}`}
            >
              <span
                className="font-extrabold text-xl leading-none mb-1.5"
                style={{
                  color:       "#a78bfa",
                  fontFamily: "'Syne', system-ui, sans-serif",
                }}
              >
                {s.num}
              </span>
              <span className="font-mono text-[10px] text-[#5a5a72] text-center leading-tight">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SOCIAL PROOF STRIP
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Who uses Hour Bit"
        className="px-6 py-10 border-y border-[#1e1e2e] bg-[#0d0d14]"
      >
        <div className="max-w-[900px] mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
          <p className="font-mono text-[12px] text-[#5a5a72] tracking-widest uppercase">
            Used by employees at
          </p>
          {["Startups", "IT Companies", "Remote Teams", "BPO Firms", "Freelancers", "Agencies"].map(
            (label) => (
              <span key={label} className="font-extrabold text-[14px] text-[#2e2e42]"
                style={{ fontFamily: "'Syne', system-ui, sans-serif" }}>
                {label}
              </span>
            )
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          5 TOOLS GRID
      ══════════════════════════════════════════════════════ */}
      <section
        id="tools"
        aria-label="Hour Bit productivity tools and features"
        className="px-6 py-24"
      >
        <div className="max-w-[1140px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
            All Features
          </p>
          <h2
            className="font-extrabold leading-[1.05] mb-5"
            style={{ fontSize: "clamp(28px,4vw,46px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            5 Tools in 1 Free Workspace
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.82] mb-14" style={{ maxWidth: 560 }}>
            Most productivity apps charge separately for every tool. Hour Bit gives you an entire
            employee productivity suite — work tracking, mental training, journaling, typing, and
            finances — all free under one login.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOLS.map((tool) => (
              <article
                key={tool.id}
                id={tool.id}
                className="shimmer-card p-6 rounded-2xl bg-[#111118] border border-[#1e1e2e] hover:border-[#7c6ef3]/35 hover:-translate-y-1 transition-all duration-300 cursor-default"
                aria-label={`${tool.title} — ${tool.tagline}`}
              >
                {/* icon */}
                <div
                  aria-hidden="true"
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5"
                  style={{ background: tool.accentBg, border: `1px solid ${tool.accent}22` }}
                >
                  {tool.emoji}
                </div>

                {/* title + tagline */}
                <h3
                  className="font-semibold text-[16px] text-[#e8e8f0] mb-1.5"
                  style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                >
                  {tool.title}
                </h3>
                <p className="font-mono text-[12px] mb-5" style={{ color: tool.accent }}>
                  {tool.tagline}
                </p>

                {/* bullets */}
                <ul className="flex flex-col gap-2" role="list">
                  {tool.bullets.map((b) => (
                    <li key={b} className="font-mono text-[12px] text-[#9898b0] flex items-start gap-2">
                      <span aria-hidden="true" style={{ color: tool.accent }} className="shrink-0 mt-0.5">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}

            {/* CTA card — fills 6th cell in 3-col grid */}
            <div
              className="p-6 rounded-2xl flex flex-col items-start justify-between border border-dashed border-[#2a2a35] hover:border-[#7c6ef3]/40 transition-all duration-300 cursor-default"
              style={{ background: "rgba(124,110,243,0.04)" }}
            >
              <div>
                <p className="font-mono text-[11px] text-[#5a5a72] tracking-[2px] uppercase mb-3">
                  Everything included
                </p>
                <h3
                  className="font-bold text-[20px] text-[#e8e8f0] mb-3 leading-tight"
                  style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                >
                  All 5 Tools
                  <br />
                  Free Forever
                </h3>
                <p className="font-mono text-[13px] text-[#9898b0] leading-[1.72] mb-6">
                  No feature gating. No premium tier. Create one free account and access every tool
                  from day one.
                </p>
              </div>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 font-mono text-[13px] font-medium text-white px-5 py-3 rounded-xl transition-all no-underline"
                style={{
                  background: "linear-gradient(135deg,#7c6ef3,#6c5ee3)",
                  boxShadow:  "0 0 22px rgba(124,110,243,0.3)",
                }}
              >
                Get Started Free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          WORK TRACKER SPOTLIGHT
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Work hours tracker — real-time leave time prediction"
        className="px-6 py-24 bg-[#0d0d14]"
      >
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* copy */}
          <div>
            <div
              aria-hidden="true"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[22px] mb-5"
              style={{ background: "rgba(124,110,243,0.10)", border: "1px solid rgba(124,110,243,0.2)" }}
            >
              ⏱️
            </div>
            <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
              Work Hours Tracker
            </p>
            <h2
              className="font-extrabold leading-[1.06] mb-5"
              style={{ fontSize: "clamp(26px,3.5vw,42px)", fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              Know Exactly
              <br />
              When to Leave Work
            </h2>
            <p className="font-mono text-[14px] text-[#9898b0] leading-[1.88] mb-5">
              Employees with flexible timing spend minutes every day mentally calculating —
              &ldquo;have I done 8.5 hours?&rdquo; Hour Bit eliminates this with a{" "}
              <strong className="text-[#e8e8f0] font-normal">real-time work hours tracker</strong>{" "}
              that auto-deducts breaks and shows your predicted leave time live.
            </p>
            <p className="font-mono text-[14px] text-[#9898b0] leading-[1.88] mb-8">
              Forgot to log yesterday? Use <strong className="text-[#e8e8f0] font-normal">Go Date Wise</strong>{" "}
              to retroactively fill any past date. Mark public holidays and they&apos;re auto-excluded
              from your productivity averages.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "Auto-calculates productive hours from clock-in",
                "Deducts every break in real time",
                "Predicted leave time updates every second",
                "Edit any past day's attendance record",
                "Holiday auto-excluded from weekly stats",
                "Productivity charts · CSV & PDF export",
              ].map((item) => (
                <p key={item} className="font-mono text-[12px] text-[#22d3a0] flex items-center gap-2">
                  <span aria-hidden="true">✓</span>{item}
                </p>
              ))}
            </div>
          </div>

          {/* live timer UI preview */}
          <div
            className="relative animate-float"
            aria-label="Work hours tracker showing 5:42 productive hours and 6:29 PM leave prediction"
            role="img"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-3xl blur-3xl"
              style={{ background: "rgba(124,110,243,0.07)" }}
            />
            <div className="relative bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
              {/* window chrome */}
              <div aria-hidden="true" className="flex items-center gap-1.5 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#22d3a0]" />
                <span className="font-mono text-[11px] text-[#5a5a72] ml-2">
                  hourbit — today&apos;s work session
                </span>
              </div>

              <p className="font-mono text-[11px] text-[#5a5a72] tracking-widest uppercase mb-2">
                Productive Hours · Target 8.5h
              </p>
              <p
                className="font-extrabold text-[#a78bfa] leading-none tracking-tight mb-5"
                style={{ fontSize: 52, fontFamily: "'Syne', system-ui, sans-serif" }}
              >
                05:42:17
              </p>

              {/* progress bar */}
              <div className="mb-5">
                <div className="flex justify-between font-mono text-[11px] text-[#5a5a72] mb-2">
                  <span>Daily progress</span>
                  <span className="text-[#22d3a0]">67.3% complete</span>
                </div>
                <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: "67.3%", background: "linear-gradient(to right,#7c6ef3,#a78bfa)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[#0a0a0f] rounded-xl p-3.5">
                  <p className="font-mono text-[10px] text-[#5a5a72] mb-1.5">Break Time</p>
                  <p
                    className="font-semibold text-[17px] text-[#fbbf24]"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    00:50:00
                  </p>
                </div>
                <div className="bg-[#0a0a0f] rounded-xl p-3.5">
                  <p className="font-mono text-[10px] text-[#5a5a72] mb-1.5">Leave at</p>
                  <p
                    className="font-semibold text-[17px] text-[#22d3a0]"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    06:29 PM
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse-glow block" />
                <span className="font-mono text-[12px] text-[#22d3a0]">
                  Live — 2h 47m remaining
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          BRAIN QUIZ SPOTLIGHT
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Brain Quiz with XP rewards and leaderboard"
        className="px-6 py-24"
      >
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* quiz UI preview */}
          <div
            className="relative animate-float-slow order-2 lg:order-1"
            aria-label="Brain Quiz showing XP progress and leaderboard rankings"
            role="img"
          >
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-3xl blur-3xl"
              style={{ background: "rgba(251,191,36,0.06)" }}
            />
            <div className="relative bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
              <div aria-hidden="true" className="flex items-center gap-1.5 mb-6">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#22d3a0]" />
                <span className="font-mono text-[11px] text-[#5a5a72] ml-2">
                  hourbit — brain quiz · science
                </span>
              </div>

              {/* XP counter */}
              <p className="font-mono text-[11px] text-[#5a5a72] tracking-widest uppercase mb-2">
                Your XP Balance
              </p>
              <p
                className="font-extrabold leading-none mb-6"
                style={{ fontSize: 48, fontFamily: "'Syne', system-ui, sans-serif", color: "#fbbf24" }}
              >
                2,480 XP
              </p>

              {/* last result */}
              <div className="bg-[#0a0a0f] rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono text-[11px] text-[#5a5a72]">Last Quiz · Level 3</p>
                  <span
                    className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(34,211,160,0.1)", color: "#22d3a0" }}
                  >
                    +120 XP
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[12px] text-[#9898b0]">
                  <span>Score: <strong className="text-[#e8e8f0]">80%</strong></span>
                  <span>8/10 correct</span>
                  <span>Time: 4m 12s</span>
                </div>
              </div>

              {/* mini leaderboard */}
              <p className="font-mono text-[10px] text-[#5a5a72] tracking-widest uppercase mb-3">
                Leaderboard
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { rank: "🥇", name: "You",   xp: "2,480", color: "#fbbf24" },
                  { rank: "🥈", name: "Raj",   xp: "2,210", color: "#9898b0" },
                  { rank: "🥉", name: "Priya", xp: "1,990", color: "#cd7c3a" },
                ].map((row) => (
                  <div key={row.name} className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-[#9898b0]">
                      {row.rank} {row.name}
                    </span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: row.color }}>
                      {row.xp} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* copy */}
          <div className="order-1 lg:order-2">
            <div
              aria-hidden="true"
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[22px] mb-5"
              style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.2)" }}
            >
              🧠
            </div>
            <p className="font-mono text-[11px] tracking-[2px] uppercase mb-3" style={{ color: "#fbbf24" }}>
              Brain Quiz
            </p>
            <h2
              className="font-extrabold leading-[1.06] mb-5"
              style={{ fontSize: "clamp(26px,3.5vw,42px)", fontFamily: "'Syne', system-ui, sans-serif" }}
            >
              Challenge Your Mind
              <br />
              Every Single Day
            </h2>
            <p className="font-mono text-[14px] text-[#9898b0] leading-[1.88] mb-8">
              Hour Bit&apos;s Brain Quiz system lets you test your knowledge across categories
              and levels. Earn XP for correct answers, lose XP for hints, and compete on a
              live leaderboard. It&apos;s daily mental training with real rewards built in.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "Multiple categories & sub-categories",
                "Progressive level system",
                "XP earned for every correct answer",
                "Hint system with XP cost",
                "Live leaderboard ranking",
                "Per-question detailed result breakdown",
              ].map((item) => (
                <p key={item} className="font-mono text-[12px] flex items-center gap-2" style={{ color: "#fbbf24" }}>
                  <span aria-hidden="true">✓</span>{item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          DIARY · TYPING · EXPENSES  (3 col mini-showcase)
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Personal Diary, Typing Speed Test, and Expense Tracker features"
        className="px-6 py-24 bg-[#0d0d14]"
      >
        <div className="max-w-[1100px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
            More Tools
          </p>
          <h2
            className="font-extrabold leading-[1.05] mb-14"
            style={{ fontSize: "clamp(26px,3.5vw,42px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            Three More Powerful Tools,
            <br />
            All Completely Free
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Diary */}
            <article
              id="diary"
              className="shimmer-card bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 hover:border-[#f472b6]/30 hover:-translate-y-1 transition-all duration-300"
              aria-label="Personal Diary — private daily journaling"
            >
              <div
                aria-hidden="true"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: "rgba(244,114,182,0.10)", border: "1px solid rgba(244,114,182,0.2)" }}
              >
                📓
              </div>
              <h3
                className="font-semibold text-[16px] text-[#e8e8f0] mb-2"
                style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
              >
                Personal Diary
              </h3>
              <p className="font-mono text-[12px] mb-5" style={{ color: "#f472b6" }}>
                Your private daily journal
              </p>
              <p className="font-mono text-[13px] text-[#9898b0] leading-[1.75] mb-5">
                Write dated journal entries, search your entire history instantly, set up diary
                reminders, and configure diary preferences — all secured to your account.
              </p>
              <div className="bg-[#0a0a0f] rounded-xl p-4">
                <p className="font-mono text-[10px] text-[#5a5a72] mb-2.5 tracking-wider uppercase">
                  Today&apos;s Entry
                </p>
                <p className="font-mono text-[12px] text-[#9898b0] leading-[1.6] italic">
                  &ldquo;Had a productive morning session. Completed the feature review and submitted
                  the weekly report before lunch...&rdquo;
                </p>
              </div>
            </article>

            {/* Typing Test */}
            <article
              id="typing-test"
              className="shimmer-card bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 hover:border-[#22d3a0]/30 hover:-translate-y-1 transition-all duration-300"
              aria-label="Typing Speed Test — measure WPM and track improvement"
            >
              <div
                aria-hidden="true"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.2)" }}
              >
                ⌨️
              </div>
              <h3
                className="font-semibold text-[16px] text-[#e8e8f0] mb-2"
                style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
              >
                Typing Speed Test
              </h3>
              <p className="font-mono text-[12px] mb-5" style={{ color: "#22d3a0" }}>
                Measure WPM. Track improvement.
              </p>
              <p className="font-mono text-[13px] text-[#9898b0] leading-[1.75] mb-5">
                Take timed typing tests, track WPM and accuracy across all sessions, view
                your history, and watch your speed improve over time with analytics.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0f] rounded-xl p-3">
                  <p className="font-mono text-[10px] text-[#5a5a72] mb-1">Best WPM</p>
                  <p
                    className="font-bold text-[20px] text-[#22d3a0]"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    84
                  </p>
                </div>
                <div className="bg-[#0a0a0f] rounded-xl p-3">
                  <p className="font-mono text-[10px] text-[#5a5a72] mb-1">Accuracy</p>
                  <p
                    className="font-bold text-[20px] text-[#a78bfa]"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    97%
                  </p>
                </div>
              </div>
            </article>

            {/* Expense Tracker */}
            <article
              id="expenses"
              className="shimmer-card bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 hover:border-[#34d399]/30 hover:-translate-y-1 transition-all duration-300"
              aria-label="Expense Tracker — manage your wallet and daily spending"
            >
              <div
                aria-hidden="true"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5"
                style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                💰
              </div>
              <h3
                className="font-semibold text-[16px] text-[#e8e8f0] mb-2"
                style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
              >
                Expense Tracker
              </h3>
              <p className="font-mono text-[12px] mb-5" style={{ color: "#34d399" }}>
                Wallet · Spending · Analysis
              </p>
              <p className="font-mono text-[13px] text-[#9898b0] leading-[1.75] mb-5">
                Maintain a personal digital wallet. Add money, log categorized expenses,
                delete batches of transactions, and get clear spending analysis with charts.
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Food & Dining",   pct: 42, color: "#fbbf24" },
                  { label: "Transport",        pct: 25, color: "#60a5fa" },
                  { label: "Shopping",         pct: 21, color: "#f472b6" },
                  { label: "Other",            pct: 12, color: "#9898b0" },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between font-mono text-[10px] text-[#5a5a72] mb-1">
                      <span>{label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        aria-label="How to get started with Hour Bit in 3 steps"
        className="px-6 py-24"
        itemScope
        itemType="https://schema.org/HowTo"
      >
        <div className="max-w-[800px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
            Getting Started
          </p>
          <h2
            className="font-extrabold leading-[1.05] mb-4"
            style={{ fontSize: "clamp(26px,3.5vw,42px)", fontFamily: "'Syne', system-ui, sans-serif" }}
            itemProp="name"
          >
            Up & Running in 3 Steps
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.82] mb-14" itemProp="description">
            No training required. No complex setup. Start using all 5 productivity tools
            in under 60 seconds.
          </p>

          <ol className="relative list-none" style={{ paddingLeft: 0 }}>
            <div
              aria-hidden="true"
              className="absolute left-[23px] top-6 bottom-6 w-px"
              style={{
                background:
                  "linear-gradient(to bottom,#7c6ef3,rgba(124,110,243,0.15),transparent)",
              }}
            />
            {STEPS.map((s, i) => (
              <li
                key={i}
                className="flex gap-6 py-7"
                itemScope
                itemType="https://schema.org/HowToStep"
              >
                <div
                  aria-hidden="true"
                  className="shrink-0 w-12 h-12 rounded-full bg-[#111118] border border-[#2a2a35] flex items-center justify-center relative z-10"
                >
                  <span
                    className="font-bold text-[13px] text-[#a78bfa]"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    {s.num}
                  </span>
                </div>
                <div className="pt-2.5">
                  <h3
                    className="font-semibold text-[16px] text-[#e8e8f0] mb-2"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                    itemProp="name"
                  >
                    {s.title}
                  </h3>
                  <p className="font-mono text-[13px] text-[#9898b0] leading-[1.75]" itemProp="text">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          WHY HOUR BIT — COMPARISON TABLE
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Hour Bit vs other productivity apps comparison"
        className="px-6 py-24 bg-[#0d0d14]"
      >
        <div className="max-w-[800px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3 text-center">
            Comparison
          </p>
          <h2
            className="font-extrabold leading-[1.05] mb-4 text-center"
            style={{ fontSize: "clamp(24px,3.5vw,40px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            Hour Bit vs Other Apps
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.82] mb-12 text-center">
            Toggl tracks projects. Clockify bills clients. Notion stores notes.{" "}
            <em className="text-[#e8e8f0] not-italic font-semibold">
              Hour Bit does all of it — built specifically for employees.
            </em>
          </p>

          <div className="overflow-x-auto rounded-2xl border border-[#1e1e2e]">
            <table
              className="w-full"
              role="table"
              aria-label="Feature comparison between Hour Bit and other productivity apps"
            >
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#111118]">
                  <th
                    className="font-semibold text-[13px] text-[#e8e8f0] text-left px-5 py-4"
                    scope="col"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    Feature
                  </th>
                  <th
                    className="font-semibold text-[13px] text-center px-5 py-4"
                    scope="col"
                    style={{ color: "#7c6ef3", fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    Hour Bit
                  </th>
                  <th
                    className="font-semibold text-[13px] text-[#5a5a72] text-center px-5 py-4"
                    scope="col"
                    style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  >
                    Others
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(({ label, ours, theirs }, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#1e1e2e] last:border-0 ${i % 2 === 0 ? "bg-[#0a0a0f]" : "bg-[#111118]"}`}
                  >
                    <td className="font-mono text-[13px] text-[#9898b0] px-5 py-3.5">{label}</td>
                    <td className="text-center px-5 py-3.5">
                      <span className="font-mono text-[13px] font-semibold text-[#22d3a0]">
                        {ours ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td className="text-center px-5 py-3.5">
                      <span
                        className={`font-mono text-[13px] ${
                          theirs === true
                            ? "text-[#9898b0]"
                            : theirs === "partial"
                            ? "text-[#fbbf24]"
                            : "text-[#3a3a55]"
                        }`}
                      >
                        {theirs === true
                          ? "✓ Some"
                          : theirs === "partial"
                          ? "~ Partial"
                          : "✗ No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FAQ — AEO optimised
          Targets Google "People Also Ask" + AI assistants
      ══════════════════════════════════════════════════════ */}
      <section
        id="faq"
        aria-label="Frequently asked questions about Hour Bit"
        className="px-6 py-24"
        itemScope
        itemType="https://schema.org/FAQPage"
      >
        <div className="max-w-[800px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
            FAQ
          </p>
          <h2
            className="font-extrabold leading-[1.05] mb-4"
            style={{ fontSize: "clamp(26px,3.5vw,40px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            Frequently Asked Questions
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.82] mb-14">
            Everything you need to know about Hour Bit&apos;s five free productivity tools.
          </p>

          <div className="flex flex-col gap-4">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#111118] border border-[#1e1e2e]"
                itemScope
                itemType="https://schema.org/Question"
              >
                <h3
                  className="font-semibold text-[15px] text-[#e8e8f0] mb-3"
                  style={{ fontFamily: "'Syne', system-ui, sans-serif" }}
                  itemProp="name"
                >
                  {faq.q}
                </h3>
                <div
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                >
                  <p className="font-mono text-[13px] text-[#9898b0] leading-[1.78]" itemProp="text">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA BANNER
      ══════════════════════════════════════════════════════ */}
      <section
        aria-label="Sign up free for Hour Bit — 5 productivity tools in 1 account"
        className="px-6 py-28 bg-[#0d0d14] text-center relative overflow-hidden"
      >
        {/* glow */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[300px] rounded-full pointer-events-none"
          style={{ background: "rgba(124,110,243,0.08)", filter: "blur(100px)" }}
        />

        <div className="relative max-w-[640px] mx-auto">
          {/* tool emoji row */}
          <div aria-hidden="true" className="flex items-center justify-center gap-4 text-[28px] mb-8">
            {["⏱️", "🧠", "📓", "⌨️", "💰"].map((e, i) => (
              <span
                key={i}
                className="animate-float"
                style={{ animationDelay: `${i * 0.3}s`, animationDuration: `${4 + i * 0.4}s` }}
              >
                {e}
              </span>
            ))}
          </div>

          <h2
            className="font-extrabold leading-[1.1] mb-5"
            style={{ fontSize: "clamp(26px,4.5vw,46px)", fontFamily: "'Syne', system-ui, sans-serif" }}
          >
            Five Tools.
            <br />
            <span className="gradient-text">One Free Account.</span>
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.85] mb-10">
            Stop using five different apps with five different subscriptions. Hour Bit gives
            you a complete employee productivity suite — work hours tracker, brain quiz, diary,
            typing test, and expense manager — all free, all in one place.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 font-mono text-[14px] font-semibold text-white px-8 py-4 rounded-xl transition-all no-underline"
              style={{
                background: "linear-gradient(135deg,#7c6ef3,#6c5ee3)",
                boxShadow:  "0 0 36px rgba(124,110,243,0.4)",
              }}
              aria-label="Create your free Hour Bit account — all 5 tools, no credit card"
            >
              Create Free Account →
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 font-mono text-[14px] text-[#9898b0] hover:text-[#e8e8f0] px-8 py-4 rounded-xl border border-[#2a2a35] hover:border-[#7c6ef3]/40 hover:bg-[#7c6ef3]/08 transition-all no-underline"
              aria-label="Sign in to your existing Hour Bit account"
            >
              Already have an account?
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              "✓  Free forever",
              "✓  No credit card",
              "✓  All 5 tools included",
              "✓  Setup in 60 seconds",
            ].map((item) => (
              <span key={item} className="font-mono text-[11px] text-[#5a5a72]">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}