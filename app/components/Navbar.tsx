// app/components/Navbar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC Navbar — only rendered inside app/(public)/layout.tsx
// Shown ONLY on the homepage and public pages.
// Dashboard and Admin have their own independent layouts.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/#tools",       label: "Features"    },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq",         label: "FAQ"         },
];

export default function Navbar() {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background:   scrolled ? "rgba(10,10,15,0.96)" : "rgba(10,10,15,0.80)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: scrolled
          ? "1px solid rgba(42,42,53,0.9)"
          : "1px solid rgba(42,42,53,0.5)",
        boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.4)" : "none",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px]">

          {/* Logo */}
          <Link href="/" aria-label="Hour Bit — go to homepage" className="no-underline shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1" role="list">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                role="listitem"
                className="text-[#9898b0] hover:text-[#e8e8f0] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 no-underline"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop auth buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/auth/login"
              className="text-[#9898b0] hover:text-[#e8e8f0] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 no-underline"
              aria-label="Sign in to your Hour Bit account"
            >
              Sign In
            </Link>
            <Link
              href="/auth/verify-account"
              className="text-[#9898b0] hover:text-[#e8e8f0] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 no-underline"
              aria-label="Verify your Hour Bit account"
            >
              Verify Account
            </Link>
            <Link
              href="/auth/register"
              className="text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-150 no-underline"
              style={{
                background: "linear-gradient(135deg,#7c6ef3,#6c5ee3)",
                boxShadow:  "0 0 20px rgba(124,110,243,0.35)",
              }}
              aria-label="Create free Hour Bit account"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-[#9898b0] hover:text-white transition-colors"
            onClick={() => setMenuOpen((p) => !p)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-[#1e1e2e] px-4 py-4"
          style={{ background: "rgba(10,10,15,0.98)" }}
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-[#9898b0] hover:text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="my-2 border-t border-[#1e1e2e]" />
            <Link
              href="/auth/login"
              className="text-[#9898b0] hover:text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
              onClick={() => setMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/auth/verify-account"
              className="text-[#9898b0] hover:text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline"
              onClick={() => setMenuOpen(false)}
            >
              Verify Account
            </Link>
            <Link
              href="/auth/register"
              className="text-white text-sm font-semibold px-3 py-2.5 rounded-lg mt-1 transition-all no-underline text-center"
              style={{ background: "linear-gradient(135deg,#7c6ef3,#6c5ee3)" }}
              onClick={() => setMenuOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}