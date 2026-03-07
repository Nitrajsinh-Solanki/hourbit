// app/auth/verify/page.tsx


"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyPage() {

  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    try {

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert("Account verified successfully!");
        router.push("/auth/login");
      } else {
        alert(data.message);
      }

    } catch (error) {
      alert("Something went wrong");
    }

    setLoading(false);
  };

  const resendOTP = async () => {

    await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    alert("OTP sent again");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white">

      <form
        onSubmit={handleVerify}
        className="bg-[#111118] p-8 rounded-xl w-[420px] space-y-4 border border-[#2a2a35]"
      >

        <h1 className="text-2xl font-semibold text-center">
          Verify your email
        </h1>

        <p className="text-sm text-gray-400 text-center">
          OTP sent to {email}
        </p>

        <input
          required
          placeholder="Enter 6 digit OTP"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 w-full py-2 rounded"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <button
          type="button"
          onClick={resendOTP}
          className="text-sm text-purple-400 w-full"
        >
          Resend OTP
        </button>

      </form>

    </div>
  );
}