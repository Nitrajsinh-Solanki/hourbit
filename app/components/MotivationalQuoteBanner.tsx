"use client";

// components/MotivationalQuoteBanner.tsx
// Drop into your top navbar — large screens only (hidden below xl)
// Usage: <MotivationalQuoteBanner firstName="Nikulsinh" isDark={isDark} />

import React, { useEffect, useMemo, useRef, useState } from "react";

// ── 200 quotes — motivational, dark, professional, reality-check ──
const QUOTES = [
  // REALITY CHECKERS
  { text: "Nobody is coming to save you. Get up and save yourself.", tag: "reality" },
  { text: "Your comfort zone is a beautiful place where nothing ever grows.", tag: "reality" },
  { text: "The world doesn't owe you anything. It was here first.", tag: "reality" },
  { text: "Talent without discipline is just wasted potential.", tag: "reality" },
  { text: "Stop waiting for the right time. There is no right time.", tag: "reality" },
  { text: "Your feelings are valid. Your excuses are not.", tag: "reality" },
  { text: "You are not special enough to skip the fundamentals.", tag: "reality" },
  { text: "Motivation is a myth. Discipline is the engine.", tag: "reality" },
  { text: "The version of you that posts about goals and the one that achieves them are different people.", tag: "reality" },
  { text: "Suffering is optional only after you've done the work.", tag: "reality" },
  { text: "No one applauds the preparation. They only see the performance.", tag: "reality" },
  { text: "Average people hate being called average.", tag: "reality" },
  { text: "You can be comfortable or you can grow. Not both.", tag: "reality" },
  { text: "Most of your problems are a result of how you spend your mornings.", tag: "reality" },
  { text: "The gap between who you are and who you want to be is called work.", tag: "reality" },
  { text: "Overthinking is just procrastination wearing a lab coat.", tag: "reality" },
  { text: "Pain is data. Fear is a lie. Act anyway.", tag: "reality" },
  { text: "Potential means nothing if it's buried under inaction.", tag: "reality" },
  { text: "The truth is you have time. You just spend it poorly.", tag: "reality" },
  { text: "Being busy and being productive are not the same thing.", tag: "reality" },

  // DARK / STOIC
  { text: "You will die. Make whatever is between now and then count.", tag: "dark" },
  { text: "Nobody remembers what you almost did.", tag: "dark" },
  { text: "The clock never stops. Not for grief, not for doubt, not for you.", tag: "dark" },
  { text: "Regret is the heaviest thing a person carries. Pack accordingly.", tag: "dark" },
  { text: "Every day you delay is a day you can never reclaim.", tag: "dark" },
  { text: "There will come a day when you can no longer do this. Today is not that day.", tag: "dark" },
  { text: "Death is certain. Excellence is optional. Choose.", tag: "dark" },
  { text: "The graveyard is full of unrealized potential.", tag: "dark" },
  { text: "Time is the one currency you cannot earn back.", tag: "dark" },
  { text: "What you fail to confront today will haunt you tomorrow.", tag: "dark" },
  { text: "Fear doesn't disappear. You just become bigger than it.", tag: "dark" },
  { text: "The world is indifferent to your struggles. That's actually freeing.", tag: "dark" },
  { text: "Hard roads build better travelers.", tag: "dark" },
  { text: "You weren't promised an easy life. Build the hard one anyway.", tag: "dark" },
  { text: "Everything meaningful was built in discomfort.", tag: "dark" },
  { text: "Your future self is either thanking you or paying for your choices today.", tag: "dark" },
  { text: "Not trying guarantees failure. Trying only risks it.", tag: "dark" },
  { text: "The only guarantee in life is that doing nothing guarantees nothing.", tag: "dark" },
  { text: "You don't rise to your aspirations. You fall to your systems.", tag: "dark" },
  { text: "Ambition without sacrifice is just daydreaming.", tag: "dark" },

  // PROFESSIONAL / CAREER
  { text: "Your reputation is the career you haven't built yet.", tag: "professional" },
  { text: "The room you are in will never change if you stay comfortable in it.", tag: "professional" },
  { text: "Do the work no one sees. It builds everything everyone notices.", tag: "professional" },
  { text: "Underpromise, overdeliver, repeat until irreplaceable.", tag: "professional" },
  { text: "Your network is your net worth only if your work backs it up.", tag: "professional" },
  { text: "Be so good they can't ignore you.", tag: "professional" },
  { text: "Professionals show up. Amateurs wait until they feel like it.", tag: "professional" },
  { text: "Your attitude toward feedback determines the ceiling of your career.", tag: "professional" },
  { text: "Every expert was once a beginner who refused to quit.", tag: "professional" },
  { text: "The compound interest of daily improvement is called mastery.", tag: "professional" },
  { text: "Nobody cares about your process. They care about your results.", tag: "professional" },
  { text: "If you're the smartest in the room you're in the wrong room.", tag: "professional" },
  { text: "The best time to build the skill was two years ago. The second best is now.", tag: "professional" },
  { text: "Soft skills will outlast every certification you ever earn.", tag: "professional" },
  { text: "Do not mistake activity for achievement.", tag: "professional" },
  { text: "The person who reads the most in the room usually wins the room.", tag: "professional" },
  { text: "Own your failures publicly. Own your process privately.", tag: "professional" },
  { text: "Your calendar is a confession of your real priorities.", tag: "professional" },
  { text: "Stop chasing titles. Chase craft. The titles follow.", tag: "professional" },
  { text: "A good reputation takes years to build and seconds to destroy.", tag: "professional" },

  // DISCIPLINE / FOCUS
  { text: "Discipline is choosing what you want most over what you want now.", tag: "discipline" },
  { text: "One focused hour beats ten distracted ones every single time.", tag: "discipline" },
  { text: "Excellence is a habit, not an event.", tag: "discipline" },
  { text: "Your routine is your destiny running on autopilot.", tag: "discipline" },
  { text: "The body achieves what the mind believes consistently.", tag: "discipline" },
  { text: "Focus is a decision, not a gift.", tag: "discipline" },
  { text: "Win the morning. Win the day.", tag: "discipline" },
  { text: "Silence your phone. Silence your mediocrity.", tag: "discipline" },
  { text: "Control your attention and you control your life.", tag: "discipline" },
  { text: "You get what you repeatedly do, not what you occasionally attempt.", tag: "discipline" },
  { text: "Discipline is the bridge between goals and accomplishment.", tag: "discipline" },
  { text: "Every professional was once an amateur who showed up every day.", tag: "discipline" },
  { text: "Small disciplines repeated every day produce remarkable results.", tag: "discipline" },
  { text: "The secret of your success is found in your daily agenda.", tag: "discipline" },
  { text: "What you tolerate you teach. What you repeat you become.", tag: "discipline" },
  { text: "Self-discipline is the only superpower that's free.", tag: "discipline" },
  { text: "Burn the boats. Remove the option of retreat.", tag: "discipline" },
  { text: "Champions aren't made in rings. They're made in habits.", tag: "discipline" },
  { text: "Your brain wants comfort. Your goals want effort. You decide.", tag: "discipline" },
  { text: "Less planning. More starting.", tag: "discipline" },

  // GROWTH / MINDSET
  { text: "Every master was once a disaster who didn't stop.", tag: "growth" },
  { text: "Failure is just success with more data attached.", tag: "growth" },
  { text: "You are not behind. You are exactly where your choices put you.", tag: "growth" },
  { text: "The ceiling of your growth is set by the questions you stop asking.", tag: "growth" },
  { text: "Criticism from the uninitiated is just noise. Criticism from the advanced is gold.", tag: "growth" },
  { text: "The longer you wait to start, the longer you wait to arrive.", tag: "growth" },
  { text: "Being wrong is a feature, not a bug, if you update the model.", tag: "growth" },
  { text: "You don't need more information. You need more action.", tag: "growth" },
  { text: "Growth is uncomfortable. That discomfort is confirmation you're moving.", tag: "growth" },
  { text: "Small consistent actions compound into extraordinary lives.", tag: "growth" },
  { text: "You can't go back and make a better start. You can start now and make a better end.", tag: "growth" },
  { text: "Embrace the season of difficulty. It's doing the heavy lifting for your character.", tag: "growth" },
  { text: "The version of you six months from now depends on today.", tag: "growth" },
  { text: "Strength doesn't come from what you can do. It comes from overcoming what you couldn't.", tag: "growth" },
  { text: "Compare yourself only to who you were yesterday.", tag: "growth" },
  { text: "Your limitations are mostly negotiable.", tag: "growth" },
  { text: "Obstacles are assignments in disguise.", tag: "growth" },
  { text: "The struggle you are in today is developing the strength you need for tomorrow.", tag: "growth" },
  { text: "You level up when you stop avoiding hard things.", tag: "growth" },
  { text: "Comfort and growth are in a permanent war. Pick a side daily.", tag: "growth" },

  // RESILIENCE
  { text: "Results live on the other side of resistance.", tag: "resilience" },
  { text: "Fall seven times. Stand eight. Count carefully.", tag: "resilience" },
  { text: "You have survived 100% of your worst days. The record holds.", tag: "resilience" },
  { text: "Breaking down and rebuilding is not failure. It is renovation.", tag: "resilience" },
  { text: "Pressure doesn't break diamonds. It makes them.", tag: "resilience" },
  { text: "The strongest steel goes through the hottest fire.", tag: "resilience" },
  { text: "What almost killed you built you.", tag: "resilience" },
  { text: "Endurance is quiet courage compounding daily.", tag: "resilience" },
  { text: "There's no shortcut around suffering. There's only a way through it.", tag: "resilience" },
  { text: "Scars are proof the wound couldn't stop you.", tag: "resilience" },
  { text: "Your lowest point is your starting point. Not your finish line.", tag: "resilience" },
  { text: "Resilience is not a trait. It's a practice.", tag: "resilience" },
  { text: "The comeback is always more powerful than the setback.", tag: "resilience" },
  { text: "Survive this chapter. The next one reads completely differently.", tag: "resilience" },
  { text: "Chaos is just order waiting to be constructed.", tag: "resilience" },
  { text: "If it's hard right now, you're working at the edge of your capability. Good.", tag: "resilience" },
  { text: "Warriors are forged not found.", tag: "resilience" },
  { text: "Difficulty is the universe's way of measuring your seriousness.", tag: "resilience" },
  { text: "Keep going. Not because it's easy. Because stopping costs more.", tag: "resilience" },
  { text: "Rock bottom has a way of building very solid foundations.", tag: "resilience" },

  // LEGACY / VISION
  { text: "Build something today that your future self will thank you for.", tag: "legacy" },
  { text: "The work you do today is the story you tell tomorrow.", tag: "legacy" },
  { text: "Leave every room, every project, every relationship better than you found it.", tag: "legacy" },
  { text: "Legacy is not what you leave behind. It's what you build while you're here.", tag: "legacy" },
  { text: "Think in decades. Act in days.", tag: "legacy" },
  { text: "Your name should mean something. Make sure you're the one who defines it.", tag: "legacy" },
  { text: "Long-term thinking is the rarest and most valuable skill of this century.", tag: "legacy" },
  { text: "The trees planted by those before you gave you shade. Plant yours.", tag: "legacy" },
  { text: "What you build in obscurity determines what you are celebrated for publicly.", tag: "legacy" },
  { text: "Ten years of real work will embarrass a lifetime of almost.", tag: "legacy" },
  { text: "Choose a direction. Commit to it. Compound it.", tag: "legacy" },
  { text: "The goal isn't to be the best right now. It's to still be here in ten years.", tag: "legacy" },
  { text: "Build systems, not just goals. Goals disappear. Systems persist.", tag: "legacy" },
  { text: "You are the decisions you haven't made yet.", tag: "legacy" },
  { text: "Clarity of purpose turns ordinary effort into mastery over time.", tag: "legacy" },
  { text: "The life you want requires you to become someone different.", tag: "legacy" },
  { text: "Think less about who you are. Think more about who you are becoming.", tag: "legacy" },
  { text: "Short-term pain with long-term gain beats comfort with long-term regret.", tag: "legacy" },
  { text: "Your story isn't over. The best chapters are usually not the early ones.", tag: "legacy" },
  { text: "Do the work that matters. Let time prove the rest.", tag: "legacy" },

  // MINDSET / PHILOSOPHY
  { text: "The quality of your thinking determines the quality of your decisions.", tag: "mindset" },
  { text: "Confidence is a result of doing hard things, not a prerequisite.", tag: "mindset" },
  { text: "You will never feel fully ready. Launch anyway.", tag: "mindset" },
  { text: "Clarity is power. Confusion is just clarity you haven't found yet.", tag: "mindset" },
  { text: "What you resist, persists. What you face, dissolves.", tag: "mindset" },
  { text: "You can be right, or you can be effective. Sometimes it's a choice.", tag: "mindset" },
  { text: "Your mind is the most powerful tool you own and the most neglected.", tag: "mindset" },
  { text: "Identity shapes behavior. Rewrite who you say you are.", tag: "mindset" },
  { text: "A made-up mind is the most dangerous weapon in any room.", tag: "mindset" },
  { text: "Arrogance is cured quickly by commitment to actual craft.", tag: "mindset" },
  { text: "The ego is expensive to maintain. Let it go and move faster.", tag: "mindset" },
  { text: "Obsession is just passion that didn't ask for permission.", tag: "mindset" },
  { text: "Every limitation you have is either biological or self-imposed. Start there.", tag: "mindset" },
  { text: "Awareness without action is just sophisticated suffering.", tag: "mindset" },
  { text: "The only ceiling that truly exists is the one you stop testing.", tag: "mindset" },
  { text: "You are the average of the standards you refuse to lower.", tag: "mindset" },
  { text: "Patience is aggressive. Impatience is just noise.", tag: "mindset" },
  { text: "The most successful people redefined what hard means to them.", tag: "mindset" },
  { text: "Think of this moment as the earliest point in your best timeline.", tag: "mindset" },
  { text: "You are not a finished product. You are a continuous draft.", tag: "mindset" },

  // ACTION / EXECUTION
  { text: "Momentum starts with a single, deliberate action.", tag: "action" },
  { text: "Perfection is the enemy of done. Done is the enemy of never.", tag: "action" },
  { text: "Move. Adjust. Move again. That's the entire strategy.", tag: "action" },
  { text: "Planning without execution is just expensive daydreaming.", tag: "action" },
  { text: "The first step is always the wrong one. Take it anyway.", tag: "action" },
  { text: "Done poorly beats not started perfectly every time.", tag: "action" },
  { text: "Decide faster. Most decisions are reversible. Paralysis isn't.", tag: "action" },
  { text: "Ship something today. Refine it tomorrow. Just ship.", tag: "action" },
  { text: "Ideas are worthless without the execution that makes them real.", tag: "action" },
  { text: "The best plan is the one you actually start.", tag: "action" },
  { text: "Bias toward action is the highest form of intelligence in uncertain conditions.", tag: "action" },
  { text: "Start before you're ready. Finish before you're comfortable.", tag: "action" },
  { text: "A good decision executed quickly beats a perfect decision executed never.", tag: "action" },
  { text: "Your ideas need legs. Put them on. Start walking.", tag: "action" },
  { text: "Show up. Do the thing. Repeat. That's the framework.", tag: "action" },
  { text: "There is no formula. There is only the work and whether you did it.", tag: "action" },
  { text: "The difference between where you are and where you want to be is what you do today.", tag: "action" },
  { text: "Commit to the start. Trust the process to reveal the finish.", tag: "action" },
  { text: "Taking action doesn't require certainty. It requires courage.", tag: "action" },
  { text: "You cannot think your way into the life you want. Act your way in.", tag: "action" },

  // FOCUS / DEEP WORK
  { text: "Depth beats breadth. Go deeper.", tag: "focus" },
  { text: "What you eliminate matters as much as what you pursue.", tag: "focus" },
  { text: "Every yes to distraction is a no to your future.", tag: "focus" },
  { text: "Shallow work makes you feel productive. Deep work makes you irreplaceable.", tag: "focus" },
  { text: "The most successful people you admire said no far more than they said yes.", tag: "focus" },
  { text: "Guard your attention like it's your most valuable asset. Because it is.", tag: "focus" },
  { text: "The rarest commodity in the modern world is uninterrupted thought.", tag: "focus" },
  { text: "Work at the edge of your ability for as long as possible today.", tag: "focus" },
  { text: "Fewer objectives pursued with total commitment beat many goals held loosely.", tag: "focus" },
  { text: "If everything is a priority, nothing is.", tag: "focus" },
  { text: "Turn off the noise. The signal gets louder.", tag: "focus" },
  { text: "The people winning quietly are the ones not distracted by the noise online.", tag: "focus" },
  { text: "Mastery requires monotony. Fall in love with repetition.", tag: "focus" },
  { text: "Your ability to focus deeply is your edge in a distracted world.", tag: "focus" },
  { text: "Schedule deep work or the shallow will consume it.", tag: "focus" },
  { text: "Boredom is the portal to your best ideas. Stop running from it.", tag: "focus" },
  { text: "Single-tasking is the new superpower.", tag: "focus" },
  { text: "Own the first two hours of your day and the rest follows.", tag: "focus" },
  { text: "Energy management matters more than time management.", tag: "focus" },
  { text: "The quality of your output is determined by the quality of your input and the depth of your focus.", tag: "focus" },
];

