// app/dashboard/profile/page.tsx

"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert, UserCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import ProfileHeader  from "./_components/ProfileHeader";
import ProfileTabs    from "./_components/ProfileTabs";
import BasicInfoTab   from "./_components/BasicInfoTab";
import SecurityTab    from "./_components/SecurityTab";

export type ProfileUser = {
  fullName:         string;
  email:            string;
  companyName?:     string;
  defaultWorkHours?: number;
  role?:            string;
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"basic" | "security" | "insights">("basic");
  const [user,      setUser]      = useState<ProfileUser | null>(null);
  const [loading,   setLoading]   = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/auth/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load profile");
      setUser(data.user);
    } catch (err: any) {
      console.error("PROFILE_FETCH_ERROR:", err);
      toast.error(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div
            className="rounded-[24px] p-6 sm:p-7"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Loading profile
                </p>
                <p className="text-xs sm:text-sm" style={{ color: "var(--text3)" }}>
                  Fetching your account settings and preferences...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div
            className="rounded-[24px] p-6 sm:p-7"
            style={{ background: "var(--surface)", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.16)" }}
                >
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
                    Failed to load profile
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-6" style={{ color: "var(--text3)" }}>
                    We couldn't fetch your profile data right now. This can happen due to an
                    expired session, network issue, or a temporary API failure.
                  </p>
                </div>
              </div>

              <button
                onClick={fetchProfile}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer"
                style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN ──────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">

        {/* Page intro */}
        <div className="space-y-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Account Settings
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1
                className="text-[28px] sm:text-[32px] font-bold tracking-tight leading-[1.05]"
                style={{ color: "var(--text)" }}
              >
                Profile
              </h1>
              <p
                className="mt-2 max-w-2xl text-sm sm:text-[15px] leading-6"
                style={{ color: "var(--text3)" }}
              >
                Manage your personal details, security preferences, and future account
                insights — all in one place.
              </p>
            </div>

            <div
              className="inline-flex items-center gap-2 self-start rounded-xl px-3 py-2 text-xs font-medium"
              style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              <UserCircle2 className="h-4 w-4" />
              Personal Account Panel
            </div>
          </div>
        </div>

        {/* Header */}
        <ProfileHeader user={user} />

        {/* Tabs */}
        <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content shell */}
        <div
          className="overflow-hidden rounded-[24px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          {/* Section title bar */}
          <div
            className="px-5 py-4 sm:px-6 sm:py-5"
            style={{ borderBottom: "1px solid var(--border2)" }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>
                  {activeTab === "basic"    && "Basic Information"}
                  {activeTab === "security" && "Security"}
                  {activeTab === "insights" && "My Insights"}
                </h2>
                <p className="mt-1 text-sm leading-6" style={{ color: "var(--text3)" }}>
                  {activeTab === "basic"    && "Update the personal account details used throughout HourBit."}
                  {activeTab === "security" && "Change your password using a one-time OTP sent to your registered email."}
                  {activeTab === "insights" && "A future space for your work, typing, diary, and learning performance analytics."}
                </p>
              </div>

              <div
                className="self-start rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
              >
                {activeTab === "basic"    && "Editable"}
                {activeTab === "security" && "OTP Protected"}
                {activeTab === "insights" && "Upcoming"}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            {activeTab === "basic" && (
              <BasicInfoTab user={user} setUser={setUser} />
            )}

            {activeTab === "security" && (
              <SecurityTab email={user.email} />
            )}

            {activeTab === "insights" && (
              <div
                className="rounded-[22px] p-8 text-center"
                style={{ background: "var(--surface2)", border: "1px dashed var(--border2)" }}
              >
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.18)" }}
                >
                  <UserCircle2 className="h-6 w-6" style={{ color: "var(--green)" }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  Insights coming soon
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6" style={{ color: "var(--text3)" }}>
                  This section will show your productivity, typing, diary, and quiz
                  performance insights in a clean HourBit dashboard format.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}