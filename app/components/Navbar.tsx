// app/components/Navbar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC Navbar — only rendered inside app/(public)/layout.tsx
// This is shown ONLY on the homepage and public pages.
// Dashboard and Admin have their own independent layouts — this never appears there.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#2a2a35]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="no-underline">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/#features" className="text-[#9898b0] hover:text-white text-sm font-medium transition-colors">
              Features
            </Link>
            <Link href="/#how-it-works" className="text-[#9898b0] hover:text-white text-sm font-medium transition-colors">
              How it Works
            </Link>
            <Link href="/#why-hourbit" className="text-[#9898b0] hover:text-white text-sm font-medium transition-colors">
              Why HourBit
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Login
            </Link>
            <Link href="/auth/verify-account" className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Verify Account
            </Link>
            <Link href="/auth/register" className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Register
            </Link>
          </div>

          <button
            className="md:hidden text-[#9898b0] hover:text-white focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-md border-b border-[#2a2a35] px-4 pt-2 pb-4">
          <div className="flex flex-col space-y-2">
            <Link href="/#features" className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>Features</Link>
            <Link href="/#how-it-works" className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>How it Works</Link>
            <Link href="/#why-hourbit" className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>Why HourBit</Link>
            <div className="border-t border-[#2a2a35] my-3" />
            <Link href="/auth/login" className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link href="/auth/verify-account" className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>Verify Account</Link>
            <Link href="/auth/register" className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-3 py-2 rounded-md text-sm font-medium transition-colors" onClick={() => setMenuOpen(false)}>Register</Link>
          </div>
        </div>
      )}
    </nav>
  );
}