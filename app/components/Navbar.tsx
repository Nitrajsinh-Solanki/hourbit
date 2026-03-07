
// src/components/Navbar.tsx

"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full border-b bg-white">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

        {/* Logo */}
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Hourbit
        </Link>

        {/* Navigation Links */}
        <div className="flex gap-6 text-gray-700 font-medium">
          <Link href="/login" className="hover:text-blue-600">
            Login
          </Link>

          <Link href="/register" className="hover:text-blue-600">
            Register
          </Link>

          <Link href="/verify" className="hover:text-blue-600">
            Verify Account
          </Link>
        </div>
      </div>
    </nav>
  );
}