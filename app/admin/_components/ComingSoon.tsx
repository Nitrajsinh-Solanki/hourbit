// app/admin/_components/ComingSoon.tsx
"use client";

import { Construction } from "lucide-react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
          {description}
        </p>
      </div>

      {/* Coming soon banner */}
      <div
        className="rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center"
        style={{
          background: "var(--surface)",
          border:     "1px dashed var(--border2)",
          minHeight:  "320px",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(232,67,147,0.12)" }}
        >
          <Construction size={30} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            Coming Soon
          </h2>
          <p className="text-[13px] mt-1 max-w-sm" style={{ color: "var(--text3)" }}>
            This section is under development. Full functionality will be added in the next build.
          </p>
        </div>
        <span
          className="text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full"
          style={{
            color:      "var(--accent)",
            background: "rgba(232,67,147,0.10)",
            border:     "1px solid rgba(232,67,147,0.25)",
          }}
        >
          🚧 In Progress
        </span>
      </div>
    </div>
  );
}