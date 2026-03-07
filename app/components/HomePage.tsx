// app/components/HomePage.tsx

import Link from "next/link";

/* ─── types ─────────────────────────────────────────────────── */
type Color = "purple" | "green" | "amber";
interface Feature { emoji: string; color: Color; title: string; desc: string; }
interface Step    { num: string; title: string; desc: string; }
interface Why     { emoji: string; title: string; desc: string; }
interface FAQ     { q: string; a: string; }

/* ─── data ───────────────────────────────────────────────────── */
const FEATURES: Feature[] = [
  {
    emoji: "⏱️", color: "purple",
    title: "Real-Time Work Hours Timer",
    desc:  "Log your clock-in once and Hour Bit tracks productive hours, break time, and remaining work hours live — updated every second with no manual input.",
  },
  {
    emoji: "🎯", color: "green",
    title: "Smart Leave Time Prediction",
    desc:  "Get an exact predicted leave time based on your entry, breaks, and target hours. Know precisely when you've completed 8.5 productive hours — no guesswork.",
  },
  {
    emoji: "📅", color: "amber",
    title: "Past Attendance Record Editing",
    desc:  "Forgot to log yesterday? Easily add or edit any past date's work log — entry time, breaks, and exit — without losing historical attendance data.",
  },
  {
    emoji: "📊", color: "purple",
    title: "Productivity Analytics & Reports",
    desc:  "Weekly and monthly charts reveal your productivity patterns — best days, underperforming days, break distribution, and average daily hours. Export as CSV or PDF.",
  },
  {
    emoji: "🏖️", color: "green",
    title: "Holiday & Leave Management",
    desc:  "Mark public holidays and personal leave days. Hour Bit auto-excludes them from weekly and monthly productivity averages for accurate reporting.",
  },
  {
    emoji: "🔒", color: "amber",
    title: "Enterprise-Grade Security",
    desc:  "JWT authentication, bcrypt password hashing, email OTP verification, per-device session management, and rate limiting protect every account.",
  },
];

const STEPS: Step[] = [
  {
    num: "01",
    title: "Clock In — Log Your Arrival Time",
    desc:  "Hit 'Mark Entry' when you arrive. Hour Bit starts your real-time work hours counter immediately, tracking every productive minute from the first second.",
  },
  {
    num: "02",
    title: "Log Breaks — Lunch, Tea, or Custom",
    desc:  "Add breaks as they happen. Productive time auto-deducts break duration in real-time, keeping your leave prediction accurate throughout the day.",
  },
  {
    num: "03",
    title: "Leave When Hour Bit Says Go",
    desc:  "Your predicted exit time updates live. The moment you hit your 8.5-hour productive target, Hour Bit shows a celebration — your day is done.",
  },
];

const WHY: Why[] = [
  {
    emoji: "⏰",
    title: "Stop Manually Calculating Work Hours",
    desc:  "Employees with flexible timing waste minutes every day asking — have I done 8.5 hours? Hour Bit eliminates this completely with an automatic live counter.",
  },
  {
    emoji: "📋",
    title: "Fix Missed Attendance Logs Anytime",
    desc:  "Forgot Monday? No problem. Go date-wise and fill in any past day's clock-in, breaks, and exit time. Your attendance history stays complete and accurate.",
  },
  {
    emoji: "📈",
    title: "Understand Your Work Patterns",
    desc:  "Discover which days you consistently over-work or under-deliver. Identify break habits dragging productivity. Make data-driven decisions about your schedule.",
  },
];

const STATS = [
  { num: "8.5h",    label: "Daily Target Hours"  },
  { num: "Live",    label: "Real-Time Counter"   },
  { num: "Auto",    label: "Leave Prediction"    },
  { num: "CSV/PDF", label: "Export Reports"      },
];

/* Fix #10 — blog link data for internal linking */
const BLOG_LINKS = [
  { href: "/blog/how-to-calculate-work-hours",      label: "How to Calculate Work Hours"         },
  { href: "/blog/best-time-tracking-tools",         label: "Best Time Tracking Tools 2025"       },
  { href: "/blog/employee-time-tracking-guide",     label: "Employee Time Tracking Guide"        },
  { href: "/blog/how-many-hours-is-full-time-work", label: "How Many Hours Is Full-Time Work?"   },
];

