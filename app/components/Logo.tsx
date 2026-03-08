// app/components/Logo.tsx
//
// PERFORMANCE: single requestAnimationFrame loop drives ALL animations.
// Zero React state updates = zero re-renders during animation.
// SVG DOM is mutated directly via refs (setAttribute / style).
// Particles are SVG elements created natively — no React reconciler overhead.
// Tick marks computed once at module level — never recalculated.
// THEME: Fully adaptive — works in both light and dark mode via CSS variables.

"use client";

import { useEffect, useRef } from "react";

// ── Tick marks computed once at module load — pure static data ──
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a      = ((i / 12) * 360 - 90) * (Math.PI / 180);
  const isMajor = i % 3 === 0;
  const inner  = isMajor ? 6.5 : 7.1;
  return {
    x1: 17 + Math.cos(a) * inner,
    y1: 17 + Math.sin(a) * inner,
    x2: 17 + Math.cos(a) * 8,
    y2: 17 + Math.sin(a) * 8,
    major: isMajor,
  };
});

export default function Logo() {
  const svgRef         = useRef<SVGSVGElement>(null);
  const handRef        = useRef<SVGLineElement>(null);
  const glowCircleRef  = useRef<SVGCircleElement>(null);
  const pulseRingRef   = useRef<SVGCircleElement>(null);
  const particleGRef   = useRef<SVGGElement>(null);
  const rafRef         = useRef<number>(0);
  const startRef       = useRef<number>(0);
  const lastSpawnRef   = useRef<number>(-9999);

  useEffect(() => {
    const svg        = svgRef.current;
    const hand       = handRef.current;
    const glowCircle = glowCircleRef.current;
    const pulseRing  = pulseRingRef.current;
    const pGroup     = particleGRef.current;
    if (!svg || !hand || !glowCircle || !pulseRing || !pGroup) return;

    const SPIN_MS    = 60000; // one full rotation = 60 seconds (real minute hand pace)
    const SPAWN_MS   = 3000;  // particle burst every 3 seconds
    const N_PARTS    = 6;
    const HAND_LEN   = 7;

    // Trailing arc segment that follows the minute hand tip — redrawn each frame
    const arcPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arcPath.setAttribute("fill", "none");
    arcPath.setAttribute("stroke", "#22d3a0");
    arcPath.setAttribute("stroke-width", "1.2");
    arcPath.setAttribute("stroke-linecap", "round");
    arcPath.setAttribute("opacity", "0.45");
    svg.insertBefore(arcPath, hand);

    // Build SVG arc path string for the trailing sweep behind the hand
    const buildArc = (angleDeg: number, trailDeg: number) => {
      const CX = 17, CY = 17, R = HAND_LEN;
      const startDeg = angleDeg - trailDeg;
      const startRad = (startDeg - 90) * (Math.PI / 180);
      const endRad   = (angleDeg   - 90) * (Math.PI / 180);
      const x1 = CX + Math.cos(startRad) * R;
      const y1 = CY + Math.sin(startRad) * R;
      const x2 = CX + Math.cos(endRad)   * R;
      const y2 = CY + Math.sin(endRad)   * R;
      const large = trailDeg > 180 ? 1 : 0;
      return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
    };

    // Spawn CSS-animated SVG particles — no JS per frame after spawn
    const spawnParticles = (now: number) => {
      while (pGroup.firstChild) pGroup.removeChild(pGroup.firstChild);
      for (let i = 0; i < N_PARTS; i++) {
        const a  = ((i / N_PARTS) * 360 + Math.random() * 30 - 15) * (Math.PI / 180);
        const d  = 9 + Math.random() * 3.5;
        const r  = 0.55 + Math.random() * 0.75;
        const c  = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx",   String((17 + Math.cos(a) * d).toFixed(2)));
        c.setAttribute("cy",   String((17 + Math.sin(a) * d).toFixed(2)));
        c.setAttribute("r",    String(r.toFixed(2)));
        c.setAttribute("fill", "#22d3a0");
        c.style.animation = "hb-pf 0.9s ease-out forwards";
        pGroup.appendChild(c);
      }
      lastSpawnRef.current = now;
    };

    // Steady ambient glow — set once, driven by CSS (not RAF)
    svg.style.filter = "drop-shadow(0 0 5px rgba(124,110,243,0.32))";
    glowCircle.setAttribute("opacity", "0.10");
    pulseRing.setAttribute("opacity",  "0");   // unused — hidden

    // ── Single RAF loop driving everything ───────────────────────
    const frame = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = ts - startRef.current;

      // 1 — Minute hand rotation — real clock speed (60 s / rotation)
      const deg = ((t % SPIN_MS) / SPIN_MS) * 360;
      const rad = (deg - 90) * (Math.PI / 180);
      hand.setAttribute("x2", (17 + Math.cos(rad) * HAND_LEN).toFixed(3));
      hand.setAttribute("y2", (17 + Math.sin(rad) * HAND_LEN).toFixed(3));

      // 2 — Trailing arc: 40° sweep that fades behind the hand tip
      arcPath.setAttribute("d", buildArc(deg, 40));

      // 3 — Particle burst every 3 s
      if (ts - lastSpawnRef.current >= SPAWN_MS) spawnParticles(ts);

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      startRef.current  = 0;
      lastSpawnRef.current = -9999;
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes hb-pf {
          0%   { opacity: .85; transform: scale(1); }
          100% { opacity: 0;   transform: scale(.05); }
        }

        /* Dark mode (default): rich purple glow */
        @keyframes hb-glow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(124,110,243,.30)) drop-shadow(0 0 2px rgba(34,211,160,.15)); }
          50%     { filter: drop-shadow(0 0 11px rgba(124,110,243,.60)) drop-shadow(0 0 5px rgba(34,211,160,.25)); }
        }

        /* Light mode: softer, more visible on white */
        @media (prefers-color-scheme: light) {
          .hb-svg { animation: hb-glow-light 3s ease-in-out infinite !important; }
        }
        @keyframes hb-glow-light {
          0%,100% { filter: drop-shadow(0 0 4px rgba(91,79,224,.35)) drop-shadow(0 0 2px rgba(22,185,137,.20)); }
          50%     { filter: drop-shadow(0 0 12px rgba(91,79,224,.55)) drop-shadow(0 0 6px rgba(22,185,137,.35)); }
        }

        /* Class-based theme support (for Tailwind dark:, next-themes, etc.) */
        .dark .hb-svg {
          animation: hb-glow 3s ease-in-out infinite;
        }
        .light .hb-svg {
          animation: hb-glow-light 3s ease-in-out infinite;
        }

        /* Logo text — adapts colour to theme */
        .hb-label {
          font-family: var(--font-manrope, 'Manrope', system-ui, sans-serif);
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #22d3a0 !important;
        }
        @media (prefers-color-scheme: light) {
          .hb-label { color: #16b989 !important; }
        }
        .light .hb-label  { color: #16b989 !important; }
        .dark  .hb-label  { color: #22d3a0 !important; }

        .hb-accent {
          color: #7c6ef3;
        }
        @media (prefers-color-scheme: light) {
          .hb-accent { color: #5b4fe0; }
        }
        .light .hb-accent { color: #5b4fe0; }
        .dark  .hb-accent { color: #7c6ef3; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
        <svg
          ref={svgRef}
          className="hb-svg"
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ animation: "hb-glow 3s ease-in-out infinite" }}
        >
          <defs>
            {/* ── Ring gradient — consistent across themes ── */}
            <linearGradient id="hb-ring" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#7c6ef3" />
              <stop offset="100%" stopColor="#5b4fe0" />
            </linearGradient>

            {/* ── Hand gradient ── */}
            <linearGradient id="hb-hand" x1="17" y1="9" x2="17" y2="17" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#22d3a0" />
              <stop offset="100%" stopColor="#16b989" />
            </linearGradient>

            {/* ── Inner radial glow — dark mode ── */}
            <radialGradient id="hb-inner-dark" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#7c6ef3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7c6ef3" stopOpacity="0"    />
            </radialGradient>

            {/* ── Inner radial glow — light mode (more visible) ── */}
            <radialGradient id="hb-inner-light" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#7c6ef3" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#7c6ef3" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/*
            ── BACKGROUND RECT ──────────────────────────────────────
            Dark theme  : deep navy  #0f0f17 bg, #2a2a35 border
            Light theme : white bg,  soft purple-tinted border
            ──────────────────────────────────────────────────────── */}
          <rect
            x="1" y="1" width="32" height="32" rx="9"
            className="hb-bg"
          />

          {/* Inline <style> inside SVG for the rect — SVG presentational attrs
              can't respond to CSS media queries, but a <style> block inside SVG can. */}
          <style>{`
            .hb-bg {
              fill: #0f0f17;
              stroke: #2a2a35;
              stroke-width: 1;
            }
            @media (prefers-color-scheme: light) {
              .hb-bg { fill: #ffffff; stroke: #d4d0f5; }
            }
            .light .hb-bg { fill: #ffffff; stroke: #d4d0f5; }
            .dark  .hb-bg { fill: #0f0f17; stroke: #2a2a35; }

            /* Minor tick marks adapt too */
            .hb-tick-minor {
              stroke: #3a3a55;
            }
            @media (prefers-color-scheme: light) {
              .hb-tick-minor { stroke: #c5c2e8; }
            }
            .light .hb-tick-minor { stroke: #c5c2e8; }
            .dark  .hb-tick-minor { stroke: #3a3a55; }
          `}</style>

          {/* inner glow — mutated by RAF; pick gradient based on theme via CSS class */}
          <circle
            ref={glowCircleRef}
            cx="17" cy="17" r="5"
            fill="url(#hb-inner-dark)"
            opacity="0.18"
            className="hb-glow-circle"
          />
          <style>{`
            @media (prefers-color-scheme: light) {
              .hb-glow-circle { fill: url(#hb-inner-light); opacity: 0.28; }
            }
            .light .hb-glow-circle { fill: url(#hb-inner-light); opacity: 0.28; }
            .dark  .hb-glow-circle { fill: url(#hb-inner-dark);  opacity: 0.18; }
          `}</style>

          {/* clock ring */}
          <circle cx="17" cy="17" r="8" stroke="url(#hb-ring)" strokeWidth="1.5" fill="none" />

          {/* tick marks — fully static, rendered once by React */}
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? "#7c6ef3" : undefined}
              strokeWidth={t.major ? 1.2 : 0.65}
              strokeLinecap="round"
              className={t.major ? undefined : "hb-tick-minor"}
            />
          ))}

          {/* particle container — children managed imperatively */}
          <g ref={particleGRef} />

          {/* static hour hand */}
          <line
            x1="17" y1="17" x2="20.5" y2="14.5"
            stroke="#22d3a0" strokeWidth="1.8"
            strokeLinecap="round" opacity="0.65"
          />

          {/* rotating minute hand — x2/y2 set by RAF */}
          <line
            ref={handRef}
            x1="17" y1="17" x2="17" y2="10"
            stroke="url(#hb-hand)" strokeWidth="2" strokeLinecap="round"
          />

          {/* pulse ring — hidden, replaced by CSS glow on svg */}
          <circle
            ref={pulseRingRef}
            cx="17" cy="17" r="1.5"
            fill="none" stroke="none" strokeWidth="0" opacity="0"
          />

          {/* center dot — static, always on top */}
          <circle cx="17" cy="17" r="2" fill="#22d3a0" />
        </svg>

        <span className="hb-label" style={{ color: "#22d3a0" }}>
          Hour<span className="hb-accent" style={{ color: "#7c6ef3" }}>Bit</span>
        </span>
      </div>
    </>
  );
}