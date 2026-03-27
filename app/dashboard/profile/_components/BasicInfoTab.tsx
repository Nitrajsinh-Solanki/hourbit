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
  BriefcaseBusiness,
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          companyName,
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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      {/* LEFT COLUMN */}
      <div className="space-y-5">
        {/* FORM */}
        <section
          className="rounded-[22px] p-5 sm:p-6"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
          }}
        >
          <div className="flex justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text3)" }}>
                Personal Details
              </p>
              <h3 className="mt-1 text-base font-semibold" style={{ color: "var(--text)" }}>
                Basic profile information
              </h3>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs"
              style={{
                background: "rgba(124,110,243,0.10)",
                color: "var(--accent)",
                border: "1px solid rgba(124,110,243,0.18)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Synced
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <InputField label="Full Name" icon={<User2 className="h-4 w-4" />}>
              <input
                value={form.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </InputField>

            <InputField label="Company" icon={<Building2 className="h-4 w-4" />}>
              <input
                value={form.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </InputField>

            <div className="md:col-span-2">
              <InputField label="Email" icon={<Mail className="h-4 w-4" />}>
                <input
                  value={form.email}
                  disabled
                  className="w-full rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border2)",
                    color: "var(--text3)",
                  }}
                />
              </InputField>
            </div>

            {/* READ ONLY WORK HOURS */}
            <div className="md:col-span-2">
              <div
                className="rounded-[18px] p-4"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border2)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(124,110,243,0.10)",
                      border: "1px solid rgba(124,110,243,0.16)",
                      color: "var(--accent)",
                    }}
                  >
                    <Clock3 className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-[11px] uppercase" style={{ color: "var(--text3)" }}>
                      Default Work Hours
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {user.defaultWorkHours ?? 8.5} hrs/day
                    </p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      Managed by system (not editable yet)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACTION */}
        <section
          className="rounded-[22px] p-4"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
          }}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Save changes
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleReset} disabled={!isDirty || saving}>
                <Undo2 />
              </button>

              <button onClick={handleSave} disabled={!isDirty || saving}>
                <Save />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT */}
      <div className="space-y-5">
        <section
          className="rounded-[22px] p-5"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
          }}
        >
          <SummaryCard label="Name" value={form.fullName} />
          <SummaryCard label="Email" value={form.email} />
          <SummaryCard label="Company" value={form.companyName || "Not set"} />
          <SummaryCard
            label="Work Hours"
            value={`${user.defaultWorkHours ?? 8.5} hrs/day`}
          />
        </section>
      </div>
    </div>
  );
}

function InputField({
  label,
  icon,
  children,
}: any) {
  return (
    <div>
      <label style={{ color: "var(--text2)" }} className="flex gap-2 mb-2">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }: any) {
  return (
    <div style={{ color: "var(--text)" }} className="mb-3">
      <p style={{ color: "var(--text3)" }}>{label}</p>
      <p>{value}</p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border2)",
  color: "var(--text)",
};