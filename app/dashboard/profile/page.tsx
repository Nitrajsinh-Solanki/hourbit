// app/dashboard/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import ProfileHeader from "./_components/ProfileHeader";
import ProfileTabs from "./_components/ProfileTabs";
import BasicInfoTab from "./_components/BasicInfoTab";

export type ProfileUser = {
  fullName: string;
  email: string;
  companyName?: string;
  defaultWorkHours?: number;
  role?: string;
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"basic" | "security" | "insights">("basic");
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/auth/profile", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load profile");
      }

      setUser(data.user);
    } catch (err: any) {
      console.error("PROFILE_FETCH_ERROR:", err);
      toast.error(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-sm dark:border-white/10 dark:bg-[#11131a]">
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading profile...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <UserCircle2 className="mt-0.5 h-5 w-5 text-red-500" />
              <div>
                <h2 className="text-base font-semibold text-red-700 dark:text-red-300">
                  Failed to load profile
                </h2>
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  We couldn’t fetch your profile data. Please refresh and try again.
                </p>
                <button
                  onClick={fetchProfile}
                  className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Heading */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            Account
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Manage your personal information and account preferences.
          </p>
        </div>

        {/* Header */}
        <ProfileHeader user={user} />

        {/* Tabs */}
        <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content Card */}
        <div className="rounded-3xl border border-black/10 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#11131a]">
          <div className="border-b border-black/5 px-6 py-4 dark:border-white/5">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
              {activeTab === "basic" && "Basic Information"}
              {activeTab === "security" && "Security"}
              {activeTab === "insights" && "My Insights"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {activeTab === "basic" &&
                "Update your account details used across HourBit."}
              {activeTab === "security" &&
                "Password and account security settings will be available next."}
              {activeTab === "insights" &&
                "Your personal productivity and learning analytics will appear here."}
            </p>
          </div>

          <div className="p-6">
            {activeTab === "basic" && (
              <BasicInfoTab user={user} setUser={setUser} />
            )}

            {activeTab === "security" && (
              <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Security tab is coming next
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  We’ll implement your OTP-based password change flow here in the next step.
                </p>
              </div>
            )}

            {activeTab === "insights" && (
              <div className="rounded-2xl border border-dashed border-black/10 bg-neutral-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Insights tab is coming next
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  This section will show productivity, typing, diary, and quiz analytics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}