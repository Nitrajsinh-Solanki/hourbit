// app/(public)/page.tsx
// Hour Bit — fully redesigned main page
// SEO + AEO optimised for all 5 tools

import type { Metadata } from "next";
import HomePage    from "../components/HomePage";
import AutoRedirect from "../components/AutoRedirect";

/* ─── Page-level metadata (Next.js App Router) ─────────── */
export const metadata: Metadata = {
  title:
    "Hour Bit — Free Work Hours Tracker, Brain Quiz, Diary, Typing Test & Expense Tracker",
  description:
    "Hour Bit is a free all-in-one productivity suite for employees. Track work hours & predict leave time, challenge yourself with a Brain Quiz, journal your day, measure typing speed (WPM), and manage daily expenses — all in one secure app. No credit card required.",
  keywords: [
    /* ── Work tracker ── */
    "work hours tracker",
    "free employee time tracking app",
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
    "real time work hours counter",
    /* ── Brain quiz ── */
    "brain quiz app",
    "knowledge quiz app",
    "XP rewards quiz",
    "daily quiz challenge",
    "employee brain training app",
    "quiz with leaderboard",
    /* ── Diary ── */
    "personal diary app",
    "digital journal app",
    "daily journal online",
    "private diary app free",
    /* ── Typing test ── */
    "typing speed test",
    "typing test WPM",
    "typing practice app",
    "keyboard speed test free",
    /* ── Expense tracker ── */
    "expense tracker app",
    "daily expense manager",
    "personal finance tracker free",
    "wallet tracker app",
    /* ── General ── */
    "productivity suite free",
    "all in one productivity app",
    "employee productivity app",
    "productivity tools for employees",
  ],
  authors: [{ name: "Nitrajsinh Solanki" }],
  creator: "Nitrajsinh Solanki",
  openGraph: {
    type:     "website",
    locale:   "en_US",
    url:      "https://hourbit.vercel.app",
    siteName: "Hour Bit",
    title:
      "Hour Bit — Free Work Hours Tracker + Productivity Suite for Employees",
    description:
      "Track work hours, quiz your brain, write in your diary, test typing speed, and manage expenses — all free, all in one app. No credit card. No spreadsheets.",
    images: [
      {
        url:    "/og-image.png",
        width:  1200,
        height: 630,
        alt:    "Hour Bit — Free Productivity Suite: Work Tracker, Quiz, Diary, Typing, Expenses",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Hour Bit — Free Productivity Suite for Employees",
    description:
      "Work hours tracker + Brain Quiz + Personal Diary + Typing Test + Expense Tracker. 5 tools, 1 free app.",
    images: ["/og-image.png"],
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:                true,
      follow:               true,
      "max-video-preview":  -1,
      "max-image-preview":  "large",
      "max-snippet":        -1,
    },
  },
  alternates: {
    canonical: "https://hourbit.vercel.app",
  },
};

/* ─── JSON-LD Structured Data ─────────────────────────── */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [

    /* WebSite entity */
    {
      "@type": "WebSite",
      "@id":   "https://hourbit.vercel.app/#website",
      name:    "Hour Bit",
      url:     "https://hourbit.vercel.app",
      description:
        "Free all-in-one productivity suite for employees: Work Hours Tracker, Brain Quiz, Personal Diary, Typing Speed Test, and Expense Tracker.",
      potentialAction: {
        "@type":       "SearchAction",
        target:        "https://hourbit.vercel.app/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },

    /* WebApplication entity */
    {
      "@type":               "WebApplication",
      "@id":                 "https://hourbit.vercel.app/#webapp",
      name:                  "Hour Bit",
      url:                   "https://hourbit.vercel.app",
      description:
        "Free productivity suite for employees. Track work hours with live leave time prediction, challenge yourself with a Brain Quiz, write a personal diary, measure typing speed (WPM), and track daily expenses — all in one secure web app.",
      applicationCategory:   "BusinessApplication",
      applicationSubCategory: "ProductivityApplication",
      operatingSystem:       "Web, iOS, Android (PWA)",
      offers: {
        "@type":         "Offer",
        price:           "0",
        priceCurrency:   "USD",
        availability:    "https://schema.org/InStock",
        priceValidUntil: "2099-12-31",
      },
      featureList: [
        "Real-time work hours tracking with leave time prediction",
        "Smart break time deduction and automatic calculation",
        "Past attendance record editing for any date",
        "Holiday and leave management",
        "Productivity analytics with CSV and PDF export",
        "Brain Quiz with XP rewards and leaderboard",
        "Personal diary with search and custom settings",
        "Typing speed test (WPM) with history and analytics",
        "Expense tracker with wallet, categories, and analysis",
        "JWT authentication and per-device session management",
      ],
      screenshot:      "https://hourbit.vercel.app/og-image.png",
      aggregateRating: {
        "@type":       "AggregateRating",
        ratingValue:   "4.9",
        reviewCount:   "128",
      },
      author: {
        "@type": "Person",
        name:    "Nitrajsinh Solanki",
        url:     "https://my-portfolio-xi-ochre-28.vercel.app/",
      },
    },

    /* Organization entity */
    {
      "@type": "Organization",
      "@id":   "https://hourbit.vercel.app/#org",
      name:    "Hour Bit",
      url:     "https://hourbit.vercel.app",
      logo:    "https://hourbit.vercel.app/logo.png",
      sameAs: [
        "https://github.com/Nitrajsinh-Solanki",
        "https://www.linkedin.com/in/nitrajsinh-solanki-647b11293",
        "https://x.com/Nitrajsinh_S",
      ],
    },

    /* HowTo schema for work tracking */
    {
      "@type":       "HowTo",
      "@id":         "https://hourbit.vercel.app/#howto-work-tracker",
      name:          "How to Track Work Hours with Hour Bit",
      description:
        "Use Hour Bit's free work hours tracker to automatically calculate productive hours, deduct breaks, and predict your exact leave time.",
      totalTime:     "PT1M",
      tool: [{ "@type": "HowToTool", name: "Hour Bit (free)" }],
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name:    "Clock In — Log Your Arrival Time",
          text:    "Hit 'Mark Entry' when you arrive at work. Hour Bit instantly starts a real-time productive hours counter tracking every minute from that point.",
          url:     "https://hourbit.vercel.app/#how-it-works",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name:    "Log Breaks as They Happen",
          text:    "Add lunch, tea, or custom breaks as they occur. Hour Bit deducts each break duration from your productive time in real time, keeping your leave prediction accurate.",
          url:     "https://hourbit.vercel.app/#how-it-works",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name:    "Leave When Hour Bit Says Go",
          text:    "Watch the live predicted leave time countdown. The moment you complete your 8.5-hour productive target, Hour Bit confirms your day is done — no guessing.",
          url:     "https://hourbit.vercel.app/#how-it-works",
        },
      ],
    },

    /* FAQPage schema — AEO optimised (covers all 5 features) */
    {
      "@type": "FAQPage",
      "@id":   "https://hourbit.vercel.app/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name:    "Is Hour Bit completely free?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. Hour Bit is 100% free with no credit card required and no hidden fees. All five tools — Work Tracker, Brain Quiz, Diary, Typing Test, and Expense Tracker — are available at no cost. Create your account and start using all features in under 60 seconds.",
          },
        },
        {
          "@type": "Question",
          name:    "What tools does Hour Bit include?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Hour Bit includes five productivity tools: (1) Work Hours Tracker with real-time leave prediction, (2) Brain Quiz with XP rewards and leaderboard, (3) Personal Diary for private daily journaling, (4) Typing Speed Test to measure WPM with history, and (5) Expense Tracker with wallet and spending analysis.",
          },
        },
        {
          "@type": "Question",
          name:    "How does Hour Bit calculate my leave time?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Hour Bit records your clock-in time, sums up all logged break durations, subtracts break time from total elapsed time, and predicts the exact time you will complete your daily target hours (default 8.5 hours). The predicted leave time updates live every second.",
          },
        },
        {
          "@type": "Question",
          name:    "Can I track flexible work hours with Hour Bit?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. Hour Bit is purpose-built for employees on flexible timing policies. You set your own daily work hours target and the app handles the rest — no fixed 9-to-5 required. It works for 8-hour, 8.5-hour, or any custom daily schedule.",
          },
        },
        {
          "@type": "Question",
          name:    "Can I edit past work records in Hour Bit?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. The 'Go Date Wise' feature lets you retroactively add or edit any past date's work log — entry time, breaks, and exit time — as if you had tracked it live.",
          },
        },
        {
          "@type": "Question",
          name:    "What is the Brain Quiz feature in Hour Bit?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Brain Quiz is Hour Bit's built-in knowledge challenge system. You earn XP (experience points) for correct answers, compete on leaderboards, and progress through levels across multiple categories and subcategories — making daily mental exercise rewarding.",
          },
        },
        {
          "@type": "Question",
          name:    "Can I use Hour Bit as a personal diary app?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. Hour Bit includes a private personal diary where you can write dated journal entries, search past entries, and configure diary settings. All entries are secured behind your account authentication.",
          },
        },
        {
          "@type": "Question",
          name:    "Does Hour Bit have a typing speed test?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. Hour Bit's Typing Speed Test measures your words per minute (WPM) and accuracy. Results are saved with full history and analytics so you can track your improvement over time.",
          },
        },
        {
          "@type": "Question",
          name:    "How does the Expense Tracker work in Hour Bit?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Hour Bit's Expense Tracker gives you a personal digital wallet. You can add money, log daily expenses by category, view transaction history, delete batches of transactions, and see spending analysis with charts to understand your financial patterns.",
          },
        },
        {
          "@type": "Question",
          name:    "Is Hour Bit secure?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Yes. Hour Bit uses JWT (JSON Web Token) authentication, bcrypt password hashing, email OTP verification for account actions, per-device session management so you can review and remove active sessions, and rate limiting to prevent abuse.",
          },
        },
      ],
    },
  ],
};

/* ─── Page component ───────────────────────────────────── */
export default function Page() {
  return (
    <>
      {/* Redirect logged-in users to /dashboard automatically */}
      <AutoRedirect />

      {/* Structured data for SEO & AEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <HomePage />
    </>
  );
}