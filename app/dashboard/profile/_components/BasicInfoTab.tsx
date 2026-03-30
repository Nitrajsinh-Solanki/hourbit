// app/dashboard/profile/_components/BasicInfoTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Clock3,
  Mail,
  Save,
  Undo2,
  User2,
  Sparkles,
  Info,
} from "lucide-react";
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
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      fullName: user.fullName || "",
      email: user.email || "",
      companyName: user.companyName || "",
    });
  }, [user]);

  const initialSnapshot = useMemo(
    () => ({
      fullName: user.fullName || "",
      email: user.email || "",
      companyName: user.companyName || "",
    }),
    [user]
  );

  const isDirty =
    form.fullName !== initialSnapshot.fullName ||
    form.companyName !== initialSnapshot.companyName;

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => setForm(initialSnapshot);

  const handleSave = async () => {
    const fullName = form.fullName.trim();
    const companyName = form.companyName.trim();

    if (fullName.length < 2 || fullName.length > 60) {
      toast.error("Full name must be between 2 and 60 characters.");
      return;
    }
    if (companyName.length > 100) {
      toast.error("Company name cannot exceed 100 characters.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, companyName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update profile");
      setUser(data.user);
      toast.success(data.message || "Profile updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

      {/* ── LEFT: editable form ── */}
      <div className="space-y-4">

        {/* Form card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          {/* Card header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border2)" }}
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
                Personal Details
              </p>
              <h3 className="text-base font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                Basic Information
              </h3>
            </div>
            <div
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
              style={{
                background: "rgba(124,110,243,0.10)",
                color: "var(--accent)",
                border: "1px solid rgba(124,110,243,0.20)",
              }}
            >
              <Sparkles className="w-3 h-3" />
              Synced
            </div>
          </div>

          {/* Form body */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Full name */}
            <Field label="Full Name" icon={<User2 className="w-4 h-4" />}>
              <input
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(124,110,243,0.5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,110,243,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border2)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </Field>

            {/* Company */}
            <Field label="Company" icon={<Building2 className="w-4 h-4" />}>
              <input
                value={form.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Your company name"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(124,110,243,0.5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,110,243,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border2)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </Field>

            {/* Email — read only */}
            <div className="sm:col-span-2">
              <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                <div className="relative">
                  <input
                    value={form.email}
                    disabled
                    className="w-full rounded-xl px-4 py-3 text-sm pr-12"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border2)",
                      color: "var(--text3)",
                      cursor: "not-allowed",
                    }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1"
                    style={{
                      background: "var(--surface)",
                      color: "var(--text4)",
                      border: "1px solid var(--border2)",
                    }}
                  >
                    Locked
                  </span>
                </div>
              </Field>
            </div>

            {/* Work hours — read only info */}
            <div className="sm:col-span-2">
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border2)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(34,211,160,0.10)", color: "var(--green)" }}
                >
                  <Clock3 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text4)" }}>
                    Default Work Hours
                  </p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                    {user.defaultWorkHours ?? 8.5} hrs/day
                  </p>
                </div>
                <div className="flex items-center gap-1.5" style={{ color: "var(--text4)" }}>
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-xs">System managed</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Action bar ── */}
        <div
          className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
          style={{
            background: "var(--surface)",
            border: isDirty ? "1px solid rgba(124,110,243,0.30)" : "1px solid var(--border2)",
            transition: "border-color 0.2s",
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: isDirty ? "var(--text)" : "var(--text3)" }}>
              {isDirty ? "You have unsaved changes" : "No changes to save"}
            </p>
            {isDirty && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text4)" }}>
                Click Save to apply your updates
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReset}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer border-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--surface2)",
                color: "var(--text2)",
                border: "1px solid var(--border2)",
              }}
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer border-none transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isDirty ? "var(--accent)" : "var(--surface2)",
                color: isDirty ? "#fff" : "var(--text3)",
                boxShadow: isDirty ? "0 4px 16px rgba(124,110,243,0.30)" : "none",
                transition: "all 0.2s",
              }}
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

      </div>

      {/* ── RIGHT: live preview card ── */}
      <div className="space-y-4">

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: "1px solid var(--border2)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
              Live Preview
            </p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text)" }}>
              Your current profile
            </p>
          </div>

          <div className="p-5 space-y-3">
            {[
              { label: "Full Name", value: form.fullName || "—" },
              { label: "Email", value: form.email || "—" },
              { label: "Company", value: form.companyName || "Not set" },
              { label: "Work Hours", value: `${user.defaultWorkHours ?? 8.5} hrs/day` },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text4)" }}>
                  {label}
                </span>
                <span className="text-sm font-medium text-right break-all" style={{ color: "var(--text)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips card */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: "rgba(124,110,243,0.06)",
            border: "1px solid rgba(124,110,243,0.18)",
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            💡 Tips
          </p>
          <ul className="space-y-1.5">
            {[
              "Your name is shown in the dashboard sidebar.",
              "Company name helps identify your workspace.",
              "Email cannot be changed for security reasons.",
            ].map((tip, i) => (
              <li key={i} className="text-xs leading-5" style={{ color: "var(--text3)" }}>
                · {tip}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text3)" }}
      >
        <span style={{ color: "var(--text4)" }}>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}