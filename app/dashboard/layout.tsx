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
  BookOpen,
  Keyboard,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Logo from "../components/Logo";

// ── Nav items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Today's Track", href: "/dashboard/today",    icon: Clock        },
  { label: "Go Date Wise",  href: "/dashboard/date-wise",icon: CalendarDays },
  { label: "Mark Holiday",  href: "/dashboard/holiday",  icon: Palmtree     },
  { label: "See Analysis",  href: "/dashboard/analysis", icon: BarChart2    },
  { label: "Diary",         href: "/dashboard/diary",    icon: BookOpen     },
  { label: "Typing Test",   href: "/dashboard/typing",   icon: Keyboard     },
  { label: "Profile",       href: "/dashboard/profile",  icon: User         },
];

const SIDEBAR_WIDTH     = 232; // px — expanded
const SIDEBAR_COLLAPSED = 64;  // px — icon-only rail

// ── CSS variable themes ────────────────────────────────────────
const DARK_THEME = `
  :root {
    --bg:       #0f1117;
    --surface:  #181b24;
    --surface2: #1e2130;
    --border:   rgba(255,255,255,0.07);
    --border2:  rgba(255,255,255,0.13);
    --text:     #f0f2f8;
    --text2:    #c2c8d8;
    --text3:    #7a8499;
    --text4:    #4a5468;
    --accent:   #7c6ef3;
    --accent2:  #a78bfa;
    --green:    #22d3a0;
    --amber:    #f59e0b;
    --danger:   #f87171;
  }
`;

