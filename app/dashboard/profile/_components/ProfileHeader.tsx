// app/dashboard/profile/_components/ProfileHeader.tsx
"use client";

import {
  BadgeCheck,
  Building2,
  BriefcaseBusiness,
  Clock3,
  Mail,
  Shield,
} from "lucide-react";
import type { ProfileUser } from "../page";

export default function ProfileHeader({ user }: { user: ProfileUser }) {
  const initials = (user.fullName || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="overflow-hidden rounded-[24px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border2)",
      }}
    >
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        {/* Avatar Block */}
        <div className="flex items-center gap-4 lg:block">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] text-2xl font-bold shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 65%, #ffffff 35%))",
              color: "#ffffff",
              border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent 45%)",
            }}
          >
            {initials}
          </div>

          <div className="lg:hidden">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text3)" }}
            >
              Identity
            </p>
            <p
              className="mt-1 text-base font-semibold"
              style={{ color: "var(--text)" }}
            >
              {user.fullName || "Unnamed User"}
            </p>
          </div>
        </div>

        {/* Main Info */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              className="hidden text-[28px] font-bold tracking-tight leading-tight lg:block"
              style={{ color: "var(--text)" }}
            >
              {user.fullName || "Unnamed User"}
            </h2>

            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: "rgba(34,197,94,0.10)",
                color: "var(--green)",
                border: "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Active Account
            </div>
          </div>

          <p
            className="mt-2 text-sm leading-6"
            style={{ color: "var(--text3)" }}
          >
            Your account details and working preferences are shown here for quick access.
          </p>

          {/* Info Grid */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoChip
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={user.email || "—"}
            />

            <InfoChip
              icon={<Building2 className="h-4 w-4" />}
              label="Company"
              value={user.companyName || "Not set"}
            />

            <InfoChip
              icon={<Clock3 className="h-4 w-4" />}
              label="Default Hours"
              value={`${user.defaultWorkHours ?? 8.5} hrs/day`}
            />

            <InfoChip
              icon={<Shield className="h-4 w-4" />}
              label="Role"
              value={`${user.role || "employee"} account`}
            />
          </div>
        </div>

        {/* Right Meta Panel */}
        <div
          className="rounded-[22px] p-4 sm:p-5 lg:min-w-[220px]"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--text3)" }}
              >
                Account Status
              </p>

              <p
                className="mt-2 text-base font-semibold"
                style={{ color: "var(--text)" }}
              >
                Healthy & Ready
              </p>

              <p
                className="mt-1 text-sm leading-6"
                style={{ color: "var(--text3)" }}
              >
                Your profile is active and available across HourBit.
              </p>
            </div>

            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(124,110,243,0.10)",
                border: "1px solid rgba(124,110,243,0.16)",
              }}
            >
              <BriefcaseBusiness
                className="h-4.5 w-4.5"
                style={{ color: "var(--accent)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-[18px] px-4 py-3"
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border2)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(124,110,243,0.10)",
            border: "1px solid rgba(124,110,243,0.14)",
            color: "var(--accent)",
          }}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text3)" }}
          >
            {label}
          </p>

          <p
            className="mt-1 truncate text-sm font-semibold"
            style={{ color: "var(--text)" }}
            title={value}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}