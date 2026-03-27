// app/dashboard/profile/_components/SecurityTab.tsx
//
// FULL OTP-based password change flow — three steps:
//   Step 1 — Enter current + new password  → "Send OTP"
//   Step 2 — Enter 6-digit OTP (sent to email) → "Verify OTP"
//   Step 3 — OTP verified — "Change Password" finalises the update
//
// Only one component. No external state needed — everything lives here.
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
  ShieldX,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "react-hot-toast";

type Step = "form" | "otp" | "done";

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label
        className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--text3)" }}
      >
        <KeyRound className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
        {label}
      </label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder ?? "••••••••"}
          className="w-full rounded-2xl py-3 pl-4 pr-12 text-sm outline-none transition-all disabled:opacity-60"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            color: "var(--text)",
          }}
        />

        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          disabled={disabled}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 border-none bg-transparent cursor-pointer disabled:opacity-40"
          style={{ color: "var(--text3)" }}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Always force exactly 6 visible boxes
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];

      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        inputs.current[i - 1]?.focus();
      }

      onChange(next.join(""));
    }
  };

  const handleChange = (i: number, raw: string) => {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];

    next[i] = char || "";
    onChange(next.join(""));

    if (char && i < 5) {
      inputs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (pasted.length) {
      onChange(pasted);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }

    e.preventDefault();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2 sm:gap-3">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            className="h-14 w-11 sm:w-14 rounded-2xl text-center text-lg font-bold outline-none transition-all disabled:opacity-50"
            style={{
              background: digit
                ? "rgba(124,110,243,0.12)"
                : "var(--surface)",
              border: digit
                ? "1.5px solid rgba(124,110,243,0.50)"
                : "1px solid var(--border2)",
              color: "var(--text)",
              caretColor: "var(--accent)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(124,110,243,0.65)";
              e.currentTarget.style.boxShadow =
                "0 0 0 4px rgba(124,110,243,0.10)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = digit
                ? "rgba(124,110,243,0.50)"
                : "var(--border2)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--text3)" }}>
        Enter the 6-digit code from your email.
      </p>
    </div>
  );
}

