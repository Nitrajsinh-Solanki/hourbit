// app/auth/register/page.tsx


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    defaultWorkHours: 8.5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/auth/verify?email=${form.email}`);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Something went wrong.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] text-white">

      <form
        onSubmit={handleSubmit}
        className="bg-[#111118] p-8 rounded-xl w-[420px] space-y-4 border border-[#2a2a35]"
      >

        <h1 className="text-2xl font-semibold text-center">
          Create your account
        </h1>

        <input
          required
          placeholder="Full Name"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.fullName}
          onChange={(e) =>
            setForm({ ...form, fullName: e.target.value })
          }
        />

        <input
          required
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          placeholder="Company Name"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.companyName}
          onChange={(e) =>
            setForm({ ...form, companyName: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Default Work Hours"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.defaultWorkHours}
          onChange={(e) =>
            setForm({
              ...form,
              defaultWorkHours: Number(e.target.value),
            })
          }
        />

        <input
          required
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <input
          required
          type="password"
          placeholder="Confirm Password"
          className="w-full p-2 rounded bg-[#1a1a25]"
          value={form.confirmPassword}
          onChange={(e) =>
            setForm({ ...form, confirmPassword: e.target.value })
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 w-full py-2 rounded"
        >
          {loading ? "Creating account..." : "Register"}
        </button>

      </form>

    </div>
  );
}