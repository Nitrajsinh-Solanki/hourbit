// app/auth/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Layout for ALL auth pages:
//   /auth/login  /auth/register  /auth/forgot-password
//   /auth/verify  /auth/verify-account  /auth/reset-password
//
// Navbar design is taken directly from app/components/Navbar.tsx so the
// look & feel is 100% consistent with the public homepage navbar.
//
// Dashboard and Admin have their own completely independent layouts —
// this file has zero effect on them.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import Link from "next/link";
import { ReactNode } from "react";
import Logo from "../components/Logo";
import {
  Menu,
  X,
  Github,
  Linkedin,
  Globe,
  Mail,
  PenLine,
  Twitter,
} from "lucide-react";

// ── Auth Nav Links ────────────────────────────────────────────
// These are the links shown in the auth navbar so users can
// navigate between auth pages easily.
const AUTH_NAV_LINKS = [
  { href: "/auth/login",            label: "Login"           },
  { href: "/auth/register",         label: "Register"        },
  { href: "/auth/verify-account",   label: "Verify Account"  },
  { href: "/auth/forgot-password",  label: "Forgot Password" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-[#e8e8f0]">

      {/* ══════════════════════════════════════════════════════════
          TOP NAVBAR  — mirrors app/components/Navbar.tsx exactly
      ══════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#2a2a35]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Left — Logo (navigates back to homepage) */}
            <Link href="/" className="no-underline">
              <Logo />
            </Link>

            {/* Centre — section label (desktop only) */}
            <div className="hidden md:flex items-center">
              <span className="font-mono text-[12px] text-[#3a3a55] tracking-widest uppercase select-none">
                Account
              </span>
            </div>

            {/* Right — auth page links (desktop) */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/auth/login"
                className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline"
              >
                Login
              </Link>
              <Link
                href="/auth/verify-account"
                className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline"
              >
                Verify Account
              </Link>
              <Link
                href="/auth/forgot-password"
                className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline"
              >
                Forgot Password
              </Link>
              {/* Register gets the purple CTA pill — same as public Navbar */}
              <Link
                href="/auth/register"
                className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-4 py-2 rounded-lg text-sm font-medium transition-colors no-underline ml-1"
              >
                Register
              </Link>
            </div>

            {/* Mobile hamburger — identical pattern to public Navbar */}
            <button
              className="md:hidden text-[#9898b0] hover:text-white focus:outline-none bg-transparent border-none cursor-pointer p-1"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

          </div>
        </div>

        {/* ── Mobile dropdown ─────────────────────────────────── */}
        {menuOpen && (
          <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-md border-b border-[#2a2a35] px-4 pt-2 pb-4">
            <div className="flex flex-col space-y-1">

              {/* Back to homepage */}
              <Link
                href="/"
                className="text-[#5a5a72] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline"
                onClick={() => setMenuOpen(false)}
              >
                ← Back to Home
              </Link>

              <div className="border-t border-[#2a2a35] my-2" />

              {/* Auth page links */}
              {AUTH_NAV_LINKS.map(({ href, label }) =>
                label === "Register" ? (
                  <Link
                    key={href}
                    href={href}
                    className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors no-underline"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                )
              )}

            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT
          `grow` pushes the footer to the bottom on short pages.
          Auth pages handle their own internal padding/centering.
      ══════════════════════════════════════════════════════════ */}
      <main className="grow">
        {children}
      </main>

      {/* ══════════════════════════════════════════════════════════
          FOOTER  — same style & links as public Footer.tsx
      ══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#2a2a35] bg-[#0a0a0f] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">

            <p className="text-[#5a5a72] text-sm">
              Made with <span className="text-[#f87171]">♥</span> by{" "}
              <a
                href="https://my-portfolio-xi-ochre-28.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9898b0] hover:text-[#a78bfa] transition-colors"
              >
                Nitrajsinh (Nikul) Solanki
              </a>
            </p>

            <div className="flex flex-wrap justify-center md:justify-end gap-5">
              <a
                href="mailto:nrsolanki2005@gmail.com"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <Mail size={16} />
                nrsolanki2005@gmail.com
              </a>
              <a
                href="https://medium.com/@nrsolanki2005"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <PenLine size={16} />
                Medium
              </a>
              <a
                href="https://x.com/Nitrajsinh_S"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <Twitter size={16} />
                X
              </a>
              <a
                href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <Linkedin size={16} />
                LinkedIn
              </a>
              <a
                href="https://github.com/Nitrajsinh-Solanki"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <Github size={16} />
                GitHub
              </a>
              <a
                href="https://my-portfolio-xi-ochre-28.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
              >
                <Globe size={16} />
                Portfolio
              </a>
            </div>

          </div>
        </div>
      </footer>

    </div>
  );
}