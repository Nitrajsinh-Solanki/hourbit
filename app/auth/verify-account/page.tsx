
// hourbit\app\auth\verify-account\page.tsx


"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function VerifyAccountPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [timer, setTimer] = useState(0);

  /* Countdown Timer */
  useEffect(() => {
    let interval: any;

    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [timer]);

  /* Handle OTP input */
  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  /* Send OTP */
  const sendOTP = async () => {
    if (!email) {
      toast.error("Enter your email");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("OTP sent to your email");

      setOtpSent(true);
      setTimer(60);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  /* Verify OTP */
  const verifyOTP = async () => {
    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      toast.error("Enter valid OTP");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email,
          otp: otpCode,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success("Account verified!");

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  /* Resend OTP */
  const resendOTP = async () => {
    if (timer > 0) return;

    sendOTP();
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 space-y-6">

        <h1 className="text-2xl font-bold text-center">
          Verify Your Account
        </h1>

        {/* EMAIL INPUT */}
        <div>
          <label className="text-sm font-medium">Email</label>

          <input
            type="email"
            placeholder="Enter your registered email"
            className="w-full border rounded-lg px-3 py-2 mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {!otpSent && (
          <button
            onClick={sendOTP}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        )}

        {/* OTP INPUT */}
        {otpSent && (
          <>
            <div className="flex justify-between gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleOtpChange(e.target.value, index)
                  }
                  className="w-12 h-12 text-center text-lg border rounded-lg"
                />
              ))}
            </div>

            {/* VERIFY BUTTON */}
            <button
              onClick={verifyOTP}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            {/* RESEND BUTTON */}
            <button
              onClick={resendOTP}
              disabled={timer > 0}
              className="w-full text-blue-600 text-sm"
            >
              {timer > 0
                ? `Resend OTP in ${timer}s`
                : "Resend OTP"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}