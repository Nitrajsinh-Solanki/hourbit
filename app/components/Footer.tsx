// app/components/Footer.tsx

"use client";

import Link from "next/link";
import { Mail, PenLine, Twitter, Linkedin, Github, Globe } from "lucide-react";
import { useEffect, useState } from "react";

export default function Footer() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsLoggedIn(data.success === true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Still checking — render nothing to avoid flash
  if (isLoggedIn === null) return null;

  // ── Logged in: minimal fixed footer with only LinkedIn, GitHub, Portfolio ──
  if (isLoggedIn) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 h-11 z-50
        bg-[#0a0a0f]/90 backdrop-blur-md border-t border-[#2a2a35]
        flex items-center justify-between px-5"
      >
        <p className="text-[#5a5a72] text-xs whitespace-nowrap">
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

        <div className="flex items-center gap-4">
          <a
            href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#5a5a72] hover:text-[#a78bfa] text-xs transition-colors"
          >
            <Linkedin size={13} />
            <span className="hidden sm:inline">LinkedIn</span>
          </a>
          <a
            href="https://github.com/Nitrajsinh-Solanki"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#5a5a72] hover:text-[#a78bfa] text-xs transition-colors"
          >
            <Github size={13} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="https://my-portfolio-xi-ochre-28.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#5a5a72] hover:text-[#a78bfa] text-xs transition-colors"
          >
            <Globe size={13} />
            <span className="hidden sm:inline">Portfolio</span>
          </a>
        </div>
      </footer>
    );
  }

  // ── Not logged in: full public footer ────────────────────────
  return (
    <footer className="border-t border-[#2a2a35] bg-[#0a0a0f] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">

          <p className="text-[#5a5a72] text-sm mb-4 md:mb-0">
            Made with <span className="text-[#f87171]">♥</span> by{" "}
            <span className="text-[#9898b0]">Nitrajsinh (Nikul) Solanki</span>
          </p>

          <div className="flex flex-wrap justify-center md:justify-end gap-5">
            <Link
              href="mailto:nrsolanki2005@gmail.com"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <Mail size={16} />
              nrsolanki2005@gmail.com
            </Link>
            <Link
              href="https://medium.com/@nrsolanki2005"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <PenLine size={16} />
              Medium
            </Link>
            <Link
              href="https://x.com/Nitrajsinh_S"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <Twitter size={16} />
              X
            </Link>
            <Link
              href="https://www.linkedin.com/in/nitrajsinh-solanki-647b11293"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <Linkedin size={16} />
              LinkedIn
            </Link>
            <Link
              href="https://github.com/Nitrajsinh-Solanki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <Github size={16} />
              GitHub
            </Link>
            <Link
              href="https://my-portfolio-xi-ochre-28.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#5a5a72] hover:text-[#a78bfa] text-sm transition-colors"
            >
              <Globe size={16} />
              Portfolio
            </Link>
          </div>

        </div>
      </div>
    </footer>
  );
}