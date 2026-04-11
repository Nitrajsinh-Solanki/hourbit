// app/dashboard/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";
import ProfileHeader  from "./_components/ProfileHeader";
import ProfileTabs    from "./_components/ProfileTabs";
import BasicInfoTab   from "./_components/BasicInfoTab";
import SecurityTab    from "./_components/SecurityTab";
import InsightsTab    from "./_components/InsightsTab";
import SessionsTab    from "./_components/SessionsTab";

export type ProfileUser = {
  fullName: string;
  email: string;
  companyName?: string;
  defaultWorkHours?: number;
  role?: string;
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"basic" | "security" | "insights" | "sessions">("basic");
  const [user, setUser]           = useState<ProfileUser | null>(null);
  const [loading, setLoading]     = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/auth/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load profile");
      setUser(data.user);
    } catch (err: any) {
      toast.error(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,110,243,0.12)", border: "1px solid rgba(124,110,243,0.22)" }}
          >
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Loading profile</p>
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>Fetching your account data…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── error ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="max-w-2xl">
        <div
          className="rounded-2xl p-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
          style={{ background: "var(--surface)", border: "1px solid rgba(248,113,113,0.22)" }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.20)" }}
            >
              <ShieldAlert className="h-5 w-5" style={{ color: "var(--danger)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Failed to load profile
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: "var(--text3)" }}>
                We couldn't fetch your profile data. This can happen due to an expired session or a temporary API failure.
              </p>
            </div>
          </div>
          <button
            onClick={fetchProfile}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── main ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* heading */}
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-widest mb-1"
          style={{ color: "var(--accent)" }}
        >
          Account Settings
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Profile
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
          Manage your personal details, security preferences, and account insights.
        </p>
      </div>

      {/* header card */}
      <ProfileHeader user={user} />

      {/* tabs */}
      <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* tab content */}
      {activeTab === "basic" && (
        <BasicInfoTab user={user} setUser={setUser} />
      )}
      {activeTab === "security" && (
        <SecurityTab email={user.email} />
      )}
      {activeTab === "sessions" && (
        <SessionsTab userEmail={user.email} />
      )}
      {activeTab === "insights" && (
        <InsightsTab />
      )}

    </div>
  );
}