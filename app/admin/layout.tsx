// app/admin/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Tag,
  Layers,
  BarChart3,
  HelpCircle,
  Star,
  Trophy,
  ShieldCheck,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Github,
  Linkedin,
  Globe,
} from "lucide-react";
import Logo from "../components/Logo";

// ── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",            href: "/admin",               icon: LayoutDashboard },
  { label: "User Management",      href: "/admin/users",         icon: Users           },
  { label: "Categories",           href: "/admin/categories",    icon: Tag             },
  { label: "Subcategories",        href: "/admin/subcategories", icon: Layers          },
  { label: "Levels Management",    href: "/admin/levels",        icon: BarChart3       },
  { label: "Questions Management", href: "/admin/questions",     icon: HelpCircle      },
  { label: "XP & Rewards",         href: "/admin/xp-rewards",   icon: Star            },
  { label: "Leaderboard",          href: "/admin/leaderboard",  icon: Trophy          },
  { label: "Admin Management",     href: "/admin/management",   icon: ShieldCheck     },
  { label: "Profile",              href: "/admin/profile",      icon: User            },
];

const SIDEBAR_WIDTH     = 240;
const SIDEBAR_COLLAPSED = 64;

// ── CSS variable themes ───────────────────────────────────────
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
    --accent:   #e84393;
    --accent2:  #f472b6;
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
    --accent:   #c2185b;
    --accent2:  #e84393;
    --green:    #059669;
    --amber:    #d97706;
    --danger:   #dc2626;
  }
  * { box-sizing: border-box; }
`;

function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hb-admin-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  function applyTheme(isDark: boolean) {
    const existing = document.getElementById("hb-admin-theme-vars");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "hb-admin-theme-vars";
    style.textContent = isDark ? DARK_THEME : LIGHT_THEME;
    document.head.appendChild(style);
    document.body.style.background = isDark ? "#0f1117" : "#f4f6fb";
    document.body.style.color      = isDark ? "#f0f2f8" : "#111827";
  }

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("hb-admin-theme", next ? "dark" : "light");
    applyTheme(next);
  };

  return { dark, toggle };
}

// ── Sidebar Content ───────────────────────────────────────────
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
      {/* User row */}
      {!collapsed && (
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex flex-col min-w-0">
            <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
              Admin Panel
            </p>
            <p className="text-[13px] font-medium truncate mt-0.5" style={{ color: "var(--text2)" }}>
              Hi,{" "}
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                {fullName || "Admin"}
              </span>{" "}
              👋
            </p>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.12)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text3)";
                (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
              }}
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>
      )}

      {collapsed && onToggleCollapse && (
        <div className="flex justify-center py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
              (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.12)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--text3)";
              (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              title={collapsed ? label : undefined}
              className="flex items-center gap-3 rounded-xl transition-all no-underline"
              style={{
                padding:        collapsed ? "10px 0" : "9px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                background:     isActive ? "rgba(232,67,147,0.13)" : "transparent",
                color:          isActive ? "var(--accent)" : "var(--text3)",
                fontWeight:     isActive ? 600 : 400,
                fontSize:       "13.5px",
                borderLeft:     isActive ? "2px solid var(--accent)" : "2px solid transparent",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text3)";
                }
              }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={onLogout}
          title={collapsed ? "Sign Out" : undefined}
          className="w-full flex items-center gap-3 rounded-xl transition-all cursor-pointer border-none"
          style={{
            padding:        collapsed ? "10px 0" : "9px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            background:     "transparent",
            color:          "var(--danger)",
            fontSize:       "13.5px",
            fontWeight:     500,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.10)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={17} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );
}

// ── Sidebar wrapper ───────────────────────────────────────────
function Sidebar({
  fullName,
  mobileOpen,
  onMobileClose,
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
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onMobileClose}
          style={{ backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen z-40 flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width:         `${SIDEBAR_WIDTH}px`,
          background:    "var(--bg)",
          borderRight:   "1px solid var(--border2)",
          paddingTop:    "64px",
          paddingBottom: "44px",
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

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-screen z-40 flex-col transition-all duration-300 ease-in-out"
        style={{
          width:         `${sidebarWidth}px`,
          background:    "var(--bg)",
          borderRight:   "1px solid var(--border2)",
          paddingTop:    "64px",
          paddingBottom: "44px",
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

// ── Root layout ───────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router         = useRouter();
  const { dark, toggle } = useTheme();

  const [fullName,   setFullName]   = useState("");
  const [loading,    setLoading]    = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);

  // Auth check — only allow role === "admin"
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          router.replace("/auth/login");
          return;
        }
        if (data.user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setFullName(data.user.fullName || "Admin");
        setLoading(false);
      })
      .catch(() => router.replace("/auth/login"));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p className="font-mono text-sm" style={{ color: "var(--text3)" }}>Loading Admin Panel…</p>
        </div>
      </div>
    );
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>

      {/* ── TOP NAVBAR ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height:         "64px",
          background:     "var(--bg)",
          borderBottom:   "1px solid var(--border2)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center border-none cursor-pointer transition-all"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link href="/admin" className="no-underline">
            <Logo />
          </Link>
        </div>

        {/* Center title */}
        <div className="hidden md:flex items-center gap-2">
          <span
            className="font-mono font-bold text-[15px] tracking-wider uppercase px-3 py-1 rounded-full"
            style={{
              color:      "var(--accent)",
              background: "rgba(232,67,147,0.10)",
              border:     "1px solid rgba(232,67,147,0.25)",
            }}
          >
            ⚡ Admin Dashboard
          </span>
        </div>

        {/* Right: theme toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            title={dark ? "Switch to Light mode" : "Switch to Dark mode"}
            className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all"
            style={{ background: "var(--surface2)", color: dark ? "#f59e0b" : "#6152e8" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = dark
                ? "rgba(245,158,11,0.15)"
                : "rgba(97,82,232,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
            }}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <Sidebar
        fullName={fullName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      {/* ── MAIN CONTENT ── */}
      <main
        className="transition-all duration-300 ease-in-out"
        style={{
          marginLeft:    `${sidebarWidth}px`,
          paddingTop:    "64px",
          paddingBottom: "44px",
          minHeight:     "100vh",
        }}
      >
        <div className="hidden md:block" />
        <div className="md:hidden" style={{ marginLeft: 0 }} />
        <div className="p-4 md:p-6" style={{ maxWidth: "1400px" }}>
          {children}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer
        className="fixed bottom-0 z-50 flex items-center justify-between px-5"
        style={{
          left:       `${sidebarWidth}px`,
          right:      0,
          height:     "44px",
          background: "var(--bg)",
          borderTop:  "1px solid var(--border2)",
          transition: "left 0.3s ease",
        }}
      >
        <p className="text-xs" style={{ color: "var(--text4)", whiteSpace: "nowrap" }}>
          Made with <span style={{ color: "#f87171" }}>♥</span> by{" "}
          <a
            href="https://my-portfolio-xi-ochre-28.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text3)" }}
            className="hover:text-[--accent] transition-colors"
          >
            Nitrajsinh (Nikul) Solanki
          </a>
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: "var(--text4)" }}
          >
            <Linkedin size={13} /><span className="hidden sm:inline">LinkedIn</span>
          </a>
          <a
            href="https://github.com/Nitrajsinh-Solanki"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: "var(--text4)" }}
          >
            <Github size={13} /><span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="https://my-portfolio-xi-ochre-28.vercel.app/"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: "var(--text4)" }}
          >
            <Globe size={13} /><span className="hidden sm:inline">Portfolio</span>
          </a>
        </div>
      </footer>

    </div>
  );
}