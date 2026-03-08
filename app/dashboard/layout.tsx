// app/dashboard/layout.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Palmtree,
  BarChart2,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Github,
  Linkedin,
  Globe,
} from "lucide-react";

// ── Nav items ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard",           icon: LayoutDashboard },
  { label: "Today's Track", href: "/dashboard/today",     icon: Clock           },
  { label: "Go Date Wise",  href: "/dashboard/date-wise", icon: CalendarDays    },
  { label: "Mark Holiday",  href: "/dashboard/holiday",   icon: Palmtree        },
  { label: "See Analysis",  href: "/dashboard/analysis",  icon: BarChart2       },
  { label: "Profile",       href: "/dashboard/profile",   icon: User            },
];

// ── Theme hook ─────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hb-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("hb-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  return { dark, toggle };
}

// ── Sidebar ────────────────────────────────────────────────────
function Sidebar({
  fullName,
  open,
  onClose,
}: {
  fullName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-16 left-0 h-[calc(100vh-64px)] w-60 z-40
          bg-[#0a0a0f] border-r border-[#2a2a35]
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* Welcome */}
        <div className="px-5 pt-6 pb-5 border-b border-[#2a2a35]">
          <p className="text-[#9898b0] text-sm font-medium truncate">
            Welcome,{" "}
            <span className="text-white font-semibold">
              {fullName || "User"}
            </span>{" "}
            👋
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${
                    active
                      ? "bg-[#7c6ef3]/20 text-white border border-[#7c6ef3]/30"
                      : "text-[#9898b0] hover:bg-[#1e1e2e] hover:text-white"
                  }
                `}
              >
                <Icon
                  size={17}
                  className={active ? "text-[#7c6ef3]" : "text-[#5a5a7a]"}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[#2a2a35]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium
              text-[#9898b0] hover:bg-[#2d1a1a] hover:text-[#e05252]
              transition-all duration-200"
          >
            <LogOut size={17} className="text-[#5a5a7a]" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Top Navbar ─────────────────────────────────────────────────
function DashboardNavbar({
  dark,
  onThemeToggle,
  onMenuToggle,
}: {
  dark: boolean;
  onThemeToggle: () => void;
  onMenuToggle: () => void;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 z-50
        bg-[#0a0a0f]/90 backdrop-blur-md
        border-b border-[#2a2a35]
        flex items-center justify-between px-5"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-[#9898b0] hover:text-white transition-colors p-1"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        <Link href="/dashboard" className="text-lg font-bold text-white tracking-tight">
          Hour<span className="text-[#7c6ef3]">Bit</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden sm:block text-[#5a5a7a] text-sm">
          Developer Contact —{" "}
          <a
            href="https://my-portfolio-xi-ochre-28.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#9898b0] font-medium hover:text-[#7c6ef3] transition-colors duration-200 underline underline-offset-2 decoration-[#7c6ef3]/40"
          >
            Nitrajsinh Solanki
          </a>
        </span>

        <button
          onClick={onThemeToggle}
          aria-label="Toggle theme"
          className="
            w-9 h-9 rounded-lg flex items-center justify-center
            bg-[#12121f] border border-[#2a2a35]
            text-[#9898b0] hover:text-white hover:border-[#7c6ef3]/50
            transition-all duration-200
          "
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

// ── Root Dashboard Layout ──────────────────────────────────────
// NOTE: No <Footer /> here — the global Footer in app/layout.tsx
// handles it. When token cookie exists, Footer auto-switches to
// the minimal dashboard variant. Zero duplication.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dark, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFullName(data.user.fullName || data.user.email);
        } else {
          router.push("/auth/login");
        }
      })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0]">
      <DashboardNavbar
        dark={dark}
        onThemeToggle={toggle}
        onMenuToggle={() => setSidebarOpen((p) => !p)}
      />

      <Sidebar
        fullName={fullName}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* pb-11 to avoid content hiding behind the fixed footer */}
      <main className="min-h-screen md:ml-60 pt-20 pb-11 px-6 md:px-8">
        {children}
      </main>
    </div>
  );
}