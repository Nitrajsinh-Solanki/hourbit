"use client";

import { useEffect, useRef } from "react";

// ── Tick marks computed once at module load — pure static data ──
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = ((i / 12) * 360 - 90) * (Math.PI / 180);
  const isMajor = i % 3 === 0;
  const inner = isMajor ? 6.5 : 7.1;

  return {
    x1: 17 + Math.cos(a) * inner,
    y1: 17 + Math.sin(a) * inner,
    x2: 17 + Math.cos(a) * 8,
    y2: 17 + Math.sin(a) * 8,
    major: isMajor,
  };
});

export default function Logo() {
  const handRef = useRef<SVGLineElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const hand = handRef.current;
    if (!hand) return;

    const SPIN_MS = 60000; // one full rotation in 60s
    const HAND_LEN = 7;

    const frame = (ts: number) => {
      if (!startRef.current) startRef.current = ts;

      const t = ts - startRef.current;
      const deg = ((t % SPIN_MS) / SPIN_MS) * 360;
      const rad = (deg - 90) * (Math.PI / 180);

      hand.setAttribute("x2", (17 + Math.cos(rad) * HAND_LEN).toFixed(3));
      hand.setAttribute("y2", (17 + Math.sin(rad) * HAND_LEN).toFixed(3));

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
    };
  }, []);

  return (
    <>
      <style>{`
        .hb-label {
          font-family: var(--font-manrope, 'Manrope', system-ui, sans-serif);
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #22d3a0;
        }

        .hb-accent {
          color: #7c6ef3;
        }

        .hb-bg {
          fill: #0f0f17;
          stroke: #2a2a35;
          stroke-width: 1;
        }

        .hb-tick-minor {
          stroke: #3a3a55;
        }

        .hb-glow-circle {
          fill: url(#hb-inner-dark);
          opacity: 0.18;
        }

        /* Light theme */
        .light .hb-label,
        html.light .hb-label,
        body.light .hb-label {
          color: #16b989;
        }

        .light .hb-accent,
        html.light .hb-accent,
        body.light .hb-accent {
          color: #5b4fe0;
        }

        .light .hb-bg,
        html.light .hb-bg,
        body.light .hb-bg {
          fill: #ffffff;
          stroke: #d4d0f5;
        }

        .light .hb-tick-minor,
        html.light .hb-tick-minor,
        body.light .hb-tick-minor {
          stroke: #c5c2e8;
        }

        .light .hb-glow-circle,
        html.light .hb-glow-circle,
        body.light .hb-glow-circle {
          fill: url(#hb-inner-light);
          opacity: 0.28;
        }

        /* Fallback for system light mode */
        @media (prefers-color-scheme: light) {
          .hb-label {
            color: #16b989;
          }

          .hb-accent {
            color: #5b4fe0;
          }

          .hb-bg {
            fill: #ffffff;
            stroke: #d4d0f5;
          }

          .hb-tick-minor {
            stroke: #c5c2e8;
          }

          .hb-glow-circle {
            fill: url(#hb-inner-light);
            opacity: 0.28;
          }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hb-ring" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c6ef3" />
              <stop offset="100%" stopColor="#5b4fe0" />
            </linearGradient>

            <linearGradient id="hb-hand" x1="17" y1="9" x2="17" y2="17" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22d3a0" />
              <stop offset="100%" stopColor="#16b989" />
            </linearGradient>

            <radialGradient id="hb-inner-dark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c6ef3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7c6ef3" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="hb-inner-light" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c6ef3" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#7c6ef3" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background */}
          <rect x="1" y="1" width="32" height="32" rx="9" className="hb-bg" />

          {/* Inner glow */}
          <circle cx="17" cy="17" r="5" className="hb-glow-circle" />

          {/* Clock ring */}
          <circle
            cx="17"
            cy="17"
            r="8"
            stroke="url(#hb-ring)"
            strokeWidth="1.5"
            fill="none"
          />

          {/* Tick marks */}
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? "#7c6ef3" : undefined}
              strokeWidth={t.major ? 1.2 : 0.65}
              strokeLinecap="round"
              className={t.major ? undefined : "hb-tick-minor"}
            />
          ))}

          {/* Static hour hand */}
          <line
            x1="17"
            y1="17"
            x2="20.5"
            y2="14.5"
            stroke="#22d3a0"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.65"
          />

          {/* Moving minute hand */}
          <line
            ref={handRef}
            x1="17"
            y1="17"
            x2="17"
            y2="10"
            stroke="url(#hb-hand)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Center dot */}
          <circle cx="17" cy="17" r="2" fill="#22d3a0" />
        </svg>

        <span className="hb-label">
          Hour<span className="hb-accent">Bit</span>
        </span>
      </div>
    </>
  );
}