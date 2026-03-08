// app/dashboard/layout.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  CalendarDays,
  Palmtree,
  BarChart2,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  Github,
  Linkedin,
  Globe,
  X,
} from "lucide-react";
import Logo from "../components/Logo";

// ── Nav items ──────────────────────────────────────────────────
// Dashboard root now redirects to /dashboard/today, so
// "Today's Track" is effectively the homepage of the dashboard.
const NAV_ITEMS = [
  { label: "Today's Track", href: "/dashboard/today",    icon: Clock        },
  { label: "Go Date Wise",  href: "/dashboard/date-wise",icon: CalendarDays },
  { label: "Mark Holiday",  href: "/dashboard/holiday",  icon: Palmtree     },
  { label: "See Analysis",  href: "/dashboard/analysis", icon: BarChart2    },
  { label: "Profile",       href: "/dashboard/profile",  icon: User         },
];

// ── CSS variable themes ────────────────────────────────────────
const DARK_THEME = `
  :root {
    --bg:       #0a0a0f;
    --surface:  #111118;
    --surface2: #0d0d14;
    --border:   #1e1e2e;
    --border2:  #2a2a35;
    --text:     #e8e8f0;
    --text2:    #9898b0;
    --text3:    #5a5a72;
    --text4:    #3a3a55;
    --accent:   #7c6ef3;
    --accent2:  #a78bfa;
    --green:    #22d3a0;
    --amber:    #fbbf24;
    --danger:   #f87171;
  }
`;

const LIGHT_THEME = `
  :root {
    --bg:       #f4f4f8;
    --surface:  #ffffff;
    --surface2: #f0f0f6;
    --border:   #e0e0ec;
    --border2:  #d0d0e0;
    --text:     #1a1a2e;
    --text2:    #4a4a6a;
    --text3:    #9090aa;
    --text4:    #c0c0d0;
    --accent:   #6c5ce7;
    --accent2:  #8b7cf8;
    --green:    #10b981;
    --amber:    #d97706;
    --danger:   #ef4444;
  }
`;

// ── Theme hook ─────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hb-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  function applyTheme(isDark: boolean) {
    const existing = document.getElementById("hb-theme-vars");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "hb-theme-vars";
    style.textContent = isDark ? DARK_THEME : LIGHT_THEME;
    document.head.appendChild(style);
    document.body.style.background = isDark ? "#0a0a0f" : "#f4f4f8";
    document.body.style.color      = isDark ? "#e8e8f0" : "#1a1a2e";
  }

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("hb-theme", next ? "dark" : "light");
    applyTheme(next);
  };

  return { dark, toggle };
}

// ── Sidebar ────────────────────────────────────────────────────
function Sidebar({ fullName, open, onClose }: {
  fullName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen w-60 z-40 flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
        style={{
          background:    "var(--bg)",
          borderRight:   "1px solid var(--border2)",
          paddingTop:    "64px",
          paddingBottom: "64px",
        }}
      >
        {/* Welcome */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-medium truncate" style={{ color: "var(--text2)" }}>
            Welcome,{" "}
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              {fullName || "User"}
            </span>{" "}
            👋
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            // Today's Track is also active when user is at /dashboard root
            const active =
              pathname === href ||
              (href === "/dashboard/today" && pathname === "/dashboard");
            return (
              <Link key={href} href={href} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 no-underline"
                style={{
                  background: active ? "rgba(124,110,243,0.15)" : "transparent",
                  border:     active ? "1px solid rgba(124,110,243,0.25)" : "1px solid transparent",
                  color:      active ? "var(--text)" : "var(--text2)",
                }}>
                <Icon size={16} style={{ color: active ? "#7c6ef3" : "var(--text3)" }} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer border-none"
            style={{ color: "var(--text2)", background: "transparent" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color      = "#f87171";
              (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color      = "var(--text2)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}>
            <LogOut size={16} style={{ color: "var(--text3)" }} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Top Navbar ─────────────────────────────────────────────────
function DashNavbar({ dark, onThemeToggle, onMenuToggle, sidebarOpen }: {
  dark: boolean;
  onThemeToggle: () => void;
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-5"
      style={{
        background:     "var(--bg)",
        borderBottom:   "1px solid var(--border2)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle}
          className="md:hidden p-1.5 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
          style={{ color: "var(--text2)" }}
          aria-label="Toggle menu">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link href="/dashboard/today" className="flex items-center">
          <Logo />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <a href="https://my-portfolio-xi-ochre-28.vercel.app/" target="_blank" rel="noopener noreferrer"
          className="hidden sm:block text-[13px] transition-colors no-underline"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#7c6ef3")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
          Developer —{" "}
          <span style={{ color: "var(--text2)", fontWeight: 500 }}>Nitrajsinh Solanki</span>
        </a>

        <button onClick={onThemeToggle} aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{
            background: "var(--surface)",
            border:     "1px solid var(--border2)",
            color:      "var(--text2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.5)";
            (e.currentTarget as HTMLElement).style.color       = "#7c6ef3";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
            (e.currentTarget as HTMLElement).style.color       = "var(--text2)";
          }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

// ── Bottom Footer ──────────────────────────────────────────────
function DashFooter() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-5"
      style={{
        background:     "var(--bg)",
        borderTop:      "1px solid var(--border2)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="text-[12px] whitespace-nowrap" style={{ color: "var(--text3)" }}>
        Made with <span className="text-[#e05252]">♥</span> —{" "}
        <span style={{ color: "var(--text2)" }}>Nitrajsinh (Nikul) Solanki</span>
      </p>

      <div className="flex items-center gap-4">
        {[
          { href: "https://www.linkedin.com/in/nitrajsinh-solanki-647b11293", icon: Linkedin, label: "LinkedIn" },
          { href: "https://github.com/Nitrajsinh-Solanki",                    icon: Github,   label: "GitHub"   },
          { href: "https://my-portfolio-xi-ochre-28.vercel.app/",             icon: Globe,    label: "Portfolio"},
        ].map(({ href, icon: Icon, label }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] transition-colors no-underline"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#7c6ef3")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </a>
        ))}
      </div>
    </footer>
  );
}

// ── Root Dashboard Layout ──────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dark, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullName,    setFullName]    = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.success) setFullName(data.user.fullName || data.user.email);
        else router.push("/auth/login");
      })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  return (
    <div
      className="overflow-hidden"
      style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
    >
      <DashNavbar
        dark={dark}
        onThemeToggle={toggle}
        onMenuToggle={() => setSidebarOpen(p => !p)}
        sidebarOpen={sidebarOpen}
      />

      <Sidebar fullName={fullName} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        className="fixed left-0 right-0 overflow-y-auto md:left-60"
        style={{ top: "64px", bottom: "64px" }}
      >
        <main className="px-4 sm:px-6 md:px-8 py-5">
          {children}
        </main>
      </div>

      <DashFooter />
    </div>
  );
}