function getDailyQuote(): (typeof QUOTES)[number] {
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();

  return QUOTES[seed % QUOTES.length];
}

interface Props {
  firstName: string;
  isDark?: boolean;
}

const TAG_COLORS: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string; glow: string }
> = {
  reality: {
    bg: "rgba(220,38,38,0.10)",
    text: "#b91c1c",
    darkBg: "rgba(252,165,165,0.12)",
    darkText: "#fca5a5",
    glow: "rgba(248,113,113,0.35)",
  },
  dark: {
    bg: "rgba(88,28,135,0.12)",
    text: "#7c3aed",
    darkBg: "rgba(196,181,253,0.13)",
    darkText: "#c4b5fd",
    glow: "rgba(167,139,250,0.35)",
  },
  professional: {
    bg: "rgba(30,64,175,0.10)",
    text: "#1d4ed8",
    darkBg: "rgba(147,197,253,0.12)",
    darkText: "#93c5fd",
    glow: "rgba(96,165,250,0.35)",
  },
  discipline: {
    bg: "rgba(180,83,9,0.10)",
    text: "#b45309",
    darkBg: "rgba(253,186,116,0.12)",
    darkText: "#fdba74",
    glow: "rgba(251,191,36,0.35)",
  },
  growth: {
    bg: "rgba(6,95,70,0.10)",
    text: "#047857",
    darkBg: "rgba(110,231,183,0.12)",
    darkText: "#6ee7b7",
    glow: "rgba(52,211,153,0.35)",
  },
  resilience: {
    bg: "rgba(190,18,60,0.10)",
    text: "#be123c",
    darkBg: "rgba(253,164,175,0.12)",
    darkText: "#fda4af",
    glow: "rgba(244,114,182,0.35)",
  },
  legacy: {
    bg: "rgba(124,45,18,0.10)",
    text: "#9a3412",
    darkBg: "rgba(253,186,116,0.12)",
    darkText: "#fed7aa",
    glow: "rgba(251,146,60,0.35)",
  },
  mindset: {
    bg: "rgba(15,118,110,0.10)",
    text: "#0f766e",
    darkBg: "rgba(153,246,228,0.12)",
    darkText: "#99f6e4",
    glow: "rgba(45,212,191,0.35)",
  },
  action: {
    bg: "rgba(99,102,241,0.12)",
    text: "#4f46e5",
    darkBg: "rgba(165,180,252,0.13)",
    darkText: "#a5b4fc",
    glow: "rgba(129,140,248,0.35)",
  },
  focus: {
    bg: "rgba(3,105,161,0.10)",
    text: "#0369a1",
    darkBg: "rgba(125,211,252,0.12)",
    darkText: "#7dd3fc",
    glow: "rgba(56,189,248,0.35)",
  },
};

