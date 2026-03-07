// app/auth/register/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    fullName:         "",
    email:            "",
    password:         "",
    confirmPassword:  "",
    companyName:      "",
    defaultWorkHours: 8.5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Account created! Check your email for OTP.");
        router.push(`/auth/verify?email=${encodeURIComponent(form.email)}`);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[#0a0a0f]"
      style={{ paddingTop: "calc(64px + 32px)" }}
    >
      {/* background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full"
        style={{ background: "rgba(124,110,243,0.10)", filter: "blur(110px)" }}
      />

      {/* header */}
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-[#111118] border border-[#2a2a35] rounded-full px-4 py-1.5 mb-5">
          <span className="w-2 h-2 rounded-full bg-[#22d3a0] block animate-pulse-glow" />
          <span className="font-mono text-[12px] text-[#9898b0]">Free forever · No credit card</span>
        </div>
        <h1 className="font-syne font-extrabold text-[32px] text-[#e8e8f0] tracking-tight mb-2">
          Create your account
        </h1>
        <p className="font-mono text-[14px] text-[#9898b0]">
          Start tracking your work hours in under 60 seconds
        </p>
      </div>

      {/* card */}
      <div className="relative z-10 w-full max-w-[460px] bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* full name */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
              Full Name
            </label>
            <input
              required
              placeholder="Nitrajsinh Solanki"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
            />
          </div>

          {/* email */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
              Email Address
            </label>
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
            />
          </div>

          {/* company name + work hours — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
                Company <span className="text-[#3a3a55]">(optional)</span>
              </label>
              <input
                placeholder="Acme Inc."
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
                Target Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={form.defaultWorkHours}
                onChange={(e) => setForm({ ...form, defaultWorkHours: Number(e.target.value) })}
                className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
              />
            </div>
          </div>

          {/* password */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
              Password
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 pr-11 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72] hover:text-[#9898b0] bg-transparent border-none cursor-pointer p-0 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* confirm password */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
              Confirm Password
            </label>
            <div className="relative">
              <input
                required
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={`w-full bg-[#0a0a0f] border rounded-xl px-4 py-3 pr-11 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none transition-colors ${
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? "border-[#f87171] focus:border-[#f87171]"
                    : form.confirmPassword && form.password === form.confirmPassword
                    ? "border-[#22d3a0] focus:border-[#22d3a0]"
                    : "border-[#2a2a35] focus:border-[#7c6ef3]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72] hover:text-[#9898b0] bg-transparent border-none cursor-pointer p-0 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="font-mono text-[11px] text-[#f87171]">Passwords do not match</p>
            )}
          </div>

          {/* submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] hover:shadow-[0_0_36px_rgba(124,110,243,0.5)] transition-all mt-1"
          >
            {loading ? "Creating account..." : "Create Account →"}
          </button>

        </form>

        {/* divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#1e1e2e]" />
          <span className="font-mono text-[11px] text-[#3a3a55]">or</span>
          <div className="flex-1 h-px bg-[#1e1e2e]" />
        </div>

        {/* login link */}
        <p className="font-mono text-[13px] text-[#9898b0] text-center">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-[#a78bfa] hover:text-[#7c6ef3] transition-colors no-underline font-medium"
          >
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}