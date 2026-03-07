// app/auth/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [rememberMe, setRememberMe]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("Login successful");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 bg-[#0a0a0f]"
      style={{ paddingTop: "calc(64px + 40px)" }}
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
          <span className="font-mono text-[12px] text-[#9898b0]">Secure sign-in</span>
        </div>
        <h1 className="font-syne font-extrabold text-[32px] text-[#e8e8f0] tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="font-mono text-[14px] text-[#9898b0]">
          Sign in to your Hour Bit account
        </p>
      </div>

      {/* card */}
      <div className="relative z-10 w-full max-w-[420px] bg-[#111118] border border-[#1e1e2e] rounded-2xl p-8">

        <form onSubmit={handleLogin} className="flex flex-col gap-5">

          {/* email */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
            />
          </div>

          {/* password */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[12px] text-[#9898b0] tracking-wide uppercase">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="font-mono text-[12px] text-[#7c6ef3] hover:text-[#a78bfa] transition-colors no-underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#2a2a35] rounded-xl px-4 py-3 pr-11 font-mono text-[14px] text-[#e8e8f0] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c6ef3] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5a5a72] hover:text-[#9898b0] transition-colors bg-transparent border-none cursor-pointer p-0"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* remember me */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                rememberMe
                  ? "bg-[#7c6ef3] border-[#7c6ef3]"
                  : "bg-[#0a0a0f] border-[#2a2a35] group-hover:border-[#7c6ef3]/50"
              }`}
            >
              {rememberMe && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="font-mono text-[13px] text-[#9898b0] group-hover:text-[#e8e8f0] transition-colors">
              Remember me for 90 days
            </span>
          </label>

          {/* submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono font-medium text-[14px] text-white py-3.5 rounded-xl bg-[#7c6ef3] hover:bg-[#6c5ee3] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-[0_0_24px_rgba(124,110,243,0.35)] hover:shadow-[0_0_36px_rgba(124,110,243,0.5)] transition-all mt-1"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

        </form>

        {/* divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[#1e1e2e]" />
          <span className="font-mono text-[11px] text-[#3a3a55]">or</span>
          <div className="flex-1 h-px bg-[#1e1e2e]" />
        </div>

        {/* register link */}
        <p className="font-mono text-[13px] text-[#9898b0] text-center">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="text-[#a78bfa] hover:text-[#7c6ef3] transition-colors no-underline font-medium"
          >
            Create one free →
          </Link>
        </p>
      </div>

      {/* bottom note */}
      <p className="relative z-10 font-mono text-[12px] text-[#3a3a55] text-center mt-6">
        Free forever · No credit card · Setup in 60 seconds
      </p>
    </div>
  );
}