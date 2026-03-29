// app/dashboard/profile/_components/ProfileHeader.tsx
"use client";

import {
  BadgeCheck,
  Building2,
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

  const role = user.role || "employee";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border2)",
      }}
    >
      {/* Top accent strip */}
      <div
        style={{
          height: 4,
          background: "linear-gradient(90deg, var(--accent) 0%, var(--green) 100%)",
        }}
      />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">

          {/* ── Avatar ── */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, rgba(124,110,243,0.5) 100%)",
                color: "#fff",
                border: "2px solid rgba(124,110,243,0.3)",
                boxShadow: "0 8px 32px rgba(124,110,243,0.25)",
              }}
            >
              {initials}
            </div>
            {/* Online dot */}
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
              style={{
                background: "var(--green)",
                borderColor: "var(--surface)",
              }}
            />
          </div>

          {/* ── Identity ── */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold truncate" style={{ color: "var(--text)" }}>
                {user.fullName || "Unnamed User"}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: "rgba(34,211,160,0.10)",
                  color: "var(--green)",
                  border: "1px solid rgba(34,211,160,0.22)",
                }}
              >
                <BadgeCheck className="w-3 h-3" />
                Active
              </span>
            </div>

            <p className="text-sm mb-4" style={{ color: "var(--text3)" }}>
              {user.email}
            </p>

            {/* ── Info chips grid ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <InfoChip
                icon={<Mail className="w-3.5 h-3.5" />}
                label="Email"
                value={user.email || "—"}
                color="var(--accent)"
                bg="rgba(124,110,243,0.10)"
              />
              <InfoChip
                icon={<Building2 className="w-3.5 h-3.5" />}
                label="Company"
                value={user.companyName || "Not set"}
                color="#60a5fa"
                bg="rgba(96,165,250,0.10)"
              />
              <InfoChip
                icon={<Clock3 className="w-3.5 h-3.5" />}
                label="Daily Target"
                value={`${user.defaultWorkHours ?? 8.5} hrs`}
                color="var(--green)"
                bg="rgba(34,211,160,0.10)"
              />
              <InfoChip
                icon={<Shield className="w-3.5 h-3.5" />}
                label="Role"
                value={role.charAt(0).toUpperCase() + role.slice(1)}
                color="var(--amber)"
                bg="rgba(245,158,11,0.10)"
              />
            </div>
          </div>

          {/* ── Status pill (desktop right) ── */}
          <div
            className="hidden lg:flex flex-col items-end gap-2 shrink-0"
          >
            <div
              className="rounded-xl px-4 py-3 text-right"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                minWidth: 160,
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text4)" }}>
                Status
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
                Healthy & Ready
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
                All systems normal
              </p>
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
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border2)",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: bg, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
          {label}
        </p>
        <p className="text-xs font-semibold truncate mt-0.5" style={{ color: "var(--text)" }} title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}