export default function MotivationalQuoteBanner({
  firstName,
  isDark = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [textIn, setTextIn] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);

  const quote = useMemo(() => getDailyQuote(), []);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tagColor = TAG_COLORS[quote.tag] ?? TAG_COLORS.action;

  useEffect(() => {
    setMounted(true);

    const t1 = setTimeout(() => setVisible(true), 180);
    const t2 = setTimeout(() => setTextIn(true), 380);
    const t3 = setTimeout(() => setGlowing(true), 850);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (!textIn) return;

    let i = 0;
    setTypedText("");
    setTypingDone(false);

    const type = () => {
      if (i < quote.text.length) {
        setTypedText(quote.text.slice(0, i + 1));
        i++;
        typingTimeoutRef.current = setTimeout(type, 18);
      } else {
        setTypingDone(true);
      }
    };

    const starter = setTimeout(type, 320);

    return () => {
      clearTimeout(starter);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [textIn, quote.text]);

  useEffect(() => {
    if (!mounted) return;

    const shimmerInterval = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1000);
    }, 6500);

    const glowInterval = setInterval(() => {
      setGlowing(false);
      setTimeout(() => setGlowing(true), 120);
    }, 12000);

    return () => {
      clearInterval(shimmerInterval);
      clearInterval(glowInterval);
    };
  }, [mounted]);

  const pillBg = isDark ? tagColor.darkBg : tagColor.bg;
  const pillText = isDark ? tagColor.darkText : tagColor.text;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');

        /* ─────────────────────────────
           KEYFRAMES
        ───────────────────────────── */
        @keyframes mqBannerIn {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.97);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }

        @keyframes mqTextIn {
          0% {
            opacity: 0;
            transform: translateX(-8px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes mqDotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
            box-shadow: 0 0 0 0 rgba(129,140,248,0);
          }
          50% {
            transform: scale(1.9);
            opacity: 1;
            box-shadow: 0 0 10px 4px rgba(129,140,248,0.5);
          }
        }

        @keyframes mqShimmer {
          0% {
            background-position: -250% center;
          }
          100% {
            background-position: 250% center;
          }
        }

        @keyframes mqGlowPulse {
          0%, 100% {
            box-shadow:
              0 0 0px rgba(129,140,248,0),
              0 0 0px rgba(129,140,248,0);
          }
          50% {
            box-shadow:
              0 0 18px rgba(129,140,248,0.10),
              0 0 34px rgba(129,140,248,0.08);
          }
        }

        @keyframes mqNameSlide {
          0% {
            opacity: 0;
            letter-spacing: 0.16em;
            transform: translateY(2px);
          }
          100% {
            opacity: 1;
            letter-spacing: 0.06em;
            transform: translateY(0);
          }
        }

        @keyframes mqQuoteFade {
          0% {
            opacity: 0;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mqCursorBlink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }

        @keyframes mqTagPop {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          60% {
            transform: scale(1.06);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes mqBarScan {
          0% {
            transform: scaleX(0);
            transform-origin: left;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          50% {
            transform: scaleX(1);
            transform-origin: left;
            opacity: 1;
          }
          50.01% {
            transform-origin: right;
          }
          100% {
            transform: scaleX(0);
            transform-origin: right;
            opacity: 0;
          }
        }

        @keyframes mqBorderFlow {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }

        @keyframes mqAurora {
          0%, 100% {
            transform: translateX(-8%) translateY(0%) rotate(0deg);
            opacity: 0.35;
          }
          50% {
            transform: translateX(8%) translateY(-3%) rotate(6deg);
            opacity: 0.55;
          }
        }

        /* ─────────────────────────────
           WRAPPER
        ───────────────────────────── */
        .mq-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px 8px 10px;
          border-radius: 18px;
          max-width: 620px;
          min-width: 0;
          overflow: hidden;
          flex-shrink: 1;
          opacity: 0;
          position: relative;
          isolation: isolate;
          transition:
            transform 0.35s ease,
            border-color 0.45s ease,
            background 0.45s ease,
            box-shadow 0.45s ease;
          will-change: transform, opacity;
        }

        .mq-banner:hover {
          transform: translateY(-1px) scale(1.015);
        }

        .mq-banner.mq-in {
          animation: mqBannerIn 0.75s cubic-bezier(0.22,1,0.36,1) forwards;
        }

        .mq-banner.mq-glow {
          animation:
            mqBannerIn 0.75s cubic-bezier(0.22,1,0.36,1) forwards,
            mqGlowPulse 4s ease-in-out 1s infinite;
        }

        /* Animated gradient border */
        .mq-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(129,140,248,0.35) 18%,
            rgba(56,189,248,0.28) 34%,
            rgba(168,85,247,0.28) 52%,
            rgba(129,140,248,0.35) 70%,
            transparent 100%
          );
          background-size: 220% 220%;
          animation: mqBorderFlow 8s linear infinite;
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 2;
          opacity: 0.85;
        }

        /* Aurora glow layer */
        .mq-aurora {
          position: absolute;
          inset: -20% -10%;
          background:
            radial-gradient(circle at 20% 30%, rgba(129,140,248,0.18), transparent 30%),
            radial-gradient(circle at 80% 20%, rgba(56,189,248,0.16), transparent 28%),
            radial-gradient(circle at 60% 80%, rgba(168,85,247,0.14), transparent 32%);
          filter: blur(28px);
          animation: mqAurora 8s ease-in-out infinite;
          z-index: 0;
          pointer-events: none;
        }

        /* Bottom scan bar */
        .mq-banner::after {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 1.5px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(129,140,248,0.75),
            rgba(56,189,248,0.55),
            transparent
          );
          transform: scaleX(0);
          animation: mqBarScan 6s ease-in-out 1.3s infinite;
          z-index: 3;
        }

        /* ─────────────────────────────
           DOT
        ───────────────────────────── */
        .mq-dot-wrap {
          position: relative;
          flex-shrink: 0;
          z-index: 4;
        }

        .mq-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          animation: mqDotPulse 2.8s ease-in-out infinite;
        }

        /* ─────────────────────────────
           DIVIDER
        ───────────────────────────── */
        .mq-divider {
          flex-shrink: 0;
          width: 1px;
          height: 22px;
          align-self: center;
          z-index: 4;
        }

        /* ─────────────────────────────
           TEXT BLOCK
        ───────────────────────────── */
        .mq-texts {
          display: flex;
          align-items: baseline;
          gap: 6px;
          min-width: 0;
          overflow: hidden;
          opacity: 0;
          z-index: 4;
        }

        .mq-texts.mq-text-in {
          animation: mqTextIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.08s forwards;
        }

        .mq-name {
          font-family: 'DM Serif Display', Georgia, serif;
          font-style: italic;
          font-size: 12px;
          font-weight: 400;
          white-space: nowrap;
          flex-shrink: 0;
          opacity: 0;
          letter-spacing: 0.06em;
          text-shadow: 0 0 12px rgba(129,140,248,0.10);
        }

        .mq-name.mq-name-in {
          animation: mqNameSlide 0.55s cubic-bezier(0.22,1,0.36,1) 0.2s forwards;
        }

        .mq-sep {
          font-size: 10px;
          flex-shrink: 0;
          opacity: 0.35;
          margin: 0 1px;
        }

        .mq-quote {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 11.8px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0;
          flex: 1 1 0;
          min-width: 0;
          line-height: 1.45;
        }

        .mq-quote.mq-quote-in {
          animation: mqQuoteFade 0.55s cubic-bezier(0.22,1,0.36,1) 0.32s forwards;
        }

        .mq-cursor {
          display: inline-block;
          width: 1.5px;
          height: 0.9em;
          border-radius: 999px;
          vertical-align: middle;
          margin-left: 2px;
          animation: mqCursorBlink 1s step-start infinite;
        }

        /* ─────────────────────────────
           TAG PILL
        ───────────────────────────── */
        .mq-tag {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
          opacity: 0;
          border: 1px solid transparent;
          transition:
            background 0.4s ease,
            color 0.4s ease,
            border-color 0.4s ease,
            transform 0.3s ease;
          z-index: 4;
          position: relative;
          overflow: hidden;
        }

        .mq-tag:hover {
          transform: translateY(-1px);
        }

        .mq-tag.mq-tag-in {
          animation: mqTagPop 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.55s forwards;
        }

        .mq-tag.mq-shimmer {
          background-image:
            linear-gradient(
              90deg,
              transparent 0%,
              rgba(255,255,255,0.28) 45%,
              transparent 85%
            );
          background-size: 280% auto;
          background-repeat: no-repeat;
          animation:
            mqTagPop 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.55s forwards,
            mqShimmer 1s linear;
        }
      `}</style>

      <div
        className={`mq-banner hidden xl:flex ${
          visible ? (glowing ? "mq-in mq-glow" : "mq-in") : ""
        }`}
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))"
            : "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.52))",
          border: `1px solid ${
            isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.65)"
          }`,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow: isDark
            ? `0 10px 35px rgba(0,0,0,0.28), 0 0 24px ${tagColor.glow.replace("0.35", "0.12")}`
            : `0 10px 30px rgba(15,23,42,0.08), 0 0 18px ${tagColor.glow.replace("0.35", "0.10")}`,
        }}
        aria-label="Daily motivational quote"
        title={quote.text}
      >
        {/* Aurora background */}
        <div className="mq-aurora" />

        {/* Pulsing dot */}
        <div className="mq-dot-wrap">
          <span
            className="mq-dot"
            style={{
              background: isDark ? "#818cf8" : "#6366f1",
            }}
          />
        </div>

        {/* Divider */}
        <span
          className="mq-divider"
          style={{
            background: isDark
              ? "rgba(255,255,255,0.10)"
              : "rgba(15,23,42,0.10)",
          }}
        />

        {/* Text */}
        <div className={`mq-texts ${textIn ? "mq-text-in" : ""}`}>
          <span
            className={`mq-name ${textIn ? "mq-name-in" : ""}`}
            style={{
              color: isDark ? "#c7d2fe" : "#312e81",
            }}
          >
            Hey, {firstName} ✦
          </span>

          <span
            className="mq-sep"
            style={{ color: isDark ? "#64748b" : "#9ca3af" }}
          >
            —
          </span>

          <span
            className={`mq-quote ${textIn ? "mq-quote-in" : ""}`}
            style={{
              color: isDark ? "#cbd5e1" : "#334155",
            }}
          >
            {typedText}
            {!typingDone && textIn && (
              <span
                className="mq-cursor"
                style={{
                  background: isDark ? "#818cf8" : "#6366f1",
                }}
              />
            )}
          </span>
        </div>

        {/* Tag pill */}
        <span
          className={`mq-tag ${textIn ? "mq-tag-in" : ""} ${
            shimmer ? "mq-shimmer" : ""
          }`}
          style={{
            background: pillBg,
            color: pillText,
            borderColor: isDark ? `${pillText}22` : `${pillText}25`,
            boxShadow: `0 0 16px ${tagColor.glow.replace("0.35", "0.14")}`,
          }}
        >
          #{quote.tag}
        </span>
      </div>
    </>
  );
}