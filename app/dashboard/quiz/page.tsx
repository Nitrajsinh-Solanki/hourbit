// // app/dashboard/quiz/page.tsx
// "use client";

// import { useEffect, useState } from "react";
// import { useRouter }           from "next/navigation";
// import { Brain, ChevronRight, Trophy, Layers } from "lucide-react";
// import toast from "react-hot-toast";

// type Category = {
//   _id:              string;
//   name:             string;
//   description:      string;
//   subcategoryCount: number;
//   totalLevels:      number;
//   completedLevels:  number;
// };

// const DIFF_COLORS = ["#7c6ef3", "#22d3a0", "#f59e0b", "#f87171"];

// export default function QuizPage() {
//   const router = useRouter();
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [loading,    setLoading]    = useState(true);

//   useEffect(() => {
//     fetch("/api/quiz/categories")
//       .then(r => r.json())
//       .then(d => {
//         if (d.success) setCategories(d.categories);
//         else toast.error(d.message);
//       })
//       .catch(() => toast.error("Failed to load categories"))
//       .finally(() => setLoading(false));
//   }, []);

//   return (
//     <div className="flex flex-col gap-6">

//       {/* Header */}
//       <div className="rounded-2xl px-6 py-5"
//         style={{
//           background: "linear-gradient(135deg, rgba(124,110,243,0.12), rgba(34,211,160,0.08))",
//           border:     "1px solid rgba(124,110,243,0.25)",
//         }}>
//         <div className="flex items-center gap-2 mb-1">
//           <Brain size={18} style={{ color: "var(--accent)" }} />
//           <span className="text-[11px] font-bold tracking-widest uppercase"
//             style={{ color: "var(--accent)" }}>
//             Brain Challenge
//           </span>
//         </div>
//         <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
//           Quiz Categories
//         </h1>
//         <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
//           Choose a category to start challenging your brain and earn XP.
//         </p>
//       </div>

//       {/* Grid */}
//       {loading ? (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {[1,2,3,4,5,6].map(i => (
//             <div key={i} className="rounded-2xl h-40 animate-pulse"
//               style={{ background: "var(--surface)", border: "1px solid var(--border2)" }} />
//           ))}
//         </div>
//       ) : categories.length === 0 ? (
//         <div className="rounded-2xl py-20 text-center"
//           style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
//           <Brain size={40} style={{ color: "var(--text4)", margin: "0 auto 12px" }} />
//           <p className="font-mono text-[14px]" style={{ color: "var(--text3)" }}>
//             No quiz categories available yet.
//           </p>
//           <p className="font-mono text-[12px] mt-1" style={{ color: "var(--text4)" }}>
//             Check back soon — the admin is preparing content.
//           </p>
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {categories.map((cat, idx) => {
//             const pct = cat.totalLevels > 0
//               ? Math.round((cat.completedLevels / cat.totalLevels) * 100)
//               : 0;
//             const accentColor = DIFF_COLORS[idx % DIFF_COLORS.length];

//             return (
//               <button
//                 key={cat._id}
//                 onClick={() => router.push(`/dashboard/quiz/${cat._id}`)}
//                 className="rounded-2xl p-5 text-left flex flex-col gap-4 transition-all hover:-translate-y-0.5 cursor-pointer border-none"
//                 style={{
//                   background: "var(--surface)",
//                   border:     "1px solid var(--border2)",
//                 }}
//                 onMouseEnter={e => {
//                   (e.currentTarget as HTMLElement).style.borderColor = accentColor + "60";
//                   (e.currentTarget as HTMLElement).style.background   = "var(--surface2)";
//                 }}
//                 onMouseLeave={e => {
//                   (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
//                   (e.currentTarget as HTMLElement).style.background   = "var(--surface)";
//                 }}
//               >
//                 {/* Icon + arrow */}
//                 <div className="flex items-start justify-between">
//                   <div className="w-11 h-11 rounded-xl flex items-center justify-center"
//                     style={{ background: accentColor + "18" }}>
//                     <Brain size={20} style={{ color: accentColor }} />
//                   </div>
//                   <ChevronRight size={16} style={{ color: "var(--text4)", marginTop: 4 }} />
//                 </div>

//                 {/* Title */}
//                 <div>
//                   <p className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>
//                     {cat.name}
//                   </p>
//                   {cat.description && (
//                     <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--text3)" }}>
//                       {cat.description}
//                     </p>
//                   )}
//                 </div>

//                 {/* Stats */}
//                 <div className="flex items-center gap-4">
//                   <div className="flex items-center gap-1.5">
//                     <Layers size={12} style={{ color: "var(--text4)" }} />
//                     <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
//                       {cat.subcategoryCount} subcategories
//                     </span>
//                   </div>
//                   <div className="flex items-center gap-1.5">
//                     <Trophy size={12} style={{ color: "var(--text4)" }} />
//                     <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
//                       {cat.totalLevels} levels
//                     </span>
//                   </div>
//                 </div>

//                 {/* Progress bar */}
//                 <div>
//                   <div className="flex justify-between items-center mb-1.5">
//                     <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
//                       Progress
//                     </span>
//                     <span className="text-[11px] font-mono font-semibold"
//                       style={{ color: accentColor }}>
//                       {cat.completedLevels}/{cat.totalLevels}
//                     </span>
//                   </div>
//                   <div className="h-1.5 rounded-full overflow-hidden"
//                     style={{ background: "var(--border)" }}>
//                     <div className="h-full rounded-full transition-all duration-500"
//                       style={{ width: `${pct}%`, background: accentColor }} />
//                   </div>
//                 </div>
//               </button>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }


"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brain, Wrench, ArrowLeft, Zap, Clock } from "lucide-react";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 4 + 2,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 4,
  duration: Math.random() * 6 + 6,
}));

