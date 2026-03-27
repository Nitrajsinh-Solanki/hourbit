// app/dashboard/profile/_components/ProfileTabs.tsx
"use client";

import { BarChart3, LockKeyhole, UserRound } from "lucide-react";

type Props = {
  activeTab: "basic" | "security" | "insights";
  setActiveTab: (tab: "basic" | "security" | "insights") => void;
};

const tabs = [
  {
    id: "basic" as const,
    label: "Basic Info",
    icon: UserRound,
  },
  {
    id: "security" as const,
    label: "Security",
    icon: LockKeyhole,
  },
  {
    id: "insights" as const,
    label: "My Insights",
    icon: BarChart3,
  },
];

export default function ProfileTabs({ activeTab, setActiveTab }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group rounded-2xl border px-4 py-4 text-left transition-all ${
              isActive
                ? "border-neutral-900 bg-neutral-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 bg-white/80 text-neutral-700 hover:border-black/20 hover:bg-white dark:border-white/10 dark:bg-[#11131a] dark:text-neutral-300 dark:hover:border-white/20 dark:hover:bg-[#151922]"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2 ${
                  isActive
                    ? "bg-white/15 dark:bg-black/10"
                    : "bg-neutral-100 dark:bg-white/[0.05]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">{tab.label}</p>
                <p
                  className={`mt-1 text-xs ${
                    isActive
                      ? "text-white/80 dark:text-black/70"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {tab.id === "basic" && "Manage profile details"}
                  {tab.id === "security" && "Password and protection"}
                  {tab.id === "insights" && "Your personal analytics"}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}