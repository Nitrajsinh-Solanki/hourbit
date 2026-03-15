// app/page.tsx

import type { Metadata } from "next";
import HomePage from "../components/HomePage";
import AutoRedirect from "../components/AutoRedirect";

export const metadata: Metadata = {
  title: "Hour Bit — Free Work Hours Tracker & Leave Time Calculator",
  description:
    "Track work hours, breaks & get smart leave predictions. Hour Bit is the free employee time tracking app built for flexible timing schedules. Clock in, log breaks, and know exactly when you can leave — no spreadsheets needed.",
  keywords: [
    "work hours tracker",
    "employee time tracking app",
    "flexible work hours tracker",
    "clock in clock out app",
    "leave time calculator",
    "work time tracker free",
    "daily hours tracker",
    "break time tracker",
    "attendance tracking app",
    "productive hours calculator",
    "office hours tracker",
    "timesheet app free",
    "8.5 hours tracker",
    "work log app",
    "employee attendance app",
  ],
  authors: [{ name: "Nitrajsinh Solanki" }],
  creator: "Nitrajsinh Solanki",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://hourbit.vercel.app",
    siteName: "Hour Bit",
    title: "Hour Bit — Free Work Hours Tracker & Smart Leave Prediction",
    description:
      "Stop calculating manually. Hour Bit tracks your work hours, deducts breaks, and tells you exactly when you've completed 8.5 hours. Free forever. No credit card required.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hour Bit - Work Hours Tracker App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hour Bit — Free Work Hours Tracker",
    description:
      "Track work hours, log breaks, and get smart leave time predictions. Built for flexible schedules.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://hourbit.vercel.app",
  },
};

/* ─── JSON-LD Structured Data ─────────────────────────────── */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://hourbit.vercel.app/#webapp",
      name: "Hour Bit",
      url: "https://hourbit.vercel.app",
      description:
        "Free work hours tracker with smart leave time prediction for employees on flexible schedules. Track clock-in, breaks, and productive time in real time.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Real-time work hours tracking",
        "Smart leave time prediction",
        "Break time logging",
        "Attendance management",
        "Productivity analytics",
        "Holiday management",
        "Past record editing",
        "CSV and PDF export",
      ],
      screenshot: "https://hourbit.vercel.app/og-image.png",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "128",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://hourbit.vercel.app/#org",
      name: "Hour Bit",
      url: "https://hourbit.vercel.app",
      logo: "https://hourbit.vercel.app/logo.png",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is Hour Bit free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, Hour Bit is completely free. No credit card required. Create your account and start tracking work hours instantly.",
          },
        },
        {
          "@type": "Question",
          name: "How does Hour Bit calculate leave time?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Hour Bit calculates your leave time by tracking your clock-in time, deducting all logged break durations, and predicting when you will complete your target work hours (default 8.5 hours).",
          },
        },
        {
          "@type": "Question",
          name: "Can I track flexible work hours with Hour Bit?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Hour Bit is specifically built for employees with flexible timing policies. You can set your daily target hours and it will predict your leave time accordingly.",
          },
        },
        {
          "@type": "Question",
          name: "Can I edit past work records?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Hour Bit lets you add or edit any past date's work log including entry time, breaks, and exit time.",
          },
        },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      {/* Silently redirects to /dashboard if a valid JWT token exists */}
      <AutoRedirect />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePage />
    </>
  );
}