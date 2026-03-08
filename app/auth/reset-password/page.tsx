// app/auth/reset-password/page.tsx

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

// ── Inner component that uses useSearchParams ──────────────────
// Must be separated so Suspense can wrap it properly.
function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const email = params.get("email") ?? "";

  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [done, setDone]                       = useState(false);

  /* password strength */
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6)                     s++;
    if (password.length >= 10)                    s++;
    if (/[A-Z]/.test(password))                   s++;
    if (/[0-9]/.test(password))                   s++;
    if (/[^A-Za-z0-9]/.test(password))            s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "#f87171", "#fbbf24", "#fbbf24", "#22d3a0", "#22d3a0"][strength];

  const handleReset = async () => {
    if (!password) {
      toast.error("Enter a new password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("Password updated successfully!");
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 bg-[#0a0a0f]"
      style={{ paddingTop: "calc(64px + 40px)" }}
    >
      {/* glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
        style={{ background: "rgba(124,110,243,0.10)", filter: "blur(110px)" }}
      />

      {/* header */}
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-[#111118] border border-[#2a2a35] rounded-full px-4 py-1.5 mb-5">
          <span className="w-2 h-2 rounded-full bg-[#7c6ef3] block" />
          <span className="font-mono text-[12px] text-[#9898b0]">Step 3 of 3 — Set new password</span>
        </div>
        <h1 className="font-syne font-extrabold text-[32px] text-[#e8e8f0] tracking-tight mb-2">
          {done ? "Password updated! 🎉" : "Set new password"}
        </h1>
        <p className="font-mono text-[14px] text-[#9898b0]">
          {done
            ? "Redirecting you to login..."
            : `Resetting password for ${email}`}
        </p>
      </div>

      {/* step indicators */}
      <div className="relative z-10 flex items-center gap-2 mb-8">
        {[
          { n: 1, label: "Email"    },
          { n: 2, label: "OTP"      },
          { n: 3, label: "Password" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-syne font-bold text-[12px] transition-all ${
                s.n < 3
                  ? "bg-[#22d3a0] text-[#0a0a0f]"
                  : done
                  ? "bg-[#22d3a0] text-[#0a0a0f]"
                  : "bg-[#7c6ef3] text-white shadow-[0_0_14px_rgba(124,110,243,0.5)]"
              }`}>
                {s.n < 3 ? "✓" : done ? "✓" : "3"}
              </div>
              <span className={`font-mono text-[11px] ${s.n === 3 ? "text-[#e8e8f0]" : "text-[#5a5a72]"}`}>
                {s.label}
              </span>
            </div>
            {i < 2 && <div className="w-8 h-px bg-[#2a2a35]" />}
          </div>
        ))}
      </div>

      {/* success state */}
      {done ? (
        <div className="relative z-10 w-full max-w-[420px] bg-[#111118] border border-[#22d3a0]/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#22d3a0]/10 border border-[#22d3a0]/30 flex items-center justify-center text-[32px] mx-auto mb-5">
            ✓
          </div>
          <p className="font-syne font-semibold text-[18px] text-[#22d3a0] mb-2">Password Changed!</p>
          <p className="font-mono text-[13px] text-[#9898b0]">
            You&apos;ll be redirected to login automatically...
          </p>
        </div>
      ) : (
        /* card */
        <div className="relative z-10 w-full max-w-[420px] bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">

          <div className="flex flex-col gap-5">

            {/* new password */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 pr-11 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72] hover:text-[#9898b0] bg-transparent border-none cursor-pointer p-0 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* strength bar */}
              {password && (
                <div>
                  <div className="flex gap-1 mt-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColor : "#1e1e2e" }}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-[11px] mt-1" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </p>
                </div>
              )}
            </div>

            {/* confirm password */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-[#0a0a0f] border rounded-xl px-4 py-3 pr-11 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none transition-colors ${
                    confirmPassword && password !== confirmPassword
                      ? "border-[#f87171]"
                      : confirmPassword && password === confirmPassword
                      ? "border-[#22d3a0]"
                      : "border-[#2a2a35] focus:border-[#7c6ef3]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72] hover:text-[#9898b0] bg-transparent border-none cursor-pointer p-0 transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="font-mono text-[11px] text-[#f87171]">Passwords do not match</p>
              )}
            </div>

            {/* submit */}
            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] hover:shadow-[0_0_36px_rgba(124,110,243,0.5)] transition-all mt-1"
            >
              {loading ? "Updating..." : "Update Password →"}
            </button>

          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#1e1e2e]" />
          </div>

          <p className="font-mono text-[13px] text-[#9898b0] text-center">
            <Link
              href="/auth/login"
              className="text-[#a78bfa] hover:text-[#7c6ef3] transition-colors no-underline"
            >
              ← Back to login
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page export — wraps the form in Suspense ───────────────────
// REQUIRED by Next.js whenever useSearchParams() is used in a page.
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
          <div className="w-6 h-6 rounded-full border-2 border-[#7c6ef3] border-t-transparent animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}