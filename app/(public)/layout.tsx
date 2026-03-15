// hourbit\app\(public)\layout.tsx

// app/(public)/layout.tsx
// This layout wraps the homepage (/) and any other public marketing pages.
// It is the ONLY place that renders the public Navbar and Footer.

import { ReactNode } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="grow">{children}</main>
      <Footer />
    </>
  );
}