function useCooldown(initial = 0) {
  const [remaining, setRemaining] = useState(initial);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = (seconds: number) => {
    setRemaining(seconds);
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(ref.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, []);

  return { remaining, start };
}

export default function SecurityTab({ email }: { email: string }) {
  const [step, setStep] = useState<Step>("form");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [sendingOtp, setSendingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const cooldown = useCooldown();

  const handleSendOtp = async () => {
    if (!currentPassword.trim()) {
      toast.error("Enter your current password.");
      return;
    }

    if (!newPassword.trim()) {
      toast.error("Enter your new password.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from the current password.");
      return;
    }

    setSendingOtp(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send-otp",
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        cooldown.start(data.cooldownRemaining ?? 60);
        toast.error(data.message);
        return;
      }

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success(data.message);
      cooldown.start(60);
      setStep("otp");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown.remaining > 0) return;

    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send-otp",
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.status === 429) {
        cooldown.start(data.cooldownRemaining ?? 60);
        toast.error(data.message);
        return;
      }

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      setOtp("");
      toast.success("OTP resent.");
      cooldown.start(60);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.replace(/\D/g, "").length < 6) {
      toast.error("Enter the full 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify-otp",
          otp,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success(data.message);
      setStep("done");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleChangePassword = async () => {
    setChangingPw(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "change-password",
          otp,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success(data.message);

      setStep("form");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setChangingPw(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border2)",
  };

  const btnPrimary: React.CSSProperties = {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    padding: "11px 20px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  const btnSecondary: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text2)",
    border: "1px solid var(--border2)",
    borderRadius: "14px",
    padding: "11px 20px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-5">
        {step === "form" && (
          <section className="rounded-[22px] p-5 sm:p-6 space-y-5" style={cardStyle}>
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--text3)" }}
                >
                  Password Change
                </p>
                <h3
                  className="mt-1 text-base font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Enter current & new password
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
                OTP protected
              </div>
            </div>

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

            <p className="text-xs leading-5" style={{ color: "var(--text3)" }}>
              An OTP will be sent to{" "}
              <span className="font-semibold" style={{ color: "var(--text2)" }}>
                {email}
              </span>
              . You’ll need to verify it before the password is changed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleSendOtp}
                disabled={
                  sendingOtp ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                style={{
                  ...btnPrimary,
                  opacity:
                    sendingOtp ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                      ? 0.5
                      : 1,
                }}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending OTP…
                  </>
                ) : (
                  <>
                    <MailCheck className="h-4 w-4" />
                    Send OTP
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {step === "otp" && (
          <section className="rounded-[22px] p-5 sm:p-6 space-y-5" style={cardStyle}>
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--text3)" }}
                >
                  OTP Verification
                </p>
                <h3
                  className="mt-1 text-base font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Enter your OTP
                </h3>
              </div>

              <button
                onClick={() => {
                  setStep("form");
                  setOtp("");
                }}
                style={btnSecondary}
              >
                ← Back
              </button>
            </div>

            <div
              className="rounded-[20px] p-5 space-y-4"
              style={{
                background: "var(--surface)",
                border: "1px solid rgba(124,110,243,0.20)",
              }}
            >
              <div
                className="flex items-center gap-3 rounded-[18px] px-4 py-3"
                style={{
                  background: "rgba(34,211,160,0.07)",
                  border: "1px solid rgba(34,211,160,0.18)",
                }}
              >
                <MailCheck className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} />
                <p className="text-sm" style={{ color: "var(--text2)" }}>
                  We sent a 6-digit OTP to{" "}
                  <span className="font-semibold" style={{ color: "var(--green)" }}>
                    {email}
                  </span>
                  . Valid for 10 minutes.
                </p>
              </div>

              <div>
                <label
                  className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--text3)" }}
                >
                  Enter OTP
                </label>

                <OtpBoxes value={otp} onChange={setOtp} disabled={verifyingOtp} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text3)" }}>
                Didn’t receive it?
              </p>

              {cooldown.remaining > 0 ? (
                <div
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: "rgba(245,158,11,0.10)",
                    color: "var(--amber)",
                    border: "1px solid rgba(245,158,11,0.20)",
                  }}
                >
                  <Timer className="h-3 w-3" />
                  Resend in {cooldown.remaining}s
                </div>
              ) : (
                <button
                  onClick={handleResendOtp}
                  disabled={sendingOtp}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold border-none bg-transparent cursor-pointer transition-opacity disabled:opacity-50"
                  style={{ color: "var(--accent)" }}
                >
                  <RefreshCw className={`h-3 w-3 ${sendingOtp ? "animate-spin" : ""}`} />
                  Resend OTP
                </button>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.replace(/\D/g, "").length < 6}
                style={{
                  ...btnPrimary,
                  opacity:
                    verifyingOtp || otp.replace(/\D/g, "").length < 6 ? 0.5 : 1,
                }}
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Verify OTP
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {step === "done" && (
          <section className="rounded-[22px] p-5 sm:p-6 space-y-5" style={cardStyle}>
            <div
              className="flex items-start gap-4 rounded-[18px] p-4"
              style={{
                background: "rgba(34,211,160,0.08)",
                border: "1px solid rgba(34,211,160,0.20)",
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "rgba(34,211,160,0.15)",
                  border: "1px solid rgba(34,211,160,0.25)",
                }}
              >
                <ShieldCheck className="h-5 w-5" style={{ color: "var(--green)" }} />
              </div>

              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
                  OTP Verified ✓
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--text3)" }}>
                  Your identity is verified. Click <strong style={{ color: "var(--text2)" }}>Change Password</strong> to finish.
                </p>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button onClick={() => setStep("otp")} style={btnSecondary}>
                ← Re-enter OTP
              </button>

              <button
                onClick={handleChangePassword}
                disabled={changingPw}
                style={{
                  ...btnPrimary,
                  opacity: changingPw ? 0.5 : 1,
                }}
              >
                {changingPw ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Changing…
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4" />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <div
          className="rounded-[22px] p-5"
          style={cardStyle}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3"
            style={{ color: "var(--text3)" }}
          >
            Password Security
          </p>

          <div className="space-y-3">
            {[
              { label: "Email verified", ok: true },
              { label: "OTP required", ok: true },
              { label: "Current password checked", ok: true },
              { label: "Bcrypt hashed", ok: true },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg shrink-0"
                  style={{
                    background: ok ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.12)",
                    border: ok ? "1px solid rgba(34,211,160,0.25)" : "1px solid rgba(248,113,113,0.25)",
                  }}
                >
                  {ok ? (
                    <CheckCircle2 className="h-3 w-3" style={{ color: "var(--green)" }} />
                  ) : (
                    <ShieldX className="h-3 w-3" style={{ color: "var(--danger)" }} />
                  )}
                </div>
                <p className="text-xs font-medium" style={{ color: "var(--text2)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}