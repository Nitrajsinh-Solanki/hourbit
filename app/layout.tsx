// src/app/layout.tsx

import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ReactNode } from "react";

export const metadata = {
  title: "Hourbit",
  description: "Track your work hours and productivity easily",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">

        <Navbar />

        <main className="grow">
          {children}
        </main>

        <Footer />

      </body>
    </html>
  );
}