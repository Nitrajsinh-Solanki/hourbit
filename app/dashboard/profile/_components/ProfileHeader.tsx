// app/dashboard/profile/_components/ProfileHeader.tsx

"use client";

import { BadgeCheck, Building2, Clock3, Mail, Shield } from "lucide-react";
import type { ProfileUser } from "../page";

export default function ProfileHeader({ user }: { user: ProfileUser }) {
  const initials = (user.fullName || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#11131a]">
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
        {/* Avatar */}
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-900 text-2xl font-bold text-white shadow-sm dark:bg-white dark:text-black">
          {initials}
        </div>

        {/* Main Info */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {user.fullName || "Unnamed User"}
            </h2>

            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              <BadgeCheck className="h-3.5 w-3.5" />
              Active Account
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-neutral-600 sm:grid-cols-2 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{user.email}</span>
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{user.companyName || "No company set"}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span>{user.defaultWorkHours ?? 8.5} hrs / day default</span>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="capitalize">{user.role || "employee"} account</span>
            </div>
          </div>
        </div>

        {/* Right Meta */}
        <div className="rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Account Status
          </p>
          <p className="mt-1 font-semibold text-neutral-900 dark:text-white">
            Healthy & Ready
          </p>
        </div>
      </div>
    </div>
  );
}