// app/components/Footer.tsx
// PUBLIC Footer — only rendered inside app/(public)/layout.tsx
// Never shown on dashboard pages.

import Link from "next/link";
import { Mail, Twitter, Linkedin, Github, Globe, PenLine } from "lucide-react";

const FEATURE_LINKS = [
  { href: "/#tools",          label: "All Features"    },
  { href: "/#how-it-works",   label: "How It Works"    },
  { href: "/#faq",            label: "FAQ"             },
  { href: "/auth/register",   label: "Get Started Free" },
  { href: "/auth/login",      label: "Sign In"         },
  { href: "/auth/verify-account", label: "Verify Account" },
];

const TOOL_LINKS = [
  { label: "Work Hours Tracker",   href: "/#work-tracker"  },
  { label: "Brain Quiz & XP",      href: "/#brain-quiz"    },
  { label: "Personal Diary",       href: "/#diary"         },
  { label: "Typing Speed Test",    href: "/#typing-test"   },
  { label: "Expense Tracker",      href: "/#expenses"      },
  { label: "Productivity Analytics", href: "/#tools"       },
];

const SOCIAL_LINKS = [
  {
    href:  "mailto:nrsolanki2005@gmail.com",
    label: "nrsolanki2005@gmail.com",
    icon:  <Mail size={15} />,
    rel:   undefined,
  },
  {
    href:  "https://medium.com/@nrsolanki2005",
    label: "Medium",
    icon:  <PenLine size={15} />,
    rel:   "noopener noreferrer",
  },
  {
    href:  "https://x.com/Nitrajsinh_S",
    label: "X / Twitter",
    icon:  <Twitter size={15} />,
    rel:   "noopener noreferrer",
  },
  {
    href:  "https://www.linkedin.com/in/nitrajsinh-solanki-647b11293",
    label: "LinkedIn",
    icon:  <Linkedin size={15} />,
    rel:   "noopener noreferrer",
  },
  {
    href:  "https://github.com/Nitrajsinh-Solanki",
    label: "GitHub",
    icon:  <Github size={15} />,
    rel:   "noopener noreferrer",
  },
  {
    href:  "https://my-portfolio-xi-ochre-28.vercel.app/",
    label: "Portfolio",
    icon:  <Globe size={15} />,
    rel:   "noopener noreferrer",
  },
];

export default function Footer() {
  return (
    <footer
      className="border-t border-[#1e1e2e]"
      style={{ background: "#0a0a0f" }}
      aria-label="Site footer"
      itemScope
      itemType="https://schema.org/WPFooter"
    >
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand col */}
          <div className="lg:col-span-1">
            <p
              className="font-mono text-[18px] font-bold mb-1"
              style={{ color: "#22d3a0" }}
              itemProp="name"
            >
              Hour Bit
            </p>
            <p className="font-mono text-[12px] text-[#5a5a72] leading-[1.75] mb-5">
              Your free all-in-one productivity suite. Track work hours, test your brain, journal your days, measure typing speed, and manage expenses — all in one place.
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(34,211,160,0.08)",
                border:     "1px solid rgba(34,211,160,0.2)",
                color:      "#22d3a0",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#22d3a0] animate-pulse-glow block"
                aria-hidden="true"
              />
              100% Free · No Credit Card
            </span>
          </div>

          {/* Navigation col */}
          <div>
            <p className="font-mono text-[11px] text-[#5a5a72] tracking-[2px] uppercase mb-4">
              Navigate
            </p>
            <ul className="flex flex-col gap-2.5" role="list">
              {FEATURE_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="font-mono text-[13px] text-[#6a6a82] hover:text-[#a78bfa] transition-colors no-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools col */}
          <div>
            <p className="font-mono text-[11px] text-[#5a5a72] tracking-[2px] uppercase mb-4">
              Tools
            </p>
            <ul className="flex flex-col gap-2.5" role="list">
              {TOOL_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="font-mono text-[13px] text-[#6a6a82] hover:text-[#a78bfa] transition-colors no-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect col */}
          <div>
            <p className="font-mono text-[11px] text-[#5a5a72] tracking-[2px] uppercase mb-4">
              Connect
            </p>
            <ul className="flex flex-col gap-2.5" role="list">
              {SOCIAL_LINKS.map(({ href, label, icon, rel }) => (
                <li key={label}>
                  <Link
                    href={href}
                    target={rel ? "_blank" : undefined}
                    rel={rel}
                    className="flex items-center gap-2 font-mono text-[13px] text-[#6a6a82] hover:text-[#a78bfa] transition-colors no-underline"
                    aria-label={label}
                  >
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[12px] text-[#3a3a55]">
            © {new Date().getFullYear()} Hour Bit · Built with{" "}
            <span className="text-[#f87171]" aria-hidden="true">♥</span> by{" "}
            <Link
              href="https://my-portfolio-xi-ochre-28.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6a6a82] hover:text-[#a78bfa] transition-colors no-underline"
            >
              Nitrajsinh (Nikul) Solanki
            </Link>
          </p>
          <p className="font-mono text-[11px] text-[#2a2a3a]">
            Free forever · Secure · No ads
          </p>
        </div>
      </div>
    </footer>
  );
}