const FAQS: FAQ[] = [
  {
    q: "Is Hour Bit completely free?",
    a: "Yes — Hour Bit is 100% free. No credit card required, no hidden fees. Create your account and start tracking work hours in under a minute.",
  },
  {
    /* Fix #6 — internal keyword link woven into answer */
    q: "How does the leave time prediction work?",
    a: "Hour Bit's real-time work hours tracker takes your clock-in time, deducts all logged break durations from the running total, and calculates the exact time you will complete your target work hours (default: 8.5h). The predicted leave time updates live every second.",
  },
  {
    /* Fix #5 — "calculate work hours" keyword in answer */
    q: "How do I calculate work hours automatically?",
    a: "Simply clock in when you arrive and log breaks as they happen. Hour Bit automatically calculates your productive work hours in real time — no spreadsheets, no manual math, no phone timers.",
  },
  {
    q: "Can I use Hour Bit for flexible work hours?",
    a: "Absolutely. Hour Bit is purpose-built for employees on flexible timing policies — no fixed 9-to-5 required. You set your daily work hours target and the time tracking tool handles the rest.",
  },
  {
    q: "What if I forget to log a day?",
    a: "Use the 'Go Date Wise' feature to retroactively add or edit any past date's work log — entry time, breaks, exit time — as if you had tracked it live.",
  },
];

const ICON_BG: Record<Color, string> = {
  purple: "bg-[#7c6ef3]/10",
  green:  "bg-[#22d3a0]/10",
  amber:  "bg-[#fbbf24]/10",
};

