// app/dashboard/profile/_components/ProfileTabs.tsx
"use client";

import { BarChart3, LockKeyhole, UserRound, Monitor } from "lucide-react";

type Props = {
  activeTab: "basic" | "security" | "insights" | "sessions";
  setActiveTab: (tab: "basic" | "security" | "insights" | "sessions") => void;
};

const TABS = [
  { id: "basic" as const, label: "Basic Info", icon: UserRound },
  { id: "security" as const, label: "Security", icon: LockKeyhole },
  { id: "sessions" as const, label: "Sessions", icon: Monitor },
  { id: "insights" as const, label: "Insights", icon: BarChart3 },
];

export default function ProfileTabs({ activeTab, setActiveTab }: Props) {
  return (
    <div
      className="w-full overflow-x-auto no-scrollbar"
    >
      <div
        className="flex gap-2 p-1.5 rounded-2xl min-w-max"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border2)",
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer`}
              style={{
                background: active
                  ? "linear-gradient(135deg, rgba(124,110,243,0.22), rgba(124,110,243,0.10))"
                  : "transparent",
                color: active ? "var(--text)" : "var(--text3)",
                border: active
                  ? "1px solid rgba(124,110,243,0.35)"
                  : "1px solid transparent",
              }}
            >
              <Icon
                size={16}
                style={{
                  color: active ? "var(--accent)" : "var(--text4)",
                }}
              />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}