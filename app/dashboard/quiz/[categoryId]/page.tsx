// app/dashboard/quiz/[categoryId]/page.tsx
"use client";

import { useEffect, useState }     from "react";
import { useRouter, useParams }    from "next/navigation";
import { ChevronLeft, ChevronRight, Layers, Trophy, Lock } from "lucide-react";
import toast from "react-hot-toast";

type Subcategory = {
  _id:             string;
  name:            string;
  description:     string;
  totalLevels:     number;
  completedLevels: number;
};

export default function SubcategoryPage() {
  const router     = useRouter();
  const { categoryId } = useParams<{ categoryId: string }>();

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [categoryName,  setCategoryName]  = useState("");

  useEffect(() => {
    if (!categoryId) return;
    fetch(`/api/quiz/subcategories?categoryId=${categoryId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSubcategories(d.subcategories);
          setCategoryName(d.categoryName || "");
        } else {
          toast.error(d.message);
        }
      })
      .catch(() => toast.error("Failed to load subcategories"))
      .finally(() => setLoading(false));
  }, [categoryId]);

  return (
    <div className="flex flex-col gap-6">

      {/* Back + header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-mono mb-4 cursor-pointer border-none bg-transparent transition-colors"
          style={{ color: "var(--text3)" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
        >
          <ChevronLeft size={15} /> Back to Categories
        </button>

        <div className="rounded-2xl px-6 py-5"
          style={{
            background: "linear-gradient(135deg, rgba(124,110,243,0.10), rgba(34,211,160,0.06))",
            border:     "1px solid rgba(124,110,243,0.22)",
          }}>
          <h1 className="text-[20px] font-bold" style={{ color: "var(--text)" }}>
            {categoryName || "Subcategories"}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
            Select a subcategory to view its levels.
          </p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl h-36 animate-pulse"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)" }} />
          ))}
        </div>
      ) : subcategories.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
          <p className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
            No subcategories found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {subcategories.map(sub => {
            const pct = sub.totalLevels > 0
              ? Math.round((sub.completedLevels / sub.totalLevels) * 100)
              : 0;
            const isStarted    = sub.completedLevels > 0;
            const isFinished   = sub.completedLevels >= sub.totalLevels && sub.totalLevels > 0;

            return (
              <button
                key={sub._id}
                onClick={() => router.push(`/dashboard/quiz/${categoryId}/${sub._id}`)}
                className="rounded-2xl p-5 text-left flex flex-col gap-4 transition-all hover:-translate-y-0.5 cursor-pointer border-none"
                style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,110,243,0.40)";
                  (e.currentTarget as HTMLElement).style.background   = "var(--surface2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
                  (e.currentTarget as HTMLElement).style.background   = "var(--surface)";
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>
                      {sub.name}
                    </p>
                    {sub.description && (
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
                        {sub.description}
                      </p>
                    )}
                  </div>
                  {isFinished ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(34,211,160,0.15)", color: "var(--green)" }}>
                      DONE
                    </span>
                  ) : (
                    <ChevronRight size={16} style={{ color: "var(--text4)", marginTop: 2 }} />
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Layers size={12} style={{ color: "var(--text4)" }} />
                    <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                      {sub.totalLevels} levels
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy size={12} style={{ color: "var(--text4)" }} />
                    <span className="text-[11px] font-mono" style={{ color: "var(--text3)" }}>
                      {sub.completedLevels} completed
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                      {isStarted ? "Progress" : "Not started"}
                    </span>
                    <span className="text-[11px] font-mono font-semibold"
                      style={{ color: "var(--accent)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isFinished
                          ? "var(--green)"
                          : "linear-gradient(to right, var(--accent), var(--accent2))",
                      }} />
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