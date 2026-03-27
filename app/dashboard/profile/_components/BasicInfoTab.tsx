// app/dashboard/profile/_components/BasicInfoTab.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Mail, Save, Undo2, User2 } from "lucide-react";
import { toast } from "react-hot-toast";
import type { ProfileUser } from "../page";

export default function BasicInfoTab({
  user,
  setUser,
}: {
  user: ProfileUser;
  setUser: (user: ProfileUser) => void;
}) {
  const [form, setForm] = useState({
    fullName: user.fullName || "",
    email: user.email || "",
    companyName: user.companyName || "",
    defaultWorkHours: String(user.defaultWorkHours ?? 8.5),
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      fullName: user.fullName || "",
      email: user.email || "",
      companyName: user.companyName || "",
      defaultWorkHours: String(user.defaultWorkHours ?? 8.5),
    });
  }, [user]);

  const initialSnapshot = useMemo(
    () => ({
      fullName: user.fullName || "",
      email: user.email || "",
      companyName: user.companyName || "",
      defaultWorkHours: String(user.defaultWorkHours ?? 8.5),
    }),
    [user]
  );

  const isDirty =
    form.fullName !== initialSnapshot.fullName ||
    form.companyName !== initialSnapshot.companyName ||
    form.defaultWorkHours !== initialSnapshot.defaultWorkHours;

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setForm(initialSnapshot);
  };

  const handleSave = async () => {
    const fullName = form.fullName.trim();
    const companyName = form.companyName.trim();
    const defaultWorkHours = Number(form.defaultWorkHours);

    if (fullName.length < 2 || fullName.length > 60) {
      toast.error("Full name must be between 2 and 60 characters.");
      return;
    }

    if (companyName.length > 100) {
      toast.error("Company name cannot exceed 100 characters.");
      return;
    }

    if (
      !Number.isFinite(defaultWorkHours) ||
      defaultWorkHours < 0 ||
      defaultWorkHours > 24
    ) {
      toast.error("Default work hours must be between 0 and 24.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          companyName,
          defaultWorkHours,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update profile");
      }

      setUser(data.user);
      toast.success(data.message || "Profile updated successfully.");
    } catch (err: any) {
      console.error("PROFILE_UPDATE_ERROR:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      {/* Left Form */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-black/10 bg-neutral-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Personal Details
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <User2 className="h-4 w-4" />
                Full Name
              </label>
              <input
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-white/10 dark:bg-[#0f1117] dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white/20 dark:focus:ring-white/10"
              />
            </div>

            {/* Email */}
            <div className="md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Mail className="h-4 w-4" />
                Email Address
              </label>
              <input
                value={form.email}
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-black/10 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 outline-none dark:border-white/10 dark:bg-[#0d0f14] dark:text-neutral-500"
              />
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Your registered email cannot be changed from here.
              </p>
            </div>

            {/* Company Name */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Building2 className="h-4 w-4" />
                Company Name
              </label>
              <input
                value={form.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Enter company name"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-white/10 dark:bg-[#0f1117] dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white/20 dark:focus:ring-white/10"
              />
            </div>

            {/* Default Work Hours */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                <Clock3 className="h-4 w-4" />
                Default Work Hours
              </label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={form.defaultWorkHours}
                onChange={(e) => handleChange("defaultWorkHours", e.target.value)}
                placeholder="e.g. 8.5"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-white/10 dark:bg-[#0f1117] dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-white/20 dark:focus:ring-white/10"
              />
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Used as your default daily target across work tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-neutral-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              Save your profile changes
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Changes will immediately apply across your account.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0f1117] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
            >
              <Undo2 className="h-4 w-4" />
              Reset
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Right Summary Panel */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-black/10 bg-neutral-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
            Profile Summary
          </h3>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#0f1117]">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Name
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">
                {form.fullName || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#0f1117]">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Email
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-neutral-900 dark:text-white">
                {form.email || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#0f1117]">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Company
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">
                {form.companyName || "Not set"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-[#0f1117]">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Default Work Hours
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">
                {form.defaultWorkHours || "8.5"} hrs / day
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Why this matters
          </h4>
          <p className="mt-2 text-sm leading-6 text-blue-700 dark:text-blue-200/90">
            Your profile settings help personalize work tracking and keep your account
            details consistent across HourBit.
          </p>
        </div>
      </div>
    </div>
  );
}