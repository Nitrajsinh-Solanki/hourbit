// app/auth/forgot-password/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail]     = useState("");
  const [otp, setOtp]         = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer]     = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  /* countdown */
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  /* OTP box input */
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const sendOTP = async () => {
    if (!email) {
      toast.error("Enter your email address");
      return;
    }

    try {
      setLoading(true);
      const res  = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("OTP sent to your email!");
      setOtpSent(true);
      setTimer(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Enter all 6 digits");
      return;
    }

    try {
      setLoading(true);
      const res  = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("OTP verified! Set your new password.");
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  /* progress indicator */
  const step = otpSent ? 2 : 1;

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
          <span className="w-2 h-2 rounded-full bg-[#fbbf24] block" />
          <span className="font-mono text-[12px] text-[#9898b0]">
            Step {step} of 3 — {step === 1 ? "Enter email" : "Verify OTP"}
          </span>
        </div>
        <h1 className="font-syne font-extrabold text-[32px] text-[#e8e8f0] tracking-tight mb-2">
          {otpSent ? "Enter verification code" : "Forgot your password?"}
        </h1>
        <p className="font-mono text-[14px] text-[#9898b0]">
          {otpSent
            ? `We sent a 6-digit code to ${email}`
            : "We'll send a code to reset your password"}
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
            <div className={`flex items-center gap-1.5`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-syne font-bold text-[12px] transition-all ${
                s.n < step
                  ? "bg-[#22d3a0] text-[#0a0a0f]"
                  : s.n === step
                  ? "bg-[#7c6ef3] text-white shadow-[0_0_14px_rgba(124,110,243,0.5)]"
                  : "bg-[#1e1e2e] text-[#5a5a72]"
              }`}>
                {s.n < step ? "✓" : s.n}
              </div>
              <span className={`font-mono text-[11px] ${s.n === step ? "text-[#e8e8f0]" : "text-[#5a5a72]"}`}>
                {s.label}
              </span>
            </div>
            {i < 2 && <div className="w-8 h-px bg-[#2a2a35]" />}
          </div>
        ))}
      </div>

      {/* card */}
      <div className="relative z-10 w-full max-w-[420px] bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">

        {/* email */}
        <div className="flex flex-col gap-2 mb-5">
          <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
            Email Address
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={otpSent}
            onKeyDown={(e) => { if (e.key === "Enter" && !otpSent) sendOTP(); }}
            className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
        </div>

        {!otpSent ? (
          <button
            onClick={sendOTP}
            disabled={loading}
            className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] hover:shadow-[0_0_36px_rgba(124,110,243,0.5)] transition-all"
          >
            {loading ? "Sending..." : "Send Reset OTP →"}
          </button>
        ) : (
          <div className="flex flex-col gap-5">

            {/* 6 OTP boxes */}
            <div>
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase mb-4 block text-center">
                Enter 6-digit code
              </label>
              <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className={`w-12 h-14 text-center font-syne font-bold text-[20px] rounded-xl border transition-all focus:outline-none ${
                      digit
                        ? "bg-[#7c6ef3]/10 border-[#7c6ef3] text-[#a78bfa]"
                        : "bg-[#0a0a0f] border-[#2a2a35] text-[#e8e8f0] focus:border-[#7c6ef3]"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* verify */}
            <button
              onClick={verifyOTP}
              disabled={loading || otp.join("").length !== 6}
              className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] transition-all"
            >
              {loading ? "Verifying..." : "Verify OTP →"}
            </button>

            {/* resend */}
            <div className="text-center">
              <button
                onClick={sendOTP}
                disabled={timer > 0 || loading}
                className={`font-mono text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors ${
                  timer > 0 ? "text-[#3a3a55] cursor-not-allowed" : "text-[#a78bfa] hover:text-[#7c6ef3]"
                }`}
              >
                {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        )}

        {/* bottom link */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#1e1e2e]" />
        </div>
        <p className="font-mono text-[13px] text-[#9898b0] text-center">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="text-[#a78bfa] hover:text-[#7c6ef3] transition-colors no-underline font-medium"
          >
            Back to login →
          </Link>
        </p>
      </div>
    </div>
  );
}