export default function QuizPage() {
  const router = useRouter();
  const [tick, setTick] = useState(0);

  // Subtle animated counter for "feel"
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(id);
  }, []);

  const feats = [
    { icon: "🧠", label: "Adaptive Quiz Engine"   },
    { icon: "⚡", label: "XP Reward System"       },
    { icon: "🔓", label: "Level Unlock Progression"},
    { icon: "💡", label: "Smart Hint System"       },
    { icon: "📊", label: "Performance Analytics"   },
    { icon: "🏆", label: "Leaderboard & Rankings"  },
  ];

  return (
    <div
      style={{
        minHeight: "calc(100vh - 128px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Floating ambient particles */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left:     `${p.x}%`,
            top:      `${p.y}%`,
            width:    `${p.size}px`,
            height:   `${p.size}px`,
            borderRadius: "50%",
            background: p.id % 3 === 0
              ? "rgba(124,110,243,0.35)"
              : p.id % 3 === 1
              ? "rgba(245,158,11,0.25)"
              : "rgba(34,211,160,0.20)",
            animation: `float-${p.id % 3} ${p.duration}s ease-in-out ${p.delay}s infinite`,
            pointerEvents: "none",
          }}
        />
      ))}

      <style>{`
        @keyframes float-0 { 0%,100% { transform: translateY(0px) scale(1); opacity: 0.4; } 50% { transform: translateY(-22px) scale(1.15); opacity: 0.8; } }
        @keyframes float-1 { 0%,100% { transform: translateY(0px) scale(1); opacity: 0.3; } 50% { transform: translateY(-14px) scale(1.1); opacity: 0.65; } }
        @keyframes float-2 { 0%,100% { transform: translateY(0px); opacity: 0.25; } 50% { transform: translateY(-18px); opacity: 0.55; } }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 0.6; } }
        @keyframes spin-slow  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer    { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
        @keyframes badge-pop  { 0% { transform: scale(0.88); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          animation: "fade-in-up 0.55s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── Main card ── */}
        <div
          style={{
            borderRadius: "24px",
            overflow: "hidden",
            border: "1px solid rgba(124,110,243,0.28)",
            background: "var(--surface)",
          }}
        >
          {/* Header gradient band */}
          <div
            style={{
              padding: "36px 32px 28px",
              textAlign: "center",
              background:
                "linear-gradient(135deg, rgba(124,110,243,0.14) 0%, rgba(34,211,160,0.07) 60%, rgba(245,158,11,0.06) 100%)",
              borderBottom: "1px solid rgba(124,110,243,0.16)",
              position: "relative",
            }}
          >
            {/* Orbit ring around icon */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                marginBottom: "20px",
              }}
            >
              {/* Outer spinning ring */}
              <div
                style={{
                  position: "absolute",
                  width: "84px",
                  height: "84px",
                  borderRadius: "50%",
                  border: "2px dashed rgba(124,110,243,0.30)",
                  animation: "spin-slow 10s linear infinite",
                }}
              />
              {/* Pulsing glow */}
              <div
                style={{
                  position: "absolute",
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "rgba(124,110,243,0.10)",
                  animation: "pulse-ring 2.4s ease-in-out infinite",
                }}
              />
              {/* Icon bubble */}
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "rgba(124,110,243,0.18)",
                  border: "1.5px solid rgba(124,110,243,0.38)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <Brain size={26} style={{ color: "var(--accent)" }} />
                {/* Wrench badge */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "-6px",
                    right: "-6px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "8px",
                    background: "var(--amber)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--surface)",
                  }}
                >
                  <Wrench size={11} style={{ color: "#fff" }} />
                </div>
              </div>
            </div>

            {/* Status chip */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: "rgba(245,158,11,0.14)",
                  border: "1px solid rgba(245,158,11,0.30)",
                  color: "var(--amber)",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  animation: "shimmer 2.2s ease-in-out infinite",
                }}
              >
                <Clock size={10} />
                Under Construction
              </span>
            </div>

            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--text)",
                margin: "0 0 10px",
                lineHeight: 1.2,
              }}
            >
              Brain Quiz is Being Built
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text3)",
                fontFamily: "monospace",
                margin: 0,
                lineHeight: 1.7,
              }}
            >
              The quiz system is under active development.
              <br />
              All the XP, levels, and challenge logic are being wired up.
            </p>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Coming soon features grid */}
            <div>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--text4)",
                  marginBottom: "12px",
                }}
              >
                What's coming
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {feats.map((f, i) => (
                  <div
                    key={f.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      animation: `badge-pop 0.4s ease ${0.08 * i}s both`,
                    }}
                  >
                    <span style={{ fontSize: "15px", lineHeight: 1 }}>{f.icon}</span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text2)",
                        fontWeight: 500,
                        lineHeight: 1.3,
                      }}
                    >
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar (decorative) */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "var(--text4)",
                  }}
                >
                  Development progress
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  72%
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  borderRadius: "999px",
                  background: "var(--border2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: "999px",
                    width: "72%",
                    background:
                      "linear-gradient(to right, var(--accent), var(--accent2))",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Shimmer sweep */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)",
                      animation: "spin-slow 2s linear infinite",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* XP notice */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.20)",
              }}
            >
              <Zap size={14} style={{ color: "var(--amber)", flexShrink: 0 }} />
              <p
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  color: "var(--text3)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Your existing XP and progress are{" "}
                <strong style={{ color: "var(--amber)" }}>safe and preserved</strong>.
                Everything will be ready when we launch.
              </p>
            </div>

            {/* Action */}
            <button
              onClick={() => router.back()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                padding: "13px",
                borderRadius: "14px",
                border: "none",
                cursor: "pointer",
                background: "var(--surface2)",
                color: "var(--text2)",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "inherit",
                transition: "all 0.18s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(124,110,243,0.14)";
                (e.currentTarget as HTMLElement).style.color      = "var(--accent)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.30)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
                (e.currentTarget as HTMLElement).style.color      = "var(--text2)";
              }}
            >
              <ArrowLeft size={15} />
              Go Back to Dashboard
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "var(--text4)",
          }}
        >
          Other dashboard features are fully operational — only Brain Quiz is being worked on.
        </p>
      </div>
    </div>
  );
}