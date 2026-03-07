// app/layout.tsx

import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";


export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://hourbit.vercel.app"),
  title: {
    default: "Hour Bit — Free Work Hours Tracker & Leave Time Calculator",
    template: "%s | Hour Bit",
  },
  description:
    "Free employee time tracking app for flexible schedules. Track clock-in, breaks, and get smart leave predictions. No spreadsheets. No credit card.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#0a0a0f] text-[#e8e8f0]">
        <Navbar />
        <main className="grow">{children}</main>
        <Footer />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}