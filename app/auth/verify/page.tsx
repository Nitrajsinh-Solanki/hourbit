// app/auth/verify/page.tsx

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const email = searchParams.get("email") ?? "";

  const [otp, setOtp]         = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer]     = useState(60);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  /* auto-start timer on mount */
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* OTP box change handler */
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // only last char
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /* backspace — go back */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /* paste handler */
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Enter all 6 digits");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Account verified successfully!");
        setTimeout(() => router.push("/auth/login"), 1200);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (timer > 0) return;

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("OTP sent again!");
        setTimer(60);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to resend OTP");
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
          <span className="w-2 h-2 rounded-full bg-[#fbbf24] block" />
          <span className="font-mono text-[12px] text-[#9898b0]">OTP expires in 10 minutes</span>
        </div>
        <h1 className="font-syne font-extrabold text-[32px] text-[#e8e8f0] tracking-tight mb-2">
          Verify your email
        </h1>
        <p className="font-mono text-[14px] text-[#9898b0]">
          We sent a 6-digit code to
        </p>
        <p className="font-mono text-[14px] text-[#a78bfa] font-medium mt-0.5">
          {email}
        </p>
      </div>

      {/* card */}
      <div className="relative z-10 w-full max-w-[420px] bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">

        <form onSubmit={handleVerify} className="flex flex-col gap-6">

          {/* 6 OTP boxes */}
          <div>
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase mb-4 block text-center">
              Enter 6-digit OTP
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

          {/* verify button */}
          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] hover:shadow-[0_0_36px_rgba(124,110,243,0.5)] transition-all"
          >
            {loading ? "Verifying..." : "Verify Account →"}
          </button>

        </form>

        {/* resend */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[13px] text-[#9898b0] mb-2">
            Didn&apos;t receive the code?
          </p>
          <button
            onClick={resendOTP}
            disabled={timer > 0}
            className={`font-mono text-[13px] font-medium transition-colors bg-transparent border-none cursor-pointer ${
              timer > 0
                ? "text-[#3a3a55] cursor-not-allowed"
                : "text-[#a78bfa] hover:text-[#7c6ef3]"
            }`}
          >
            {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
          </button>
        </div>

        {/* divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#1e1e2e]" />
          <span className="font-mono text-[11px] text-[#3a3a55]">or</span>
          <div className="flex-1 h-px bg-[#1e1e2e]" />
        </div>

        <p className="font-mono text-[13px] text-[#9898b0] text-center">
          Wrong email?{" "}
          <Link
            href="/auth/register"
            className="text-[#a78bfa] hover:text-[#7c6ef3] transition-colors no-underline font-medium"
          >
            Go back to register
          </Link>
        </p>
      </div>
    </div>
  );
}