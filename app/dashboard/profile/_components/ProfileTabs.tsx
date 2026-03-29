// app/dashboard/profile/_components/ProfileTabs.tsx
"use client";

import { BarChart3, LockKeyhole, UserRound } from "lucide-react";

type Props = {
  activeTab: "basic" | "security" | "insights";
  setActiveTab: (tab: "basic" | "security" | "insights") => void;
};

const TABS = [
  { id: "basic"    as const, label: "Basic Info", icon: UserRound  },
  { id: "security" as const, label: "Security",   icon: LockKeyhole },
  { id: "insights" as const, label: "Insights",   icon: BarChart3  },
];

export default function ProfileTabs({ activeTab, setActiveTab }: Props) {
  return (
    <div
      className="flex gap-1 p-1 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer border-none"
            style={{
              background: active
                ? "linear-gradient(135deg, rgba(124,110,243,0.18) 0%, rgba(124,110,243,0.08) 100%)"
                : "transparent",
              color:  active ? "var(--text)" : "var(--text3)",
              border: active ? "1px solid rgba(124,110,243,0.28)" : "1px solid transparent",
            }}
          >
            <Icon
              size={15}
              style={{ color: active ? "var(--accent)" : "var(--text4)" }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}