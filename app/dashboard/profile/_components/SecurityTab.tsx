// app/dashboard/profile/_components/SecurityTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { toast } from "react-hot-toast";

type Step = "form" | "otp" | "done";

// ── Cooldown hook ─────────────────────────────────────────────────────────────
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

// ── Password input ────────────────────────────────────────────────────────────
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
            border: "1px solid var(--border2)",
            color: "var(--text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(124,110,243,0.55)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,110,243,0.08)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border2)";
            e.currentTarget.style.boxShadow = "none";
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

// ── OTP boxes — FIXED: compact squares, centered, never stretch ───────────────
function OtpBoxes({
  value, onChange, disabled,
}: {
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
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleChange = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char || "";
    onChange(next.join(""));
    if (char && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    /* KEY FIX: inline-flex so the group never stretches to full width */
    <div className="flex justify-center">
      <div className="inline-flex gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            /* KEY FIX: fixed pixel width + height, never auto */
            style={{
              width: 46,
              height: 52,
              flexShrink: 0,
              flexGrow: 0,
              borderRadius: 12,
              textAlign: "center",
              fontSize: 20,
              fontWeight: 700,
              outline: "none",
              transition: "all 0.15s",
              background: digit ? "rgba(124,110,243,0.12)" : "var(--surface2)",
              border: digit ? "2px solid rgba(124,110,243,0.55)" : "1.5px solid var(--border2)",
              color: "var(--text)",
              caretColor: "var(--accent)",
              opacity: disabled ? 0.5 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(124,110,243,0.70)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,110,243,0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = digit ? "rgba(124,110,243,0.55)" : "var(--border2)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ["form", "otp", "done"];
  const labels = ["Set Password", "Verify OTP", "Complete"];
  const current = steps.indexOf(step);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const past    = current > i;
        const active  = current === i;
        return (
          <div key={s} className="flex items-center" style={{ flex: i < 2 ? "1" : "0" }}>
            {/* dot + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: past ? "var(--green)" : active ? "var(--accent)" : "var(--surface2)",
                  color: past || active ? "#fff" : "var(--text4)",
                  border: active ? "2px solid rgba(124,110,243,0.35)" : "1.5px solid var(--border2)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {past ? "✓" : i + 1}
              </div>
              <span
                className="text-[10px] font-semibold whitespace-nowrap hidden sm:block"
                style={{ color: active ? "var(--text)" : past ? "var(--green)" : "var(--text4)" }}
              >
                {labels[i]}
              </span>
            </div>

            {/* connector line between steps */}
            {i < 2 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginBottom: 16,
                  marginLeft: 6,
                  marginRight: 6,
                  borderRadius: 99,
                  background: past ? "var(--green)" : "var(--border2)",
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Security checks sidebar card ──────────────────────────────────────────────
function SecurityStatusCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden h-fit"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border2)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
          Security Checks
        </p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text)" }}>
          Password Protection
        </p>
      </div>

      <div className="p-4 space-y-2.5">
        {[
          "Email verified",
          "OTP required",
          "Current password checked",
          "Bcrypt hashed",
        ].map((label) => (
          <div key={label} className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(34,211,160,0.10)",
                border: "1px solid rgba(34,211,160,0.22)",
              }}
            >
              <CheckCircle2 className="w-3 h-3" style={{ color: "var(--green)" }} />
            </div>
            <p className="text-xs" style={{ color: "var(--text2)" }}>{label}</p>
          </div>
        ))}
      </div>

      <div
        className="mx-4 mb-4 rounded-xl px-3 py-3"
        style={{
          background: "rgba(34,211,160,0.06)",
          border: "1px solid rgba(34,211,160,0.16)",
        }}
      >
        <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--green)" }}>
          🔒 Secure Flow
        </p>
        <p className="text-[11px] leading-[1.6]" style={{ color: "var(--text3)" }}>
          Passwords are never stored in plain text. OTP adds an extra verification layer.
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SecurityTab({ email }: { email: string }) {
  const [step,            setStep]            = useState<Step>("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendingOtp,      setSendingOtp]      = useState(false);
  const [otp,             setOtp]             = useState("");
  const [verifyingOtp,    setVerifyingOtp]    = useState(false);
  const [changingPw,      setChangingPw]      = useState(false);
  const cooldown = useCooldown();

  // ── handlers (identical logic to original) ────────────────────────────────
  const handleSendOtp = async () => {
    if (!currentPassword.trim())              { toast.error("Enter your current password."); return; }
    if (!newPassword.trim())                  { toast.error("Enter your new password."); return; }
    if (newPassword.length < 8)               { toast.error("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword)      { toast.error("Passwords do not match."); return; }
    if (currentPassword === newPassword)      { toast.error("New password must differ from current."); return; }

    setSendingOtp(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-otp", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.status === 429) { cooldown.start(data.cooldownRemaining ?? 60); toast.error(data.message); return; }
      if (!data.success)      { toast.error(data.message); return; }
      toast.success(data.message);
      cooldown.start(60);
      setStep("otp");
    } catch { toast.error("Network error. Please try again.");
    } finally { setSendingOtp(false); }
  };

  const handleResendOtp = async () => {
    if (cooldown.remaining > 0) return;
    setSendingOtp(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-otp", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.status === 429) { cooldown.start(data.cooldownRemaining ?? 60); toast.error(data.message); return; }
      if (!data.success)      { toast.error(data.message); return; }
      setOtp(""); toast.success("OTP resent."); cooldown.start(60);
    } catch { toast.error("Network error. Please try again.");
    } finally { setSendingOtp(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.replace(/\D/g, "").length < 6) { toast.error("Enter the full 6-digit OTP."); return; }
    setVerifyingOtp(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-otp", otp }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(data.message);
      setStep("done");
    } catch { toast.error("Network error. Please try again.");
    } finally { setVerifyingOtp(false); }
  };

  const handleChangePassword = async () => {
    setChangingPw(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", otp, newPassword }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(data.message);
      setStep("form");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setOtp("");
    } catch { toast.error("Network error. Please try again.");
    } finally { setChangingPw(false); }
  };

  // ── shared button styles ──────────────────────────────────────────────────
  const btnPrimary: React.CSSProperties = {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    boxShadow: "0 4px 14px rgba(124,110,243,0.30)",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };

  const btnSecondary: React.CSSProperties = {
    background: "var(--surface2)",
    color: "var(--text2)",
    border: "1px solid var(--border2)",
    borderRadius: 12,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-5 items-start">

      {/* ── LEFT ── */}
      <div className="space-y-4">

        {/* Step bar card */}
        <div
          className="rounded-2xl px-5 pt-4 pb-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
                Change Password
              </p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                {step === "form" && "Step 1 — Set your new password"}
                {step === "otp"  && "Step 2 — Verify your identity"}
                {step === "done" && "Step 3 — Confirm the change"}
              </p>
            </div>
          </div>
          <StepBar step={step} />
        </div>

        {/* ── STEP 1: password form ── */}
        {step === "form" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            {/* card header */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid var(--border2)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(124,110,243,0.10)" }}
                >
                  <LockKeyhole className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Password Details
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest rounded-lg px-2 py-1"
                style={{
                  background: "rgba(124,110,243,0.10)",
                  color: "var(--accent)",
                  border: "1px solid rgba(124,110,243,0.20)",
                }}
              >
                OTP Protected
              </span>
            </div>

            {/* form fields */}
            <div className="p-5 space-y-3.5">
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Enter your current password"
                disabled={sendingOtp}
              />
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 8 characters"
                disabled={sendingOtp}
              />
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter your new password"
                disabled={sendingOtp}
              />

              {/* email notice */}
              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
              >
                <MailCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <p className="text-xs leading-[1.6]" style={{ color: "var(--text3)" }}>
                  An OTP will be sent to{" "}
                  <span className="font-semibold" style={{ color: "var(--text2)" }}>{email}</span>.
                  {" "}Verify it to confirm the change.
                </p>
              </div>

              {/* action row */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSendOtp}
                  disabled={sendingOtp || !currentPassword || !newPassword || !confirmPassword}
                  style={{
                    ...btnPrimary,
                    opacity: (sendingOtp || !currentPassword || !newPassword || !confirmPassword) ? 0.45 : 1,
                  }}
                >
                  {sendingOtp
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending OTP…</>
                    : <><MailCheck className="w-3.5 h-3.5" /> Send OTP to Email</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: OTP verification ── */}
        {step === "otp" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid rgba(124,110,243,0.25)" }}
          >
            {/* card header */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid var(--border2)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(34,211,160,0.10)" }}
                >
                  <MailCheck className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  OTP Verification
                </span>
              </div>
              <button
                onClick={() => { setStep("form"); setOtp(""); }}
                className="text-[12px] font-semibold cursor-pointer border-none bg-transparent"
                style={{ color: "var(--text3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
              >
                ← Back
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* sent notice */}
              <div
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                style={{ background: "rgba(34,211,160,0.07)", border: "1px solid rgba(34,211,160,0.18)" }}
              >
                <MailCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                <p className="text-xs leading-[1.6]" style={{ color: "var(--text2)" }}>
                  We sent a 6-digit OTP to{" "}
                  <span className="font-semibold break-all" style={{ color: "var(--green)" }}>
                    {email}
                  </span>
                  . Valid for 10 minutes.
                </p>
              </div>

              {/* OTP input section */}
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider text-center mb-3"
                  style={{ color: "var(--text3)" }}
                >
                  Enter 6-digit code
                </p>
                {/* THE FIX: OtpBoxes uses inline-flex internally */}
                <OtpBoxes value={otp} onChange={setOtp} disabled={verifyingOtp} />
              </div>

              {/* resend + verify row */}
              <div className="flex items-center justify-between gap-3 pt-1">
                {/* resend */}
                <div>
                  {cooldown.remaining > 0 ? (
                    <div
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: "rgba(245,158,11,0.10)",
                        color: "var(--amber)",
                        border: "1px solid rgba(245,158,11,0.20)",
                      }}
                    >
                      <Timer className="w-3 h-3" />
                      Resend in {cooldown.remaining}s
                    </div>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      disabled={sendingOtp}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold border-none bg-transparent cursor-pointer disabled:opacity-50"
                      style={{ color: "var(--accent)" }}
                    >
                      <RefreshCw className={`w-3 h-3 ${sendingOtp ? "animate-spin" : ""}`} />
                      Resend OTP
                    </button>
                  )}
                </div>

                {/* verify */}
                <button
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otp.replace(/\D/g, "").length < 6}
                  style={{
                    ...btnPrimary,
                    opacity: (verifyingOtp || otp.replace(/\D/g, "").length < 6) ? 0.45 : 1,
                  }}
                >
                  {verifyingOtp
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…</>
                    : <><ShieldCheck className="w-3.5 h-3.5" /> Verify OTP</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: confirmed, change password ── */}
        {step === "done" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid rgba(34,211,160,0.28)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid rgba(34,211,160,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(34,211,160,0.12)" }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Identity Verified
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest rounded-lg px-2 py-1"
                style={{
                  background: "rgba(34,211,160,0.10)",
                  color: "var(--green)",
                  border: "1px solid rgba(34,211,160,0.22)",
                }}
              >
                OTP ✓
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ background: "rgba(34,211,160,0.06)", border: "1px solid rgba(34,211,160,0.18)" }}
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
                    OTP Verified ✓
                  </p>
                  <p className="text-xs mt-1 leading-[1.6]" style={{ color: "var(--text3)" }}>
                    Your identity is confirmed. Click{" "}
                    <strong style={{ color: "var(--text2)" }}>Change Password</strong>{" "}
                    to finalise the update.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep("otp")}
                  style={btnSecondary}
                >
                  ← Re-enter OTP
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPw}
                  style={{ ...btnPrimary, opacity: changingPw ? 0.5 : 1 }}
                >
                  {changingPw
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Changing…</>
                    : <><LockKeyhole className="w-3.5 h-3.5" /> Change Password</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── RIGHT: security status sidebar ── */}
      <SecurityStatusCard />

    </div>
  );
}