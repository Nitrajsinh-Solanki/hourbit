"use client";

import { useEffect, useRef, memo } from "react";

// ── Optimized tick marks with precise positioning ──
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
  const isMajor = i % 3 === 0;
  const innerRadius = isMajor ? 6.5 : 7.1;
  const outerRadius = 8;

  return {
    x1: 17 + Math.cos(angle) * innerRadius,
    y1: 17 + Math.sin(angle) * innerRadius,
    x2: 17 + Math.cos(angle) * outerRadius,
    y2: 17 + Math.sin(angle) * outerRadius,
    major: isMajor,
  };
});

const Logo = memo(() => {
  const handRef = useRef<SVGLineElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const hand = handRef.current;
    if (!hand) return;

    const SPIN_MS = 60000; // 60 seconds per rotation
    const HAND_LENGTH = 7;
    const CENTER = 17;
    
    let startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = (elapsed % SPIN_MS) / SPIN_MS;
      const angle = progress * Math.PI * 2 - Math.PI / 2;

      const x = CENTER + Math.cos(angle) * HAND_LENGTH;
      const y = CENTER + Math.sin(angle) * HAND_LENGTH;

      hand.setAttribute("x2", x.toFixed(3));
      hand.setAttribute("y2", y.toFixed(3));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');

        .hb-container {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          user-select: none;
          cursor: default;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hb-container:hover {
          transform: translateY(-1px);
        }

        .hb-svg {
          filter: drop-shadow(0 2px 8px rgba(124, 110, 243, 0.15));
          transition: filter 0.3s ease;
        }

        .hb-container:hover .hb-svg {
          filter: drop-shadow(0 4px 12px rgba(124, 110, 243, 0.25));
        }

        .hb-label {
          font-family: 'Manrope', system-ui, -apple-system, sans-serif;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #22d3a0;
          background: linear-gradient(135deg, #22d3a0 0%, #16b989 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          transition: all 0.3s ease;
        }

        .hb-accent {
          background: linear-gradient(135deg, #7c6ef3 0%, #5b4fe0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hb-bg {
          fill: #0f0f17;
          stroke: #2a2a35;
          stroke-width: 1;
          transition: all 0.3s ease;
        }

        .hb-container:hover .hb-bg {
          stroke: #3a3a45;
        }

        .hb-tick-minor {
          stroke: #3a3a55;
          transition: stroke 0.3s ease;
        }

        .hb-container:hover .hb-tick-minor {
          stroke: #4a4a65;
        }

        .hb-tick-major {
          stroke: url(#hb-tick-gradient);
          transition: opacity 0.3s ease;
        }

        .hb-container:hover .hb-tick-major {
          opacity: 0.95;
        }

        .hb-glow-circle {
          fill: url(#hb-inner-dark);
          opacity: 0.18;
          transition: opacity 0.3s ease;
        }

        .hb-container:hover .hb-glow-circle {
          opacity: 0.28;
        }

        .hb-ring {
          transition: stroke-width 0.3s ease;
        }

        .hb-container:hover .hb-ring {
          stroke-width: 1.8;
        }

        .hb-hour-hand {
          opacity: 0.7;
          transition: opacity 0.3s ease;
        }

        .hb-container:hover .hb-hour-hand {
          opacity: 0.85;
        }

        .hb-center-dot {
          filter: drop-shadow(0 0 4px rgba(34, 211, 160, 0.4));
          transition: filter 0.3s ease;
        }

        .hb-container:hover .hb-center-dot {
          filter: drop-shadow(0 0 6px rgba(34, 211, 160, 0.6));
        }

        /* Light theme */
        @media (prefers-color-scheme: light) {
          .hb-label {
            background: linear-gradient(135deg, #16b989 0%, #0d9970 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hb-accent {
            background: linear-gradient(135deg, #5b4fe0 0%, #4a3fcf 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hb-bg {
            fill: #ffffff;
            stroke: #d4d0f5;
          }

          .hb-container:hover .hb-bg {
            stroke: #c4c0e5;
          }

          .hb-tick-minor {
            stroke: #c5c2e8;
          }

          .hb-container:hover .hb-tick-minor {
            stroke: #b5b2d8;
          }

          .hb-glow-circle {
            fill: url(#hb-inner-light);
            opacity: 0.25;
          }

          .hb-container:hover .hb-glow-circle {
            opacity: 0.35;
          }

          .hb-svg {
            filter: drop-shadow(0 2px 8px rgba(91, 79, 224, 0.12));
          }

          .hb-container:hover .hb-svg {
            filter: drop-shadow(0 4px 12px rgba(91, 79, 224, 0.2));
          }
        }

        .light .hb-label,
        html.light .hb-label,
        body.light .hb-label {
          background: linear-gradient(135deg, #16b989 0%, #0d9970 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .light .hb-accent,
        html.light .hb-accent,
        body.light .hb-accent {
          background: linear-gradient(135deg, #5b4fe0 0%, #4a3fcf 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .light .hb-bg,
        html.light .hb-bg,
        body.light .hb-bg {
          fill: #ffffff;
          stroke: #d4d0f5;
        }

        .light.hb-container:hover .hb-bg,
        html.light .hb-container:hover .hb-bg,
        body.light .hb-container:hover .hb-bg {
          stroke: #c4c0e5;
        }

        .light .hb-tick-minor,
        html.light .hb-tick-minor,
        body.light .hb-tick-minor {
          stroke: #c5c2e8;
        }

        .light.hb-container:hover .hb-tick-minor,
        html.light .hb-container:hover .hb-tick-minor,
        body.light .hb-container:hover .hb-tick-minor {
          stroke: #b5b2d8;
        }

        .light .hb-glow-circle,
        html.light .hb-glow-circle,
        body.light .hb-glow-circle {
          fill: url(#hb-inner-light);
          opacity: 0.25;
        }

        .light.hb-container:hover .hb-glow-circle,
        html.light .hb-container:hover .hb-glow-circle,
        body.light .hb-container:hover .hb-glow-circle {
          opacity: 0.35;
        }

        .light .hb-svg,
        html.light .hb-svg,
        body.light .hb-svg {
          filter: drop-shadow(0 2px 8px rgba(91, 79, 224, 0.12));
        }

        .light.hb-container:hover .hb-svg,
        html.light .hb-container:hover .hb-svg,
        body.light .hb-container:hover .hb-svg {
          filter: drop-shadow(0 4px 12px rgba(91, 79, 224, 0.2));
        }
      `}</style>

      <div className="hb-container">
        <svg
          className="hb-svg"
          width="36"
          height="36"
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="HourBit Logo"
        >
          <defs>
            {/* Enhanced gradients */}
            <linearGradient
              id="hb-ring"
              x1="9"
              y1="9"
              x2="25"
              y2="25"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#7c6ef3" />
              <stop offset="50%" stopColor="#6d5ff0" />
              <stop offset="100%" stopColor="#5b4fe0" />
            </linearGradient>

            <linearGradient
              id="hb-hand"
              x1="17"
              y1="10"
              x2="17"
              y2="17"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#2ce3af" />
              <stop offset="100%" stopColor="#16b989" />
            </linearGradient>

            <linearGradient
              id="hb-tick-gradient"
              x1="17"
              y1="9"
              x2="17"
              y2="25"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#7c6ef3" />
              <stop offset="100%" stopColor="#5b4fe0" />
            </linearGradient>

            <radialGradient id="hb-inner-dark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c6ef3" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#7c6ef3" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#7c6ef3" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="hb-inner-light" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5b4fe0" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#5b4fe0" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#5b4fe0" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="hb-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22d3a0" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#22d3a0" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background with subtle shadow */}
          <rect x="1" y="1" width="32" height="32" rx="9" className="hb-bg" />

          {/* Inner glow layer */}
          <circle cx="17" cy="17" r="6" className="hb-glow-circle" />

          {/* Clock ring with enhanced gradient */}
          <circle
            cx="17"
            cy="17"
            r="8"
            stroke="url(#hb-ring)"
            strokeWidth="1.6"
            fill="none"
            className="hb-ring"
            style={{ strokeLinecap: 'round' }}
          />

          {/* Tick marks with improved styling */}
          {TICKS.map((tick, i) => (
            <line
              key={i}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              strokeWidth={tick.major ? 1.3 : 0.7}
              strokeLinecap="round"
              className={tick.major ? "hb-tick-major" : "hb-tick-minor"}
            />
          ))}

          {/* Static hour hand with gradient */}
          <line
            x1="17"
            y1="17"
            x2="20.8"
            y2="14.2"
            stroke="url(#hb-hand)"
            strokeWidth="2"
            strokeLinecap="round"
            className="hb-hour-hand"
          />

          {/* Animated minute hand */}
          <line
            ref={handRef}
            x1="17"
            y1="17"
            x2="17"
            y2="10"
            stroke="url(#hb-hand)"
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{ willChange: 'transform' }}
          />

          {/* Center glow effect */}
          <circle cx="17" cy="17" r="3.5" fill="url(#hb-center-glow)" />

          {/* Center dot with enhanced presence */}
          <circle cx="17" cy="17" r="2.2" fill="#22d3a0" className="hb-center-dot" />
        </svg>

        <span className="hb-label">
          Hour<span className="hb-accent">Bit</span>
        </span>
      </div>
    </>
  );
});

Logo.displayName = "Logo";

export default Logo;