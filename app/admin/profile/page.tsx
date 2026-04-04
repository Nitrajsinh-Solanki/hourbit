// app/admin/profile/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  KeyRound,
  Monitor,
  Trash2,
  ShieldBan,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  MailCheck,
  CheckCircle2,
  Loader2,
  Timer,
  LogOut,
  Laptop,
  Smartphone,
  Globe,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Session = {
  deviceId:  string;
  ipAddress: string;
  userAgent: string;
  lastLogin: string | null;
  isBanned:  boolean;
  banReason: string;
  isCurrent: boolean;
};

type PasswordStep = "form" | "otp" | "done";

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown hook
// ─────────────────────────────────────────────────────────────────────────────

function useCooldown(initial = 0) {
  const [remaining, setRemaining] = useState(initial);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = (seconds: number) => {
    setRemaining(seconds);
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(ref.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  useEffect(() => () => { if (ref.current) clearInterval(ref.current); }, []);
  return { remaining, start };
}

// ─────────────────────────────────────────────────────────────────────────────
// PasswordInput helper
// ─────────────────────────────────────────────────────────────────────────────

function PasswordInput({
  label, value, onChange, placeholder, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text3)" }}
      >
        <KeyRound className="w-3 h-3" style={{ color: "var(--accent)" }} />
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder ?? "••••••••"}
          className="w-full rounded-xl py-2.5 pl-4 pr-10 text-sm outline-none transition-all disabled:opacity-60"
          style={{
            background: "var(--surface2)",
            border:     "1px solid var(--border2)",
            color:      "var(--text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(232,67,147,0.55)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(232,67,147,0.08)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border2)";
            e.currentTarget.style.boxShadow   = "none";
          }}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          disabled={disabled}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-0.5 border-none bg-transparent cursor-pointer disabled:opacity-40"
          style={{ color: "var(--text3)" }}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP Boxes
// ─────────────────────────────────────────────────────────────────────────────

function OtpBoxes({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ""; }
      else if (i > 0) { next[i - 1] = ""; inputs.current[i - 1]?.focus(); }
      onChange(next.join(""));
    }
    if (e.key === "ArrowLeft"  && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleChange = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char || "";
    onChange(next.join(""));
    if (char && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="text-center font-mono font-bold text-lg outline-none transition-all disabled:opacity-50"
          style={{
            width: "44px", height: "52px",
            borderRadius: "10px",
            background:   d ? "rgba(232,67,147,0.12)" : "var(--surface2)",
            border:       d ? "1.5px solid rgba(232,67,147,0.45)" : "1.5px solid var(--border2)",
            color:        "var(--text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(232,67,147,0.6)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(232,67,147,0.10)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = d ? "rgba(232,67,147,0.45)" : "var(--border2)";
            e.currentTarget.style.boxShadow   = "none";
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect device type from user-agent string
// ─────────────────────────────────────────────────────────────────────────────

function getDeviceIcon(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone size={14} />;
  }
  return <Laptop size={14} />;
}

function getDeviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "Mobile";
  if (ua.includes("tablet") || ua.includes("ipad")) return "Tablet";
  return "Desktop";
}

function getBrowserFromUA(userAgent: string): string {
  if (!userAgent || userAgent === "Unknown") return "Unknown browser";
  if (userAgent.includes("Chrome"))  return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari"))  return "Safari";
  if (userAgent.includes("Edge"))    return "Edge";
  if (userAgent.includes("Opera"))   return "Opera";
  return userAgent.slice(0, 40);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions Tab
// ─────────────────────────────────────────────────────────────────────────────

function SessionsTab({ adminEmail }: { adminEmail: string }) {
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actionId,   setActionId]   = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/profile/sessions");
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
      else toast.error(data.message || "Failed to load sessions");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleDelete = async (deviceId: string) => {
    if (!confirm("Remove this session? The device will be logged out.")) return;
    setActionId(deviceId);
    try {
      const res  = await fetch("/api/admin/profile/sessions", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Session removed");
        setSessions((prev) => prev.filter((s) => s.deviceId !== deviceId));
      } else {
        toast.error(data.message || "Failed to remove session");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Remove ALL other sessions? Those devices will be logged out.")) return;
    setActionId("all");
    try {
      const res  = await fetch("/api/admin/profile/sessions", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deviceId: "all" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("All other sessions removed");
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      } else {
        toast.error(data.message || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionId(null);
    }
  };

  const handleBan = async (deviceId: string, ban: boolean) => {
    setActionId(deviceId + "_ban");
    try {
      const res  = await fetch("/api/admin/profile/sessions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deviceId, ban }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(ban ? "Session banned" : "Session unbanned");
        setSessions((prev) =>
          prev.map((s) =>
            s.deviceId === deviceId ? { ...s, isBanned: ban } : s
          )
        );
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionId(null);
    }
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  return (
    <div className="flex flex-col gap-5">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>
            Active Sessions
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
            Logged-in devices for <span style={{ color: "var(--accent)" }}>{adminEmail}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {otherSessions.length > 1 && (
            <button
              onClick={handleDeleteAll}
              disabled={actionId === "all"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}
            >
              <LogOut size={13} />
              Remove All Other Sessions
            </button>
          )}
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : sessions.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-14 gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <Monitor size={30} style={{ color: "var(--text4)" }} />
          <p className="text-[13px]" style={{ color: "var(--text3)" }}>No sessions found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">

          {/* Current session */}
          {currentSession && (
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text4)" }}>
                Current Session
              </p>
              <div
                className="rounded-2xl p-4 flex items-start justify-between gap-4"
                style={{
                  background: "rgba(34,211,160,0.06)",
                  border:     "1px solid rgba(34,211,160,0.25)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}
                  >
                    {getDeviceIcon(currentSession.userAgent)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                        {getDeviceLabel(currentSession.userAgent)} · {getBrowserFromUA(currentSession.userAgent)}
                      </span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}
                      >
                        ● This Session
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                        <Globe size={10} /> {currentSession.ipAddress}
                      </span>
                      {currentSession.lastLogin && (
                        <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                          Last active: {new Date(currentSession.lastLogin).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other sessions */}
          {otherSessions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-2 mt-1" style={{ color: "var(--text4)" }}>
                Other Sessions ({otherSessions.length})
              </p>
              <div className="flex flex-col gap-2.5">
                {otherSessions.map((session) => (
                  <div
                    key={session.deviceId}
                    className="rounded-2xl p-4 flex items-start justify-between gap-4"
                    style={{
                      background: session.isBanned
                        ? "rgba(248,113,113,0.05)"
                        : "var(--surface)",
                      border: session.isBanned
                        ? "1px solid rgba(248,113,113,0.28)"
                        : "1px solid var(--border2)",
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: session.isBanned
                            ? "rgba(248,113,113,0.12)"
                            : "var(--surface2)",
                          color: session.isBanned ? "#f87171" : "var(--text3)",
                        }}
                      >
                        {getDeviceIcon(session.userAgent)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                            {getDeviceLabel(session.userAgent)} · {getBrowserFromUA(session.userAgent)}
                          </span>
                          {session.isBanned && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
                            >
                              🚫 Banned
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                            <Globe size={10} /> {session.ipAddress}
                          </span>
                          {session.lastLogin && (
                            <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
                              Last: {new Date(session.lastLogin).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {session.isBanned && session.banReason && (
                          <p className="text-[11px] font-mono mt-1" style={{ color: "#f87171" }}>
                            Reason: {session.banReason}
                          </p>
                        )}
                        <p
                          className="text-[10px] font-mono mt-1 truncate"
                          style={{ color: "var(--text4)", maxWidth: "340px" }}
                          title={session.userAgent}
                        >
                          {session.userAgent?.slice(0, 80)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Ban / Unban */}
                      {session.isBanned ? (
                        <button
                          onClick={() => handleBan(session.deviceId, false)}
                          disabled={actionId === session.deviceId + "_ban"}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
                          style={{ background: "rgba(34,211,160,0.12)", color: "#22d3a0" }}
                        >
                          {actionId === session.deviceId + "_ban"
                            ? <Loader2 size={11} className="animate-spin" />
                            : <ShieldCheck size={11} />}
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(session.deviceId, true)}
                          disabled={actionId === session.deviceId + "_ban"}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
                          style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}
                        >
                          {actionId === session.deviceId + "_ban"
                            ? <Loader2 size={11} className="animate-spin" />
                            : <ShieldBan size={11} />}
                          Ban
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(session.deviceId)}
                        disabled={actionId === session.deviceId}
                        className="w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer transition-all disabled:opacity-50"
                        style={{ background: "var(--surface2)", color: "var(--text4)" }}
                        title="Remove session"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.12)";
                          (e.currentTarget as HTMLElement).style.color = "#f87171";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
                          (e.currentTarget as HTMLElement).style.color = "var(--text4)";
                        }}
                      >
                        {actionId === session.deviceId
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherSessions.length === 0 && currentSession && (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-10 gap-2"
              style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
            >
              <ShieldCheck size={24} style={{ color: "var(--green)" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--text3)" }}>
                No other active sessions
              </p>
              <p className="text-[12px]" style={{ color: "var(--text4)" }}>
                You're only logged in from this device.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Password Tab
// ─────────────────────────────────────────────────────────────────────────────

function ChangePasswordTab() {
  const [step,            setStep]            = useState<PasswordStep>("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp,             setOtp]             = useState("");
  const [loading,         setLoading]         = useState(false);
  const cooldown = useCooldown();

  // Strength calculation
  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8)   s++;
    if (newPassword.length >= 12)  s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "#f87171", "#fbbf24", "#fbbf24", "#22d3a0", "#22d3a0"][strength];

  const handleSendOtp = async () => {
    if (!currentPassword.trim()) { toast.error("Enter your current password."); return; }
    if (!newPassword.trim())     { toast.error("Enter a new password."); return; }
    if (newPassword.length < 8)  { toast.error("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords don't match."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "send-otp", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "OTP sent to your email.");
        setStep("otp");
        cooldown.start(60);
      } else {
        if (data.cooldownRemaining) cooldown.start(data.cooldownRemaining);
        toast.error(data.message || "Failed to send OTP.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown.remaining > 0) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "send-otp", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("OTP resent.");
        cooldown.start(60);
      } else {
        if (data.cooldownRemaining) cooldown.start(data.cooldownRemaining);
        toast.error(data.message || "Could not resend OTP.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) { toast.error("Enter the 6-digit OTP."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "change-password", otp, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("done");
      } else {
        toast.error(data.message || "OTP verification failed.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("form");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  // ── Done state ──────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(34,211,160,0.12)" }}
        >
          <CheckCircle2 size={30} style={{ color: "var(--green)" }} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>
            Password Changed!
          </h3>
          <p className="text-[13px] mt-1.5" style={{ color: "var(--text3)" }}>
            Your admin password has been updated successfully. All other sessions remain active.
          </p>
        </div>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
          style={{ background: "var(--surface2)", color: "var(--text2)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(232,67,147,0.12)";
            (e.currentTarget as HTMLElement).style.color      = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface2)";
            (e.currentTarget as HTMLElement).style.color      = "var(--text2)";
          }}
        >
          Change Password Again
        </button>
      </div>
    );
  }

  // ── OTP step ────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="flex flex-col gap-6 max-w-md mx-auto py-4">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(232,67,147,0.12)" }}
          >
            <MailCheck size={26} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>
              Verify Your Email
            </h3>
            <p className="text-[12px] mt-1" style={{ color: "var(--text3)" }}>
              A 6-digit OTP was sent to your registered admin email. Enter it below to confirm the password change.
            </p>
          </div>
        </div>

        {/* OTP boxes */}
        <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />

        {/* Expiry info */}
        <div
          className="flex items-center justify-center gap-1.5 text-[12px] font-mono"
          style={{ color: "var(--text4)" }}
        >
          <Timer size={12} />
          OTP valid for 10 minutes
        </div>

        {/* Submit */}
        <button
          onClick={handleVerifyOtp}
          disabled={loading || otp.length < 6}
          className="w-full py-3 rounded-xl text-[14px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
          style={{
            background: "var(--accent)",
            color:      "#fff",
            boxShadow:  "0 0 18px rgba(232,67,147,0.28)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Verifying…
            </span>
          ) : "Confirm Password Change"}
        </button>

        {/* Resend & back */}
        <div className="flex items-center justify-between text-[12px]">
          <button
            onClick={handleResend}
            disabled={loading || cooldown.remaining > 0}
            className="font-medium border-none bg-transparent cursor-pointer disabled:opacity-50 transition-all"
            style={{ color: "var(--accent)" }}
          >
            {cooldown.remaining > 0 ? `Resend in ${cooldown.remaining}s` : "Resend OTP"}
          </button>
          <button
            onClick={() => { setStep("form"); setOtp(""); }}
            className="border-none bg-transparent cursor-pointer transition-all"
            style={{ color: "var(--text3)" }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Form step ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-md">

      <div>
        <h2 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>
          Change Password
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text3)" }}>
          Verify your current password, then set a new one. An OTP will be sent to your email.
        </p>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-3 p-3.5 rounded-xl"
        style={{
          background: "rgba(245,158,11,0.07)",
          border:     "1px solid rgba(245,158,11,0.20)",
        }}
      >
        <AlertCircle size={14} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text3)" }}>
          After verifying your identity with an OTP, your password will be updated immediately.
          Other active sessions are <strong style={{ color: "var(--text)" }}>not</strong> logged out — manage them in the Sessions tab.
        </p>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-4">
        <PasswordInput
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter current password"
          disabled={loading}
        />

        <div className="h-px" style={{ background: "var(--border)" }} />

        <PasswordInput
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Min. 8 characters"
          disabled={loading}
        />

        {/* Strength bar */}
        {newPassword.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border2)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width:      `${(strength / 5) * 100}%`,
                    background: strengthColor,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold" style={{ color: strengthColor }}>
                {strengthLabel}
              </span>
            </div>
          </div>
        )}

        <PasswordInput
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter new password"
          disabled={loading}
        />

        {/* Mismatch indicator */}
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <p className="text-[11px]" style={{ color: "var(--danger)" }}>
            ✗ Passwords do not match
          </p>
        )}
        {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length > 0 && (
          <p className="text-[11px]" style={{ color: "var(--green)" }}>
            ✓ Passwords match
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSendOtp}
        disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
        className="w-full py-3 rounded-xl text-[14px] font-semibold border-none cursor-pointer transition-all disabled:opacity-50"
        style={{
          background: "var(--accent)",
          color:      "#fff",
          boxShadow:  "0 0 18px rgba(232,67,147,0.25)",
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Sending OTP…
          </span>
        ) : "Send OTP & Verify"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Profile Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "sessions" | "password";

export default function AdminProfilePage() {
  const [activeTab,   setActiveTab]   = useState<Tab>("sessions");
  const [adminEmail,  setAdminEmail]  = useState("");
  const [adminName,   setAdminName]   = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAdminEmail(d.user.email    || "");
          setAdminName( d.user.fullName || "Admin");
        }
      })
      .finally(() => setLoadingUser(false));
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "sessions", label: "Active Sessions", icon: <Monitor size={14} /> },
    { id: "password", label: "Change Password", icon: <KeyRound  size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
          My Profile
        </h1>
        <p className="text-[13px]" style={{ color: "var(--text3)" }}>
          Manage your active sessions and account security settings.
        </p>
      </div>

      {/* Admin identity card */}
      <div
        className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{
          background: "linear-gradient(135deg, rgba(232,67,147,0.10) 0%, rgba(96,165,250,0.07) 100%)",
          border:     "1px solid var(--border2)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl shrink-0"
          style={{ background: "rgba(232,67,147,0.15)", color: "var(--accent)" }}
        >
          {loadingUser ? "…" : (adminName.charAt(0).toUpperCase() || "A")}
        </div>
        <div>
          <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
            {loadingUser ? "Loading…" : adminName}
          </p>
          <p className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>
            {adminEmail}
          </p>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
            style={{
              background: "rgba(232,67,147,0.12)",
              color:      "var(--accent)",
              border:     "1px solid rgba(232,67,147,0.25)",
            }}
          >
            ⚡ Admin
          </span>
        </div>
      </div>

      {/* Tab strip */}
      <div
        className="flex gap-1.5 p-1.5 rounded-2xl"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border2)",
          width:      "fit-content",
        }}
      >
        {TABS.map(({ id, label, icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-150 border-none cursor-pointer"
              style={{
                background: active
                  ? "rgba(232,67,147,0.13)"
                  : "transparent",
                color:  active ? "var(--accent)" : "var(--text3)",
                border: active
                  ? "1px solid rgba(232,67,147,0.30)"
                  : "1px solid transparent",
              }}
            >
              <span style={{ color: active ? "var(--accent)" : "var(--text4)" }}>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border2)",
        }}
      >
        {activeTab === "sessions" && <SessionsTab adminEmail={adminEmail} />}
        {activeTab === "password" && <ChangePasswordTab />}
      </div>
    </div>
  );
}