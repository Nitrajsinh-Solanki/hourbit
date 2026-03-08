// app/components/Navbar.tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0f]/95 backdrop-blur-md border-b border-[#2a2a35]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/#features"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Features
            </Link>

            <Link
              href="/#how-it-works"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              How it Works
            </Link>

            <Link
              href="/#why-hourbit"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Why HourBit
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/auth/login"
              className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:border-[#7c6ef3]/40 transition-colors text-sm font-medium"
            >
              Login
            </Link>

            {/* Verify Account */}
            <Link
              href="/auth/verify-account"
              className="text-[#9898b0] hover:text-white px-4 py-2 rounded-lg border border-[#2a2a35] hover:border-[#22d3a0]/40 transition-colors text-sm font-medium"
            >
              Verify Account
            </Link>

            <Link
              href="/auth/register"
              className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Register
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-[#9898b0] hover:text-white focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-md border-b border-[#2a2a35] px-4 pt-2 pb-4">
          <div className="flex flex-col space-y-2">
            <Link
              href="/#features"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Features
            </Link>

            <Link
              href="/#how-it-works"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              How it Works
            </Link>

            <Link
              href="/#why-hourbit"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Why HourBit
            </Link>

            <div className="border-t border-[#2a2a35] my-3" />

            <Link
              href="/auth/login"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>

            <Link
              href="/auth/verify-account"
              className="text-[#9898b0] hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Verify Account
            </Link>

            <Link
              href="/auth/register"
              className="text-white bg-[#7c6ef3] hover:bg-[#6c5ee3] px-3 py-2 rounded-md text-sm font-medium transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
