// app/dashboard/quiz/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { Brain, ChevronRight, Trophy, Layers } from "lucide-react";
import toast from "react-hot-toast";

type Category = {
  _id:              string;
  name:             string;
  description:      string;
  subcategoryCount: number;
  totalLevels:      number;
  completedLevels:  number;
};

const DIFF_COLORS = ["#7c6ef3", "#22d3a0", "#f59e0b", "#f87171"];

export default function QuizPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch("/api/quiz/categories")
      .then(r => r.json())
      .then(d => {
        if (d.success) setCategories(d.categories);
        else toast.error(d.message);
      })
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="rounded-2xl px-6 py-5"
        style={{
          background: "linear-gradient(135deg, rgba(124,110,243,0.12), rgba(34,211,160,0.08))",
          border:     "1px solid rgba(124,110,243,0.25)",
        }}>
        <div className="flex items-center gap-2 mb-1">
          <Brain size={18} style={{ color: "var(--accent)" }} />
          <span className="text-[11px] font-bold tracking-widest uppercase"
            style={{ color: "var(--accent)" }}>
            Brain Challenge
          </span>
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
          Quiz Categories
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
          Choose a category to start challenging your brain and earn XP.
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-2xl h-40 animate-pulse"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl py-20 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <Brain size={40} style={{ color: "var(--text4)", margin: "0 auto 12px" }} />
          <p className="font-mono text-[14px]" style={{ color: "var(--text3)" }}>
            No quiz categories available yet.
          </p>
          <p className="font-mono text-[12px] mt-1" style={{ color: "var(--text4)" }}>
            Check back soon — the admin is preparing content.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, idx) => {
            const pct = cat.totalLevels > 0
              ? Math.round((cat.completedLevels / cat.totalLevels) * 100)
              : 0;
            const accentColor = DIFF_COLORS[idx % DIFF_COLORS.length];

            return (
              <button
                key={cat._id}
                onClick={() => router.push(`/dashboard/quiz/${cat._id}`)}
                className="rounded-2xl p-5 text-left flex flex-col gap-4 transition-all hover:-translate-y-0.5 cursor-pointer border-none"
                style={{
                  background: "var(--surface)",
                  border:     "1px solid var(--border2)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = accentColor + "60";
                  (e.currentTarget as HTMLElement).style.background   = "var(--surface2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
                  (e.currentTarget as HTMLElement).style.background   = "var(--surface)";
                }}
              >
                {/* Icon + arrow */}
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: accentColor + "18" }}>
                    <Brain size={20} style={{ color: accentColor }} />
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--text4)", marginTop: 4 }} />
                </div>

                {/* Title */}
                <div>
                  <p className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--text3)" }}>
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Layers size={12} style={{ color: "var(--text4)" }} />
                    <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                      {cat.subcategoryCount} subcategories
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy size={12} style={{ color: "var(--text4)" }} />
                    <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                      {cat.totalLevels} levels
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                      Progress
                    </span>
                    <span className="text-[11px] font-mono font-semibold"
                      style={{ color: accentColor }}>
                      {cat.completedLevels}/{cat.totalLevels}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: accentColor }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}