const LIGHT_THEME = `
  :root {
    --bg:       #f0f2f8;
    --surface:  #ffffff;
    --surface2: #e8ecf5;
    --border:   rgba(0,0,0,0.09);
    --border2:  rgba(0,0,0,0.16);
    --text:     #111827;
    --text2:    #1f2937;
    --text3:    #4b5563;
    --text4:    #9ca3af;
    --accent:   #6152e8;
    --accent2:  #7c6ef3;
    --green:    #059669;
    --amber:    #d97706;
    --danger:   #dc2626;
  }
  * { box-sizing: border-box; }
  input, textarea, select, button {
    font-family: inherit;
  }
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type='number'] { -moz-appearance: textfield; }
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
    document.body.style.background = isDark ? "#0f1117" : "#f4f6fb";
    document.body.style.color      = isDark ? "#f0f2f8" : "#111827";
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
function Sidebar({
  fullName,
  // mobile
  mobileOpen,
  onMobileClose,
  // desktop
  collapsed,
  onToggleCollapse,
}: {
  fullName: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  };

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onMobileClose}
          style={{ backdropFilter: "blur(2px)" }}
        />
      )}

      {/* ── MOBILE sidebar (full width, overlay) ── */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-40 flex flex-col md:hidden
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          width:         `${SIDEBAR_WIDTH}px`,
          background:    "var(--bg)",
          borderRight:   "1px solid var(--border2)",
          paddingTop:    "64px",
          paddingBottom: "64px",
        }}
      >
        <SidebarContent
          fullName={fullName}
          pathname={pathname}
          collapsed={false}
          onLinkClick={onMobileClose}
          onLogout={handleLogout}
          onToggleCollapse={undefined}
        />
      </aside>

      {/* ── DESKTOP sidebar (fixed, collapsible) ── */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-screen z-40 flex-col transition-all duration-300 ease-in-out"
        style={{
          width:         `${sidebarWidth}px`,
          background:    "var(--bg)",
          borderRight:   "1px solid var(--border2)",
          paddingTop:    "64px",
          paddingBottom: "64px",
          overflow:      "hidden",
        }}
      >
        <SidebarContent
          fullName={fullName}
          pathname={pathname}
          collapsed={collapsed}
          onLinkClick={() => {}}
          onLogout={handleLogout}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>
    </>
  );
}

// ── Sidebar inner content (shared between mobile/desktop) ──────
function SidebarContent({
  fullName,
  pathname,
  collapsed,
  onLinkClick,
  onLogout,
  onToggleCollapse,
}: {
  fullName: string;
  pathname: string;
  collapsed: boolean;
  onLinkClick: () => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Welcome / user row */}
      {!collapsed && (
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text2)" }}>
            Hi,{" "}
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              {fullName || "User"}
            </span>{" "}
            👋
          </p>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.12)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text3)";
                (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
              }}
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      )}

      {/* Collapsed expand button */}
      {collapsed && onToggleCollapse && (
        <div
          className="flex items-center justify-center py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border-none"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.12)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--text3)";
              (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href === "/dashboard/today" && pathname === "/dashboard");
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              title={collapsed ? label : undefined}
              className="flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-150 no-underline"
              style={{
                background: active ? "rgba(124,110,243,0.14)" : "transparent",
                border:     active ? "1px solid rgba(124,110,243,0.22)" : "1px solid transparent",
                color:      active ? "var(--text)" : "var(--text2)",
                padding:    collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text2)";
                }
              }}
            >
              <Icon
                size={16}
                style={{
                  color:     active ? "#7c6ef3" : "var(--text3)",
                  flexShrink: 0,
                }}
              />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          className="flex items-center gap-3 w-full rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer border-none"
          style={{
            color:          "var(--text2)",
            background:     "transparent",
            padding:        collapsed ? "10px 0" : "10px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color      = "#f87171";
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color      = "var(--text2)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={16} style={{ color: "var(--text3)", flexShrink: 0 }} />
          {!collapsed && "Logout"}
        </button>
      </div>
    </>
  );
}

// ── Top Navbar ─────────────────────────────────────────────────
function DashNavbar({
  dark,
  onThemeToggle,
  onMobileMenuToggle,
  mobileOpen,
  sidebarCollapsed,
}: {
  dark: boolean;
  onThemeToggle: () => void;
  onMobileMenuToggle: () => void;
  mobileOpen: boolean;
  sidebarCollapsed: boolean;
}) {
  const leftOffset = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-5 transition-all duration-300"
      style={{
        background:     "var(--bg)",
        borderBottom:   "1px solid var(--border2)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Left: hamburger (mobile) + logo */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
          style={{ color: "var(--text2)" }}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo — on desktop, indent it to sit inside the sidebar region */}
        <div
          className="hidden md:flex transition-all duration-300"
          style={{ width: `${leftOffset - 20}px`, overflow: "hidden" }}
        >
          <Link href="/dashboard/today" className="flex items-center">
            <Logo />
          </Link>
        </div>

        {/* Mobile logo */}
        <Link href="/dashboard/today" className="md:hidden flex items-center">
          <Logo />
        </Link>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <a
          href="https://my-portfolio-xi-ochre-28.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:block text-[13px] transition-colors no-underline"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
        >
          Developer —{" "}
          <span style={{ color: "var(--text2)", fontWeight: 500 }}>
            Nitrajsinh Solanki
          </span>
        </a>

        <button
          onClick={onThemeToggle}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer"
          style={{
            background: "var(--surface)",
            border:     "1px solid var(--border2)",
            color:      "var(--text2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.5)";
            (e.currentTarget as HTMLElement).style.color       = "var(--accent)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
            (e.currentTarget as HTMLElement).style.color       = "var(--text2)";
          }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

// ── Bottom Footer ──────────────────────────────────────────────
function DashFooter({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const leftOffset = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <footer
      className="dash-footer fixed bottom-0 right-0 h-16 z-40 flex items-center justify-between px-5 transition-all duration-300"
      style={{
        left:           "0",
        background:     "var(--bg)",
        borderTop:      "1px solid var(--border2)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Inject a scoped style so the footer left edge tracks the sidebar on md+ without touching window */}
      <style>{`
        @media (min-width: 768px) {
          .dash-footer { left: ${leftOffset}px !important; }
        }
      `}</style>
      <p className="text-[12px] whitespace-nowrap" style={{ color: "var(--text3)" }}>
        Made with <span style={{ color: "#e05252" }}>♥</span> —{" "}
        <span style={{ color: "var(--text2)" }}>Nitrajsinh Solanki</span>
      </p>

      <div className="flex items-center gap-4">
        {[
          { href: "https://www.linkedin.com/in/nitrajsinh-solanki-647b11293", icon: Linkedin, label: "LinkedIn"  },
          { href: "https://github.com/Nitrajsinh-Solanki",                    icon: Github,   label: "GitHub"    },
          { href: "https://my-portfolio-xi-ochre-28.vercel.app/",             icon: Globe,    label: "Portfolio" },
        ].map(({ href, icon: Icon, label }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] transition-colors no-underline"
            style={{ color: "var(--text3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
          >
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

  // Mobile sidebar open/close
  const [mobileOpen,      setMobileOpen]      = useState(false);
  // Desktop sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [fullName, setFullName] = useState("");
  const router = useRouter();

  // Persist collapse preference
  useEffect(() => {
    const stored = localStorage.getItem("hb-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  const toggleCollapse = () => {
    setSidebarCollapsed(p => {
      const next = !p;
      localStorage.setItem("hb-sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        // 401 = no token / expired
        // 403 = banned / suspended / device-banned
        // Both must force logout immediately
        if (r.status === 401 || r.status === 403) {
          router.replace("/auth/login");
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return; // already redirected above
        if (!data.success) {
          router.replace("/auth/login");
          return;
        }
        setFullName(data.user.fullName || data.user.email || "");
      })
      .catch(() => router.replace("/auth/login"));
  }, [router]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handle = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const desktopLeft = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
    >
      <DashNavbar
        dark={dark}
        onThemeToggle={toggle}
        onMobileMenuToggle={() => setMobileOpen(p => !p)}
        mobileOpen={mobileOpen}
        sidebarCollapsed={sidebarCollapsed}
      />

      <Sidebar
        fullName={fullName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* ── MAIN CONTENT AREA ── */}
      <div
        className="transition-all duration-300"
        style={{
          // On mobile: no left indent (sidebar overlays)
          // On desktop: shift right by sidebar width
          marginLeft: "0px",
          paddingTop: "64px",
          paddingBottom: "64px",
          minHeight: "100vh",
        }}
      >
        {/* Desktop left margin via a CSS class trick — use inline for dynamic value */}
        <style>{`
          @media (min-width: 768px) {
            .dash-content-area {
              margin-left: ${desktopLeft}px !important;
            }
          }
        `}</style>
        <div className="dash-content-area transition-all duration-300">
          <main className="px-4 sm:px-6 md:px-8 lg:px-10 py-5 max-w-screen-2xl">
            {children}
          </main>
        </div>
      </div>

      <DashFooter sidebarCollapsed={sidebarCollapsed} />
    </div>
  );
}