/* ─── component ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <main
      className="bg-[#0a0a0f] text-[#e8e8f0] overflow-x-hidden"
      itemScope
      itemType="https://schema.org/WebPage"
    >

      {/* ══════════════════════════════════════════════════════════
          HERO
          Fix #4 — H1 rewritten to "Free Work Hours Tracker for Employees"
          Fix #9 — "time tracking tool" added to subtitle
      ══════════════════════════════════════════════════════════ */}
      <section
        aria-label="Hour Bit — Free Work Hours Tracker for Employees"
        className="relative w-full flex flex-col items-center justify-center text-center px-6 pb-24"
        style={{ minHeight: "calc(100vh - 64px)", paddingTop: "80px" }}
      >
        {/* grid overlay */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            "linear-gradient(rgba(30,30,46,0.55) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(30,30,46,0.55) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 0%,black 20%,transparent 80%)",
          maskImage:       "radial-gradient(ellipse 80% 70% at 50% 0%,black 20%,transparent 80%)",
        }} />

        {/* glow */}
        <div aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[420px] rounded-full pointer-events-none"
          style={{ background: "rgba(124,110,243,0.12)", filter: "blur(120px)" }}
        />

        {/* badge */}
        <div className="relative z-10 inline-flex items-center gap-2 bg-[#111118] border border-[#2a2a35] rounded-full px-4 py-2 mb-8 animate-fade-up">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse-glow block" />
          <span className="font-mono text-[12px] text-[#9898b0]">
            Free time tracking tool for flexible schedules
          </span>
        </div>

        {/* Fix #4 — H1: "Free Work Hours Tracker for Employees & Leave Time Calculator" */}
        <h1
          className="relative z-10 font-syne font-extrabold leading-[0.92] tracking-tight mb-6 animate-fade-up delay-1"
          style={{ fontSize: "clamp(46px, 7.5vw, 88px)" }}
          itemProp="headline"
        >
          Free Work Hours
          <br />
          <span className="font-serif italic gradient-text">Tracker for Employees</span>
          <br />
          &amp; Leave Time Calculator
        </h1>

        {/* Fix #9 — "time tracking tool built for employees" added to subtitle */}
        <p
          className="relative z-10 font-mono text-[15px] text-[#9898b0] leading-[1.85] mb-10 animate-fade-up delay-2"
          style={{ maxWidth: 520 }}
          itemProp="description"
        >
          Clock in, log breaks, and let Hour Bit automatically track your productive
          work hours using a simple{" "}
          <strong className="text-[#e8e8f0] font-normal">time tracking tool built for employees</strong>
          {" "}— predicting your exact leave time throughout the day.
          No spreadsheets. No manual math.
        </p>

        {/* CTA */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-20 animate-fade-up delay-3">
          <Link
            href="/auth/register"
            className="font-mono text-[14px] font-medium text-white px-7 py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] hover:-translate-y-0.5 shadow-[0_0_28px_rgba(124,110,243,0.4)] hover:shadow-[0_0_42px_rgba(124,110,243,0.55)] transition-all no-underline"
            aria-label="Create free account on Hour Bit"
          >
            Start Tracking Free →
          </Link>
          <Link
            href="/auth/login"
            className="font-mono text-[14px] text-[#9898b0] hover:text-[#e8e8f0] px-7 py-3.5 rounded-xl border border-[#2a2a35] hover:border-[#7c6ef3]/40 hover:bg-[#7c6ef3]/10 transition-all no-underline"
            aria-label="Sign in to your Hour Bit account"
          >
            Sign In
          </Link>
        </div>

        {/* stats bar */}
        <div
          className="relative z-10 w-full max-w-[700px] grid grid-cols-4 bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden animate-fade-up delay-4"
          role="list"
          aria-label="Hour Bit key stats"
        >
          {STATS.map((s, i) => (
            <div key={i} role="listitem"
              className={`flex flex-col items-center justify-center py-5 px-3 ${i < 3 ? "border-r border-[#1e1e2e]" : ""}`}>
              <span className="font-syne font-bold text-xl text-[#a78bfa] leading-none mb-1.5">{s.num}</span>
              <span className="font-mono text-[11px] text-[#5a5a72]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SOCIAL PROOF
      ══════════════════════════════════════════════════════════ */}
      <section aria-label="Social proof" className="px-6 py-10 border-y border-[#1e1e2e] bg-[#0d0d14]">
        <div className="max-w-[900px] mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
          <p className="font-mono text-[12px] text-[#5a5a72] tracking-widest uppercase">
            Trusted by employees at
          </p>
          {["Startups", "IT Companies", "Remote Teams", "BPO Firms", "Freelancers"].map((label) => (
            <span key={label} className="font-syne font-semibold text-[14px] text-[#3a3a55]">
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════ */}
      <section
        id="features"
        aria-label="Hour Bit employee time tracking features"
        className="px-6 py-24 max-w-[1100px] mx-auto"
      >
        <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">Features</p>
        <h2 className="font-syne font-bold leading-[1.1] mb-5" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
          Employee Time Tracking Features
          <br />
          Built for Flexible Schedules
        </h2>
        <p className="font-mono text-[14px] text-[#9898b0] leading-[1.8] mb-14" style={{ maxWidth: 560 }}>
          Unlike generic time tracking apps, Hour Bit is designed specifically for employees
          who don&apos;t work fixed 9-to-5 hours — giving you real-time visibility into your
          productive work hours and predicted leave time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <article key={i}
              className="p-6 rounded-2xl bg-[#111118] border border-[#1e1e2e] hover:border-[#7c6ef3]/40 hover:-translate-y-1 transition-all duration-300 cursor-default">
              <div aria-hidden="true"
                className={`w-12 h-12 rounded-xl ${ICON_BG[f.color]} flex items-center justify-center text-2xl mb-5`}>
                {f.emoji}
              </div>
              <h3 className="font-syne font-semibold text-[15px] text-[#e8e8f0] mb-2">{f.title}</h3>
              <p className="font-mono text-[13px] text-[#9898b0] leading-[1.72]">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          Fix #5 — NEW SECTION: "Calculate Work Hours Automatically"
          Targets: calculate work hours, work hours calculator,
                   track work hours, daily work hours calculator
      ══════════════════════════════════════════════════════════ */}
      <section
        aria-label="Calculate work hours automatically with Hour Bit"
        className="px-6 py-20 bg-[#0d0d14]"
      >
        <div className="max-w-[900px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">
              Work Hours Calculator
            </p>
            <h2 className="font-syne font-bold leading-[1.1] mb-5" style={{ fontSize: "clamp(26px,3.5vw,40px)" }}>
              Calculate Work Hours
              <br />
              Automatically — Zero Effort
            </h2>
            <p className="font-mono text-[14px] text-[#9898b0] leading-[1.85] mb-6">
              Many employees manually calculate their work hours using spreadsheets or phone
              timers. Hour Bit eliminates this problem with a{" "}
              <strong className="text-[#e8e8f0] font-normal">real-time work hours calculator</strong>{" "}
              that tracks productive time, deducts breaks automatically, and predicts the exact
              time you can leave work.
            </p>
            <p className="font-mono text-[14px] text-[#9898b0] leading-[1.85] mb-8">
              Whether you work 8 hours, 8.5 hours, or a custom daily target — Hour Bit&apos;s
              daily work hours calculator adapts to your schedule. No formulas.
              No timers. Just clock in and go.
            </p>
            <div className="flex flex-col gap-3">
              {[
                "✓  Auto-calculates productive hours from clock-in",
                "✓  Deducts break time in real time",
                "✓  Updates predicted leave time every second",
                "✓  Supports custom daily work hour targets",
              ].map((item) => (
                <p key={item} className="font-mono text-[13px] text-[#22d3a0]">{item}</p>
              ))}
            </div>
          </div>

          {/* mini calculator preview card */}
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-4 rounded-3xl blur-2xl"
              style={{ background: "rgba(124,110,243,0.06)" }} />
            <div
              className="relative bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6"
              aria-label="Work hours calculator preview showing automatic calculation"
              role="img"
            >
              <p className="font-mono text-[11px] text-[#5a5a72] tracking-widest uppercase mb-5">
                Daily Work Hours Calculator
              </p>

              {[
                { label: "Clock-in Time",          value: "09:30 AM",  color: "#9898b0" },
                { label: "Break Deducted",          value: "- 00:50",  color: "#f87171" },
                { label: "Productive Hours So Far", value: "05:42:17", color: "#a78bfa" },
                { label: "Remaining to Target",     value: "02:47:43", color: "#fbbf24" },
                { label: "Predicted Leave at",      value: "06:29 PM", color: "#22d3a0" },
              ].map((row, i) => (
                <div key={i}
                  className={`flex items-center justify-between py-3 ${i < 4 ? "border-b border-[#1e1e2e]" : ""}`}>
                  <span className="font-mono text-[12px] text-[#5a5a72]">{row.label}</span>
                  <span className="font-syne font-semibold text-[15px]" style={{ color: row.color }}>
                    {row.value}
                  </span>
                </div>
              ))}

              <div className="mt-5 flex items-center gap-2">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse-glow block" />
                <span className="font-mono text-[11px] text-[#22d3a0]">
                  Calculating live — auto-updates every second
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        aria-label="How to track work hours with Hour Bit"
        className="px-6 py-24 max-w-[1100px] mx-auto"
      >
        <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">How it Works</p>
        <h2 className="font-syne font-bold leading-[1.1] mb-5" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
          How to Track Work Hours
          <br />
          with Hour Bit — 3 Simple Steps
        </h2>
        <p className="font-mono text-[14px] text-[#9898b0] leading-[1.8] mb-14" style={{ maxWidth: 520 }}>
          Start tracking your attendance and productive work hours in under 60 seconds.
          No training required. No complex setup.
        </p>

        <div className="max-w-[700px]">
          <ol className="relative list-none">
            <div aria-hidden="true" className="absolute left-[23px] top-6 bottom-6 w-px"
              style={{ background: "linear-gradient(to bottom,#7c6ef3,rgba(124,110,243,0.15),transparent)" }} />

            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-6 py-6"
                itemScope itemType="https://schema.org/HowToStep">
                <div aria-hidden="true"
                  className="shrink-0 w-12 h-12 rounded-full bg-[#111118] border border-[#2a2a35] flex items-center justify-center relative z-10">
                  <span className="font-syne font-bold text-[13px] text-[#a78bfa]">{s.num}</span>
                </div>
                <div className="pt-2.5">
                  <h3 className="font-syne font-semibold text-[16px] text-[#e8e8f0] mb-2" itemProp="name">
                    {s.title}
                  </h3>
                  <p className="font-mono text-[13px] text-[#9898b0] leading-[1.72]" itemProp="text">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          WHY HOURBIT
      ══════════════════════════════════════════════════════════ */}
      <section
        id="why-hourbit"
        aria-label="Why choose Hour Bit over other time tracking apps"
        className="px-6 py-24 bg-[#0d0d14]"
      >
        <div className="max-w-[1100px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">Why Hour Bit</p>
          <h2 className="font-syne font-bold leading-[1.1] mb-5" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
            The Best Time Tracking App
            <br />
            for Flexible Work Schedules
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.8] mb-14" style={{ maxWidth: 560 }}>
            Toggl, Clockify, and Jibble are great for project billing.
            Hour Bit is different — it&apos;s built for individual employees
            who need to know one thing:{" "}
            <em className="text-[#e8e8f0] not-italic font-semibold">can I leave yet?</em>
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* pain points */}
            <div className="flex flex-col gap-4">
              {WHY.map((item, i) => (
                <div key={i}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-[#111118] border border-[#1e1e2e] hover:border-[#7c6ef3]/30 transition-all">
                  <div aria-hidden="true"
                    className="shrink-0 w-10 h-10 rounded-xl bg-[#7c6ef3]/10 flex items-center justify-center text-xl mt-0.5">
                    {item.emoji}
                  </div>
                  <div>
                    <p className="font-syne font-semibold text-[14px] text-[#e8e8f0] mb-1.5">{item.title}</p>
                    <p className="font-mono text-[13px] text-[#9898b0] leading-[1.68]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fix #7 — improved aria-label on mock card */}
            <div className="relative animate-float"
              aria-label="Work hours tracker dashboard showing productive hours and predicted leave time"
              role="img">
              <div aria-hidden="true" className="absolute -inset-4 rounded-3xl blur-2xl"
                style={{ background: "rgba(124,110,243,0.07)" }} />
              <div className="relative bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <div aria-hidden="true" className="flex items-center gap-1.5 mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22d3a0]" />
                  <span className="font-mono text-[11px] text-[#5a5a72] ml-2">
                    hourbit — today&apos;s work session
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#5a5a72] tracking-widest uppercase mb-2.5">
                  Productive Hours · Target 8.5h
                </p>
                <p className="font-syne font-bold text-[#a78bfa] leading-none tracking-tight mb-5"
                  style={{ fontSize: 52 }}>
                  05:42:17
                </p>
                <div className="mb-5">
                  <div className="flex justify-between font-mono text-[11px] text-[#5a5a72] mb-2">
                    <span>Daily work hours progress</span>
                    <span className="text-[#22d3a0]">67.3% complete</span>
                  </div>
                  <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: "67.3%",
                      background: "linear-gradient(to right,#7c6ef3,#a78bfa)"
                    }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-[#0a0a0f] rounded-xl p-3.5">
                    <p className="font-mono text-[10px] text-[#5a5a72] mb-1.5">Break Time Taken</p>
                    <p className="font-syne font-semibold text-[17px] text-[#fbbf24]">00:50:00</p>
                  </div>
                  <div className="bg-[#0a0a0f] rounded-xl p-3.5">
                    <p className="font-mono text-[10px] text-[#5a5a72] mb-1.5">Predicted Leave at</p>
                    <p className="font-syne font-semibold text-[17px] text-[#22d3a0]">06:29 PM</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse-glow block" />
                  <span className="font-mono text-[12px] text-[#22d3a0]">
                    Live tracking — 2h 47m of work hours remaining
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          COMPARISON TABLE
      ══════════════════════════════════════════════════════════ */}
      <section aria-label="Hour Bit vs other time tracking apps comparison" className="px-6 py-20 max-w-[1100px] mx-auto">
        <div className="max-w-[800px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3 text-center">
            Comparison
          </p>
          <h2 className="font-syne font-bold leading-[1.1] mb-14 text-center"
            style={{ fontSize: "clamp(24px,3.5vw,38px)" }}>
            Hour Bit vs Generic Time Tracking Apps
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-[#1e1e2e]">
            <table className="w-full" role="table" aria-label="Feature comparison between Hour Bit and other time tracking apps">
              <thead>
                <tr className="border-b border-[#1e1e2e] bg-[#111118]">
                  <th className="font-syne font-semibold text-[13px] text-[#e8e8f0] text-left px-5 py-4" scope="col">Feature</th>
                  <th className="font-syne font-semibold text-[13px] text-[#7c6ef3] text-center px-5 py-4" scope="col">Hour Bit</th>
                  <th className="font-syne font-semibold text-[13px] text-[#5a5a72] text-center px-5 py-4" scope="col">Others</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Built for flexible timing employees",    true,  false],
                  ["Real-time leave time prediction",        true,  false],
                  ["Auto work hours calculator",             true,  false],
                  ["Personal daily work hours target",       true,  false],
                  ["Smart break time deduction",             true,  true ],
                  ["Past record editing (any date)",         true,  true ],
                  ["Holiday auto-exclusion from stats",      true,  false],
                  ["Productivity analytics & charts",        true,  true ],
                  ["100% free — no credit card",             true,  false],
                ].map(([label, ours, theirs], i) => (
                  <tr key={i}
                    className={`border-b border-[#1e1e2e] last:border-0 ${i % 2 === 0 ? "bg-[#0a0a0f]" : "bg-[#111118]"}`}>
                    <td className="font-mono text-[13px] text-[#9898b0] px-5 py-3.5">{label as string}</td>
                    <td className="text-center px-5 py-3.5">
                      <span className={`font-mono text-[13px] font-semibold ${ours ? "text-[#22d3a0]" : "text-[#3a3a55]"}`}>
                        {ours ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td className="text-center px-5 py-3.5">
                      <span className={`font-mono text-[13px] ${theirs ? "text-[#9898b0]" : "text-[#3a3a55]"}`}>
                        {theirs ? "✓ Some" : "✗ No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FAQ — Fix #6: internal keyword links woven into answers
          Targets Google "People Also Ask"
      ══════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        aria-label="Frequently asked questions about Hour Bit time tracker"
        className="px-6 py-24 bg-[#0d0d14]"
        itemScope itemType="https://schema.org/FAQPage"
      >
        <div className="max-w-[800px] mx-auto">
          <p className="font-mono text-[11px] text-[#7c6ef3] tracking-[2px] uppercase mb-3">FAQ</p>
          <h2 className="font-syne font-bold leading-[1.1] mb-14" style={{ fontSize: "clamp(26px,3.5vw,38px)" }}>
            Frequently Asked Questions
          </h2>

          <div className="flex flex-col gap-4">
            {FAQS.map((faq, i) => (
              <div key={i}
                className="p-6 rounded-2xl bg-[#111118] border border-[#1e1e2e]"
                itemScope itemType="https://schema.org/Question">
                <h3 className="font-syne font-semibold text-[15px] text-[#e8e8f0] mb-3" itemProp="name">
                  {faq.q}
                </h3>
                <div itemScope itemType="https://schema.org/Answer" itemProp="acceptedAnswer">
                  <p className="font-mono text-[13px] text-[#9898b0] leading-[1.75]" itemProp="text">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          Fix #10 — BLOG LINKS SECTION
          Internal SEO links pointing to future blog pages
          These rank for long-tail keywords and drive organic traffic
      ══════════════════════════════════════════════════════════ */}
      

      {/* ══════════════════════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════════════════════ */}
      <section
        aria-label="Sign up for Hour Bit free work hours tracker"
        className="px-6 py-24 bg-[#0d0d14] text-center"
      >
        <div className="max-w-[600px] mx-auto">
          <div aria-hidden="true"
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#7c6ef3]/10 border border-[#7c6ef3]/25 text-[28px] mb-7">
            ⏱️
          </div>
          <h2 className="font-syne font-bold leading-[1.15] mb-4" style={{ fontSize: "clamp(24px,4vw,40px)" }}>
            Track Work Hours Free.
            <br />
            Know Exactly When to Leave.
          </h2>
          <p className="font-mono text-[14px] text-[#9898b0] leading-[1.82] mb-9">
            Join employees who never wonder &quot;have I done 8.5 hours?&quot; again.
            Free attendance tracking, real-time leave prediction, and productivity
            analytics — all in one time tracking tool. No credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 font-mono text-[14px] font-medium text-white px-8 py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] hover:-translate-y-0.5 shadow-[0_0_30px_rgba(124,110,243,0.4)] hover:shadow-[0_0_44px_rgba(124,110,243,0.55)] transition-all no-underline"
              aria-label="Create free Hour Bit account — no credit card required"
            >
              Create Free Account →
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 font-mono text-[14px] text-[#9898b0] hover:text-[#e8e8f0] px-8 py-3.5 rounded-xl border border-[#2a2a35] hover:border-[#7c6ef3]/40 hover:bg-[#7c6ef3]/10 transition-all no-underline"
            >
              Already have an account?
            </Link>
          </div>
          <p className="font-mono text-[12px] text-[#5a5a72] mt-5">
            Free forever · No credit card · Setup in 60 seconds
          </p>
        </div>
      </section>

    </main>
  );
}