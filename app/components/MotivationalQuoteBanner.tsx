"use client";

// components/MotivationalQuoteBanner.tsx
// Premium motivational quote banner with intelligent overflow handling

import React, { useEffect, useMemo, useRef, useState } from "react";

// ── 200 quotes — motivational, dark, professional, reality-check ──
const QUOTES = [
  // INSPIRATION
  { text: "Every day is a new beginning. Take a deep breath and start again.", tag: "inspiration" },
  { text: "You are capable of amazing things — the world is waiting for you to show it.", tag: "inspiration" },
  { text: "Believe you can and you're halfway there.", tag: "inspiration" },
  { text: "The best time to be happy is right now.", tag: "inspiration" },
  { text: "Your story isn't over yet — the best chapters are still ahead.", tag: "inspiration" },
  { text: "Stars can't shine without darkness. You're already shining.", tag: "inspiration" },
  { text: "Every sunrise is an invitation to brighten someone's day.", tag: "inspiration" },
  { text: "You have everything you need to begin.", tag: "inspiration" },
  { text: "The world is full of possibilities — you just have to reach for one.", tag: "inspiration" },
  { text: "Be the energy you wish to attract.", tag: "inspiration" },
  { text: "Small steps every day lead to big destinations.", tag: "inspiration" },
  { text: "Your potential is limitless. Trust the journey.", tag: "inspiration" },
  { text: "Today is full of opportunities disguised as ordinary moments.", tag: "inspiration" },
  { text: "Bloom where you are planted — your season is coming.", tag: "inspiration" },
  { text: "You are braver than you believe, stronger than you seem.", tag: "inspiration" },
  { text: "Chase the vision, not the applause, and success will follow.", tag: "inspiration" },
  { text: "One small positive thought in the morning can change your entire day.", tag: "inspiration" },
  { text: "You are a masterpiece still being created.", tag: "inspiration" },
  { text: "There is magic in new beginnings.", tag: "inspiration" },
  { text: "Life is short, make it beautiful.", tag: "inspiration" },
  { text: "Your light is needed in this world. Keep shining.", tag: "inspiration" },
  { text: "Dream it. Believe it. Build it.", tag: "inspiration" },
  { text: "The universe is conspiring in your favor — keep going.", tag: "inspiration" },
  { text: "You are exactly where you need to be right now.", tag: "inspiration" },
  { text: "Everything you need is already within you.", tag: "inspiration" },
  { text: "Great things take time and you are worth every second.", tag: "inspiration" },
  { text: "You carry the power to create the life you dream of.", tag: "inspiration" },
  { text: "Choose joy — it's available to you every single day.", tag: "inspiration" },
  { text: "The energy you bring today shapes the world around you.", tag: "inspiration" },
  { text: "You are worthy of all the beautiful things life has to offer.", tag: "inspiration" },

  // GROWTH
  { text: "Growth begins the moment you step outside your comfort zone with a smile.", tag: "growth" },
  { text: "Every experience you have is shaping the incredible person you're becoming.", tag: "growth" },
  { text: "You don't have to be perfect — you just have to keep growing.", tag: "growth" },
  { text: "Learning something new today is the greatest gift you can give yourself.", tag: "growth" },
  { text: "Progress, no matter how small, is still progress. Celebrate it.", tag: "growth" },
  { text: "The person you are becoming is more important than the person you were yesterday.", tag: "growth" },
  { text: "Every skill you build today becomes a superpower for tomorrow.", tag: "growth" },
  { text: "You are not the same person you were a year ago — and that's beautiful.", tag: "growth" },
  { text: "Growth is not a straight line, and that's perfectly okay.", tag: "growth" },
  { text: "The willingness to grow is the beginning of wisdom.", tag: "growth" },
  { text: "Every challenge you embrace makes you more capable than before.", tag: "growth" },
  { text: "Be patient with yourself — great things are growing inside you.", tag: "growth" },
  { text: "You are always evolving into a better version of yourself.", tag: "growth" },
  { text: "Invest in yourself today and watch the returns bloom for years.", tag: "growth" },
  { text: "The most beautiful growth happens quietly, consistently, day by day.", tag: "growth" },
  { text: "You have grown through everything life has brought you. Keep growing.", tag: "growth" },
  { text: "Every lesson is a gift. Every stumble is a teacher. Keep going.", tag: "growth" },
  { text: "Your best days are built one good decision at a time.", tag: "growth" },
  { text: "The version of you six months from now will thank you for starting today.", tag: "growth" },
  { text: "Curiosity is the engine of growth — stay wonderfully curious.", tag: "growth" },
  { text: "You are a work in progress and that is a beautiful thing to be.", tag: "growth" },
  { text: "Every day you choose to learn, you choose to grow.", tag: "growth" },
  { text: "Trust the process. Roots grow before the flowers bloom.", tag: "growth" },
  { text: "Stretch yourself gently and watch how far you can reach.", tag: "growth" },
  { text: "The seeds you plant today will become the forest of your future.", tag: "growth" },
  { text: "Your growth inspires more people than you will ever know.", tag: "growth" },
  { text: "Every new day is a new chance to grow into who you're meant to be.", tag: "growth" },
  { text: "Read more, learn more, become more — one page at a time.", tag: "growth" },
  { text: "Greatness is built in the quiet moments of daily practice.", tag: "growth" },
  { text: "You are becoming the person the world needs — keep growing.", tag: "growth" },

  // SUCCESS
  { text: "Success is not a destination — it's a daily commitment to your best self.", tag: "success" },
  { text: "Show up consistently and the results will take care of themselves.", tag: "success" },
  { text: "Hard work quietly builds what ambition loudly declares.", tag: "success" },
  { text: "Your dedication today is writing your success story for tomorrow.", tag: "success" },
  { text: "The secret of success is getting started and never fully stopping.", tag: "success" },
  { text: "Excellence is a habit crafted one great day at a time.", tag: "success" },
  { text: "Success loves the person who shows up even when it's hard.", tag: "success" },
  { text: "Dream big and back it with bold, consistent action.", tag: "success" },
  { text: "You are one decision away from a completely different life.", tag: "success" },
  { text: "Every great success story began with a single brave step forward.", tag: "success" },
  { text: "The harder you work, the luckier you tend to become.", tag: "success" },
  { text: "Commit to excellence in the small things and the big things follow.", tag: "success" },
  { text: "Success is built in the moments no one sees but you.", tag: "success" },
  { text: "Your work ethic is your most valuable signature.", tag: "success" },
  { text: "Give everything you have to what you do today. That's success.", tag: "success" },
  { text: "Bring your absolute best to this moment — it matters more than you know.", tag: "success" },
  { text: "The compound interest of daily effort is extraordinary achievement.", tag: "success" },
  { text: "You are building something magnificent — keep laying the bricks.", tag: "success" },
  { text: "Success is the sum of small efforts repeated day in and day out.", tag: "success" },
  { text: "Persistence and consistency will always outperform talent alone.", tag: "success" },
  { text: "There is no traffic on the extra mile — and the view is worth it.", tag: "success" },
  { text: "Every expert was once a beginner who kept going. You will get there.", tag: "success" },
  { text: "Your consistency is your greatest competitive advantage.", tag: "success" },
  { text: "The way to get started is to quit talking and begin doing.", tag: "success" },
  { text: "You have the right ingredients. Start mixing and watch what you create.", tag: "success" },
  { text: "Great achievements are born from great commitments, made daily.", tag: "success" },
  { text: "Outwork yesterday's version of yourself — that's real success.", tag: "success" },
  { text: "Success is not about being the best — it's about always getting better.", tag: "success" },
  { text: "Every goal you set and every step you take matters enormously.", tag: "success" },
  { text: "The greatest investment you will ever make is in yourself.", tag: "success" },

  // RESILIENCE
  { text: "You have survived every hard day so far — today is no different.", tag: "resilience" },
  { text: "The comeback is always stronger than the setback.", tag: "resilience" },
  { text: "Tough times are temporary. Your strength is permanent.", tag: "resilience" },
  { text: "Every storm runs out of rain. Your sunshine is on its way.", tag: "resilience" },
  { text: "You are stronger than you know and braver than you feel.", tag: "resilience" },
  { text: "Bend but don't break — you were built for exactly this.", tag: "resilience" },
  { text: "Rising again is the most powerful thing a person can do.", tag: "resilience" },
  { text: "The human spirit is unbreakable when it chooses to be.", tag: "resilience" },
  { text: "Your ability to bounce back is one of your greatest gifts.", tag: "resilience" },
  { text: "Every difficulty you overcome adds to your strength permanently.", tag: "resilience" },
  { text: "Keep going. Beautiful things are waiting for you just ahead.", tag: "resilience" },
  { text: "You are made of the same stuff as those who made it through.", tag: "resilience" },
  { text: "Hard moments build the muscles that carry you to great moments.", tag: "resilience" },
  { text: "Your endurance is writing the greatest story of your life.", tag: "resilience" },
  { text: "Every time you get back up, you become more unstoppable.", tag: "resilience" },
  { text: "Challenges are not walls — they are doors waiting to be opened.", tag: "resilience" },
  { text: "You didn't come this far only to give up. Keep going.", tag: "resilience" },
  { text: "The grit in your bones is more valuable than any talent.", tag: "resilience" },
  { text: "Storms make trees put down deeper roots. So do you.", tag: "resilience" },
  { text: "There is a strength inside you that has not yet been fully used.", tag: "resilience" },
  { text: "Your resilience is an inspiration to everyone watching you.", tag: "resilience" },
  { text: "Dust yourself off and remember how far you have already come.", tag: "resilience" },
  { text: "You have everything it takes to get through this and thrive.", tag: "resilience" },
  { text: "Keep planting even when the season feels cold — spring always comes.", tag: "resilience" },
  { text: "The strongest people are not those who never fall, but those who rise.", tag: "resilience" },
  { text: "Your scars are proof of your courage, not your defeat.", tag: "resilience" },
  { text: "Every sunrise is proof that you made it through the night.", tag: "resilience" },
  { text: "What you're going through is making you who you are meant to be.", tag: "resilience" },
  { text: "Hang on. The most beautiful chapters often follow the hardest ones.", tag: "resilience" },
  { text: "You are not stuck — you are standing at the start of something new.", tag: "resilience" },

  // MINDSET
  { text: "Your mindset is the most powerful tool you will ever own.", tag: "mindset" },
  { text: "Think well and your world will follow.", tag: "mindset" },
  { text: "A positive mind finds opportunity in every situation.", tag: "mindset" },
  { text: "What you believe about yourself shapes everything you create.", tag: "mindset" },
  { text: "Choose thoughts that lift you — they cost the same as the ones that don't.", tag: "mindset" },
  { text: "Your attitude is a magnet. Make sure it's attracting the right things.", tag: "mindset" },
  { text: "See the good and more good will reveal itself to you.", tag: "mindset" },
  { text: "Gratitude turns what you have into more than enough.", tag: "mindset" },
  { text: "A made-up mind is the beginning of every great achievement.", tag: "mindset" },
  { text: "What you focus on expands. Choose to focus on what's possible.", tag: "mindset" },
  { text: "Train your mind to find silver linings and it will get very good at it.", tag: "mindset" },
  { text: "You become what you consistently think about. Think beautifully.", tag: "mindset" },
  { text: "Positive thinking isn't naive — it's a choice that shapes your reality.", tag: "mindset" },
  { text: "Confidence grows every time you do something that scares you a little.", tag: "mindset" },
  { text: "Your inner dialogue is writing your future. Make it a good story.", tag: "mindset" },
  { text: "Clarity about where you're going makes every step forward easier.", tag: "mindset" },
  { text: "You can rewire your brain for joy and possibility starting right now.", tag: "mindset" },
  { text: "The quality of your thinking shapes the quality of your entire life.", tag: "mindset" },
  { text: "Choose optimism — it's the most practical thing you can do today.", tag: "mindset" },
  { text: "Your mindset is your starting line — make it a powerful one.", tag: "mindset" },
  { text: "Every great life starts with a belief that it's actually possible.", tag: "mindset" },
  { text: "Replace 'I can't' with 'How can I?' and watch everything shift.", tag: "mindset" },
  { text: "A grateful heart is a magnet for miracles.", tag: "mindset" },
  { text: "You are the author of your thoughts. Write only what you want to live.", tag: "mindset" },
  { text: "Believe in yourself fiercely and the world will start to believe too.", tag: "mindset" },
  { text: "Keep your eyes on the prize and your heart full of gratitude.", tag: "mindset" },
  { text: "Think like the person you want to become and become them faster.", tag: "mindset" },
  { text: "Your imagination is the blueprint of tomorrow's achievements.", tag: "mindset" },
  { text: "Expect good things and watch how many good things show up.", tag: "mindset" },
  { text: "Self-belief is the single most powerful driver of any achievement.", tag: "mindset" },

  // ACTION
  { text: "You don't have to be great to start, but you have to start to be great.", tag: "action" },
  { text: "Take the first step and the path will appear before you.", tag: "action" },
  { text: "Action is the antidote to anxiety. Move forward today.", tag: "action" },
  { text: "Do something today that your future self will celebrate.", tag: "action" },
  { text: "Begin. The rest gets easier once you take the first step.", tag: "action" },
  { text: "Done is better than perfect — ship it, learn, and improve.", tag: "action" },
  { text: "The secret to moving forward is just getting started.", tag: "action" },
  { text: "Your future is built in the actions you take today. Start building.", tag: "action" },
  { text: "Every mountain is climbed one step at a time. Take yours.", tag: "action" },
  { text: "Momentum starts with one deliberate, courageous action.", tag: "action" },
  { text: "The best plan is the one you start acting on today.", tag: "action" },
  { text: "Ideas without action are just wishes. Act on yours today.", tag: "action" },
  { text: "Move toward what excites you and trust where it leads.", tag: "action" },
  { text: "You don't need to feel ready. You just need to begin.", tag: "action" },
  { text: "Every step forward is a step closer. Keep stepping.", tag: "action" },
  { text: "Launch before you're fully ready — that's when the magic starts.", tag: "action" },
  { text: "Take imperfect action over perfect inaction every single time.", tag: "action" },
  { text: "The gap between dreams and reality is called action. Bridge it.", tag: "action" },
  { text: "You will never regret starting. You will always wonder about not starting.", tag: "action" },
  { text: "Do the thing and feel the confidence that follows doing it.", tag: "action" },
  { text: "Start before you think you're ready. Growth happens mid-stride.", tag: "action" },
  { text: "One brave action today can change the course of your entire year.", tag: "action" },
  { text: "Act boldly and the universe will step in to support you.", tag: "action" },
  { text: "A little progress each day adds up to remarkable results.", tag: "action" },
  { text: "Your best move is always the next one. Make it today.", tag: "action" },
  { text: "Creation beats consumption. Build something today.", tag: "action" },
  { text: "Start small, stay consistent, and watch your efforts multiply.", tag: "action" },
  { text: "Every action you take is a vote for the person you want to become.", tag: "action" },
  { text: "Forward is always the right direction. Keep moving.", tag: "action" },
  { text: "Do the next right thing and then the next. That's the whole strategy.", tag: "action" },

  // FOCUS
  { text: "Guard your attention — it is your most precious asset.", tag: "focus" },
  { text: "Deep work creates deep results. Protect your focus time fiercely.", tag: "focus" },
  { text: "One thing done with full attention beats ten things done halfway.", tag: "focus" },
  { text: "Turn off the noise and turn up your focus — magic happens in the quiet.", tag: "focus" },
  { text: "The most successful people have mastered the art of saying no to distraction.", tag: "focus" },
  { text: "When you focus fully, ordinary effort becomes extraordinary output.", tag: "focus" },
  { text: "Give your best hours to your most important work.", tag: "focus" },
  { text: "A focused mind is a powerful mind. Train yours daily.", tag: "focus" },
  { text: "Depth and mastery are available to anyone willing to focus consistently.", tag: "focus" },
  { text: "Work with full presence and watch your results transform.", tag: "focus" },
  { text: "Your ability to focus deeply is a superpower worth developing.", tag: "focus" },
  { text: "Single-tasking is the new skill that separates great from good.", tag: "focus" },
  { text: "Clarity of purpose turns ordinary effort into remarkable results.", tag: "focus" },
  { text: "Less but better is always the winning strategy.", tag: "focus" },
  { text: "Boredom is where your best ideas are waiting — sit with it.", tag: "focus" },
  { text: "When you do one thing brilliantly, brilliance becomes your standard.", tag: "focus" },
  { text: "Own your morning focus and your day will follow your lead.", tag: "focus" },
  { text: "Flow states are your most productive gift — protect the conditions for them.", tag: "focus" },
  { text: "Mastery is repetition performed with full attention and love.", tag: "focus" },
  { text: "Energy flows where attention goes. Direct yours wisely.", tag: "focus" },
  { text: "The things you give your undivided attention to flourish.", tag: "focus" },
  { text: "Quiet the mind. Amplify the work. Extraordinary things follow.", tag: "focus" },
  { text: "Prioritize ruthlessly and everything you care about will thank you.", tag: "focus" },
  { text: "Distraction is temporary. Regret for wasted potential lasts far longer.", tag: "focus" },
  { text: "Do fewer things with greater depth and watch your life elevate.", tag: "focus" },
  { text: "Protect your focus the way you protect your most precious relationships.", tag: "focus" },
  { text: "Your focused attention on one goal is more powerful than scattered effort on many.", tag: "focus" },
  { text: "The quality of your concentration determines the quality of your creations.", tag: "focus" },
  { text: "Work at the edge of your ability today. That's where mastery lives.", tag: "focus" },
  { text: "Schedule deep focus daily and watch your whole life deepen with it.", tag: "focus" },

  // PURPOSE
  { text: "You were created with a purpose — trust it and pursue it boldly.", tag: "purpose" },
  { text: "Find what lights you up and let that light lead you.", tag: "purpose" },
  { text: "A life with purpose is a life that matters deeply.", tag: "purpose" },
  { text: "Your unique gifts were meant to be shared with the world.", tag: "purpose" },
  { text: "When you live with intention, every day becomes meaningful.", tag: "purpose" },
  { text: "Purpose is the compass that always points you toward meaning.", tag: "purpose" },
  { text: "Pursue what sets your soul on fire and the energy will never run out.", tag: "purpose" },
  { text: "You are here for a reason. Live like you mean it.", tag: "purpose" },
  { text: "Aligning your work with your values is the foundation of a fulfilling life.", tag: "purpose" },
  { text: "The most powerful version of you is the one living on purpose.", tag: "purpose" },
  { text: "Doing meaningful work is one of the greatest joys available to us.", tag: "purpose" },
  { text: "When your why is strong enough, the how becomes possible.", tag: "purpose" },
  { text: "You have a unique contribution only you can make. Please make it.", tag: "purpose" },
  { text: "Living with purpose turns ordinary days into extraordinary ones.", tag: "purpose" },
  { text: "The world becomes better when you bring your full purpose to it.", tag: "purpose" },
  { text: "Purpose fills you with energy that no coffee ever could.", tag: "purpose" },
  { text: "Chase meaning over comfort and comfort will eventually catch up.", tag: "purpose" },
  { text: "Your purpose was not placed in you without the ability to fulfill it.", tag: "purpose" },
  { text: "Live intentionally. Every day is a chance to mean something.", tag: "purpose" },
  { text: "Know why you do what you do and the what becomes unstoppable.", tag: "purpose" },
  { text: "A purposeful life is not accidental — it is built choice by choice.", tag: "purpose" },
  { text: "Find your mission and every Monday will feel like a gift.", tag: "purpose" },
  { text: "The world needs your specific light. Don't keep it under a bushel.", tag: "purpose" },
  { text: "Purpose transforms work into calling and struggle into meaning.", tag: "purpose" },
  { text: "You are most alive when you are doing what you were made to do.", tag: "purpose" },
  { text: "Dedicate your days to something bigger than yourself and watch yourself grow.", tag: "purpose" },
  { text: "Your life's purpose is worth every ounce of effort you can give it.", tag: "purpose" },
  { text: "When purpose guides you, no detour can truly take you off course.", tag: "purpose" },
  { text: "Great purpose produces great persistence. Find yours and hold it tight.", tag: "purpose" },
  { text: "The clearer your purpose, the easier every hard choice becomes.", tag: "purpose" },

  // GRATITUDE
  { text: "Start every day with gratitude and it will end better than it began.", tag: "gratitude" },
  { text: "Gratitude turns ordinary moments into extraordinary memories.", tag: "gratitude" },
  { text: "There is always something to be thankful for. Always.", tag: "gratitude" },
  { text: "A thankful heart opens doors that a demanding one never could.", tag: "gratitude" },
  { text: "Count your blessings — the count will surprise you every time.", tag: "gratitude" },
  { text: "Joy multiplies when you share it and gratitude is how you find it.", tag: "gratitude" },
  { text: "The things you appreciate appreciate in value.", tag: "gratitude" },
  { text: "Gratitude is the healthiest emotion the human heart can feel.", tag: "gratitude" },
  { text: "Notice the beauty in today — it was put there for you.", tag: "gratitude" },
  { text: "Thankfulness is the shortest path to a peaceful and happy life.", tag: "gratitude" },
  { text: "Every breath is a gift. Every moment is precious. Be grateful.", tag: "gratitude" },
  { text: "When you are grateful, fear disappears and abundance appears.", tag: "gratitude" },
  { text: "Celebrate how far you have come before focusing on how far you must go.", tag: "gratitude" },
  { text: "Happiness is not about having more — it's about appreciating what is.", tag: "gratitude" },
  { text: "Say thank you more often and watch your world transform around you.", tag: "gratitude" },
  { text: "The grateful mind continuously attracts more things to be grateful for.", tag: "gratitude" },
  { text: "Appreciate the small moments — they make up the majority of your life.", tag: "gratitude" },
  { text: "Gratitude is the bridge between where you are and where you want to be.", tag: "gratitude" },
  { text: "Look for the good in today. It is absolutely there.", tag: "gratitude" },
  { text: "Thankfulness reframes everything — and that changes everything.", tag: "gratitude" },
  { text: "Some of your best days are already behind you — and many more lie ahead.", tag: "gratitude" },
  { text: "Every sunset is a reminder that endings can be beautiful.", tag: "gratitude" },
  { text: "You are surrounded by more good than you currently realize.", tag: "gratitude" },
  { text: "Slow down enough to notice the magic that's already in your life.", tag: "gratitude" },
  { text: "Gratitude for what is creates the space for what will be.", tag: "gratitude" },
  { text: "Appreciate the people in your life today — they are your greatest wealth.", tag: "gratitude" },
  { text: "When life is heavy, gratitude becomes your lightest and strongest tool.", tag: "gratitude" },
  { text: "Even on a hard day, you have more gifts than you realize.", tag: "gratitude" },
  { text: "Thankful people are the most magnetic people in any room.", tag: "gratitude" },
  { text: "Wake up each morning with a grateful heart and watch the day unfold beautifully.", tag: "gratitude" },

  // COURAGE
  { text: "Courage is not the absence of fear — it's taking the next step anyway.", tag: "courage" },
  { text: "The life you want is on the other side of the thing you're afraid to do.", tag: "courage" },
  { text: "Be bold. The world steps aside for those who know where they're going.", tag: "courage" },
  { text: "You were born with everything you need to be brave. Use it.", tag: "courage" },
  { text: "Take the leap. The net will appear when you need it most.", tag: "courage" },
  { text: "Bravery is just deciding that your dreams are worth the discomfort.", tag: "courage" },
  { text: "A courageous heart changes the world one brave act at a time.", tag: "courage" },
  { text: "The biggest risk you can take is to never take any risk at all.", tag: "courage" },
  { text: "Do the thing that scares you a little — that's always where the growth is.", tag: "courage" },
  { text: "Your life expands in proportion to your courage. Be courageous.", tag: "courage" },
  { text: "Say yes to the scary, beautiful, important things. Say yes more.", tag: "courage" },
  { text: "Fortune truly does favour the bold — step forward with confidence.", tag: "courage" },
  { text: "You have been brave before. You can be brave again right now.", tag: "courage" },
  { text: "Do something today that requires every bit of your courage.", tag: "courage" },
  { text: "Courage is a muscle. Exercise it every day and watch it grow.", tag: "courage" },
  { text: "The moment you decide to be brave, your whole life changes.", tag: "courage" },
  { text: "Speak up, step up, show up — the world needs your courage now.", tag: "courage" },
  { text: "Confidence comes from acting, not waiting to feel ready.", tag: "courage" },
  { text: "Be bold enough to use your voice and brave enough to listen to others.", tag: "courage" },
  { text: "Every great adventure starts with a single courageous decision.", tag: "courage" },
  { text: "You have climbed mountains before. This hill is no different.", tag: "courage" },
  { text: "Dare greatly and live a life that is truly yours.", tag: "courage" },
  { text: "Courage is contagious — your bravery inspires everyone around you.", tag: "courage" },
  { text: "If your dreams don't scare you a little, dream a little bigger.", tag: "courage" },
  { text: "The brave path is rarely easy but it is almost always worth it.", tag: "courage" },
  { text: "Choose the challenge over the comfortable and watch yourself soar.", tag: "courage" },
  { text: "Your most important conversations require your greatest courage. Have them.", tag: "courage" },
  { text: "You are far more courageous than you give yourself credit for.", tag: "courage" },
  { text: "Let your heart be bold and your actions bolder still.", tag: "courage" },
  { text: "Leap and the net will appear. It always has. It always will.", tag: "courage" },

  // LEGACY
  { text: "Build something today that will matter long after today is gone.", tag: "legacy" },
  { text: "Leave every room better than you found it — that's your legacy.", tag: "legacy" },
  { text: "The kindness you show today ripples further than you will ever know.", tag: "legacy" },
  { text: "Think in decades. Act in days. That's how lasting legacies are made.", tag: "legacy" },
  { text: "Plant trees whose shade you may never sit under. Plant them anyway.", tag: "legacy" },
  { text: "What you create, who you lift, what you share — that is your legacy.", tag: "legacy" },
  { text: "Live in a way that makes those who come after you proud.", tag: "legacy" },
  { text: "Long-term thinking is the rarest and most powerful gift you can have.", tag: "legacy" },
  { text: "Your values, lived daily, become the legacy that outlasts you.", tag: "legacy" },
  { text: "The love you give generously is always the love that comes back.", tag: "legacy" },
  { text: "Build systems and habits today that will outlast any single goal.", tag: "legacy" },
  { text: "Be the kind of person stories are told about — in the best possible way.", tag: "legacy" },
  { text: "Live a life worth remembering by making it a life worth living today.", tag: "legacy" },
  { text: "Ten years of purposeful work will create something extraordinary.", tag: "legacy" },
  { text: "The story you live is more powerful than any story you tell.", tag: "legacy" },
  { text: "Choose a direction, commit fully, and let time compound your efforts.", tag: "legacy" },
  { text: "Ordinary people doing extraordinary things daily build lasting legacies.", tag: "legacy" },
  { text: "Be generous. Be consistent. Be kind. That's a legacy worth having.", tag: "legacy" },
  { text: "Contribute something to the world that is purely and beautifully yours.", tag: "legacy" },
  { text: "The best chapters of your story are still being written. Write boldly.", tag: "legacy" },
  { text: "Lead by example — it's the loudest and most lasting statement you can make.", tag: "legacy" },
  { text: "Mentor someone. Build something. Give generously. That's a life well lived.", tag: "legacy" },
  { text: "The difference you make to one person's life is a legacy worth everything.", tag: "legacy" },
  { text: "Live and work in a way that creates ripples long after you are done.", tag: "legacy" },
  { text: "Clarity of purpose, consistently pursued, is the architecture of legacy.", tag: "legacy" },
  { text: "Do the work that matters. Let time and impact prove the rest.", tag: "legacy" },
  { text: "Give the world the best version of yourself and it will give back generously.", tag: "legacy" },
  { text: "Your story is still being written. Make today's chapter great.", tag: "legacy" },
  { text: "Short-term sacrifice for long-term meaning is always the right trade.", tag: "legacy" },
  { text: "Build the life you'll look back on with pride and zero regret.", tag: "legacy" },

  // PROFESSIONAL
  { text: "Do the work no one sees and it will build everything everyone notices.", tag: "professional" },
  { text: "Be so good at what you do that excellence becomes expected of you.", tag: "professional" },
  { text: "Professionals show up fully every day regardless of how they feel.", tag: "professional" },
  { text: "Your reputation is your most valuable long-term professional asset.", tag: "professional" },
  { text: "Underpromise, overdeliver, repeat — until you are irreplaceable.", tag: "professional" },
  { text: "Mastery is available to anyone willing to practice with full intention.", tag: "professional" },
  { text: "Continuous learning is the most powerful career strategy available.", tag: "professional" },
  { text: "Your attitude toward feedback is the ceiling of your career growth.", tag: "professional" },
  { text: "Soft skills will outlast every technical certification you ever earn.", tag: "professional" },
  { text: "The person who reads the most in the room tends to win the room.", tag: "professional" },
  { text: "Own your craft completely and opportunities will seek you out.", tag: "professional" },
  { text: "Collaboration and generosity are the foundation of lasting career success.", tag: "professional" },
  { text: "Your calendar is an honest reflection of your real priorities.", tag: "professional" },
  { text: "Chase craft, not titles. The titles will come chasing you.", tag: "professional" },
  { text: "Be someone your colleagues can trust absolutely. That is rare and powerful.", tag: "professional" },
  { text: "Show up prepared, deliver with excellence, follow up consistently.", tag: "professional" },
  { text: "The best skill you can build is the ability to get things done.", tag: "professional" },
  { text: "Every problem you solve for someone else is a career opportunity for you.", tag: "professional" },
  { text: "Precision and care in your work communicate respect — for the work and others.", tag: "professional" },
  { text: "Build your skills in public. Let your growth be your greatest marketing.", tag: "professional" },
  { text: "The most promotable people are those who make everyone around them better.", tag: "professional" },
  { text: "Communicate clearly, act with integrity, deliver results. That's the formula.", tag: "professional" },
  { text: "Your best professional investment is becoming a person of your word.", tag: "professional" },
  { text: "Excellence in small things is the qualification for big things.", tag: "professional" },
  { text: "Be the person in every room who raises the energy and the standard.", tag: "professional" },
  { text: "Invest in relationships as seriously as you invest in skills. Both compound.", tag: "professional" },
  { text: "Curiosity about your field is the engine that keeps careers growing.", tag: "professional" },
  { text: "The best professionals never stop being enthusiastic students.", tag: "professional" },
  { text: "Generosity with your knowledge builds the networks that build careers.", tag: "professional" },
  { text: "Bring energy, bring ideas, bring solutions — and every door will open.", tag: "professional" },

  // DISCIPLINE
  { text: "Discipline is freedom in disguise — the more you have, the freer you become.", tag: "discipline" },
  { text: "Win the morning and you will likely win the day.", tag: "discipline" },
  { text: "Your routine is the foundation upon which extraordinary lives are built.", tag: "discipline" },
  { text: "Small consistent disciplines produce remarkable results over time.", tag: "discipline" },
  { text: "The secret of your future is hidden in your daily routine.", tag: "discipline" },
  { text: "Do the work even when you don't feel like it — especially then.", tag: "discipline" },
  { text: "Self-discipline is the quiet superpower that doesn't cost a thing.", tag: "discipline" },
  { text: "What you do every day matters far more than what you do occasionally.", tag: "discipline" },
  { text: "Champions are made in the hours no one is watching. Show up anyway.", tag: "discipline" },
  { text: "Controlled and consistent effort is always more powerful than sporadic intensity.", tag: "discipline" },
  { text: "Your habits are voting daily for the person you are becoming.", tag: "discipline" },
  { text: "Make your bed and keep your word — small disciplines build great character.", tag: "discipline" },
  { text: "Consistency is the rarest quality and the most rewarding one.", tag: "discipline" },
  { text: "Love the process and the results will arrive without being chased.", tag: "discipline" },
  { text: "Build the habit and the discipline will take care of itself.", tag: "discipline" },
  { text: "Excellence is not an event — it's a consistent daily choice.", tag: "discipline" },
  { text: "Fall in love with the repetition — it's where mastery lives.", tag: "discipline" },
  { text: "The disciplined person creates freedom. The undisciplined one loses it.", tag: "discipline" },
  { text: "Your future self is being created by your present daily actions.", tag: "discipline" },
  { text: "Stay the course even when the results aren't yet visible. They are coming.", tag: "discipline" },
  { text: "Structure is the scaffold upon which great lives are built.", tag: "discipline" },
  { text: "Choose the hard right thing over the easy wrong thing — every time.", tag: "discipline" },
  { text: "Rituals create results. Build yours with intention and care.", tag: "discipline" },
  { text: "What you do when no one is watching determines who you will become.", tag: "discipline" },
  { text: "Delayed gratification is the most reliable path to lasting fulfillment.", tag: "discipline" },
  { text: "You control your schedule, your habits, your effort. Use that power.", tag: "discipline" },
  { text: "Every day that you stick to your discipline, you invest in your future.", tag: "discipline" },
  { text: "Manage your energy wisely — it is your most renewable but finite resource.", tag: "discipline" },
  { text: "Discipline in small things creates confidence in large things.", tag: "discipline" },
  { text: "Show up for yourself daily and you will never need anyone to rescue you.", tag: "discipline" },

  // CREATIVITY
  { text: "Create something today that the world has never seen before.", tag: "creativity" },
  { text: "Your imagination is your invitation to a more beautiful future.", tag: "creativity" },
  { text: "There is no substitute for original thinking applied with consistent effort.", tag: "creativity" },
  { text: "Creativity is intelligence having the most fun it's ever had.", tag: "creativity" },
  { text: "Every great innovation started as someone's ridiculous idea. Dream on.", tag: "creativity" },
  { text: "Your creativity is a gift to the world — share it generously.", tag: "creativity" },
  { text: "Constraints don't limit creativity. They often unleash it completely.", tag: "creativity" },
  { text: "Solve one problem beautifully and you've added real value to the world.", tag: "creativity" },
  { text: "Art, code, writing, music — creation in any form elevates the human spirit.", tag: "creativity" },
  { text: "Build, make, create — contribution is the highest form of living.", tag: "creativity" },
  { text: "Ideas are the seeds. Your creative action is what makes them bloom.", tag: "creativity" },
  { text: "The most innovative people are the most curious. Stay endlessly curious.", tag: "creativity" },
  { text: "There is always a more elegant, creative solution waiting to be found.", tag: "creativity" },
  { text: "Bring something new into the world today. Only you can bring your version.", tag: "creativity" },
  { text: "Embrace the messy middle of every creative endeavor — that's where it all happens.", tag: "creativity" },
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
  inspiration: {
    bg: "rgba(251,191,36,0.12)",
    text: "#d97706",
    darkBg: "rgba(254,243,199,0.15)",
    darkText: "#fde68a",
    glow: "rgba(251,191,36,0.4)",
  },
  growth: {
    bg: "rgba(5,150,105,0.12)",
    text: "#059669",
    darkBg: "rgba(167,243,208,0.15)",
    darkText: "#6ee7b7",
    glow: "rgba(52,211,153,0.4)",
  },
  success: {
    bg: "rgba(234,88,12,0.12)",
    text: "#ea580c",
    darkBg: "rgba(254,215,170,0.15)",
    darkText: "#fdba74",
    glow: "rgba(251,146,60,0.4)",
  },
  resilience: {
    bg: "rgba(219,39,119,0.12)",
    text: "#db2777",
    darkBg: "rgba(251,207,232,0.15)",
    darkText: "#f9a8d4",
    glow: "rgba(236,72,153,0.4)",
  },
  mindset: {
    bg: "rgba(20,184,166,0.12)",
    text: "#14b8a6",
    darkBg: "rgba(153,246,228,0.15)",
    darkText: "#5eead4",
    glow: "rgba(45,212,191,0.4)",
  },
  action: {
    bg: "rgba(99,102,241,0.12)",
    text: "#6366f1",
    darkBg: "rgba(199,210,254,0.15)",
    darkText: "#a5b4fc",
    glow: "rgba(129,140,248,0.4)",
  },
  focus: {
    bg: "rgba(14,165,233,0.12)",
    text: "#0ea5e9",
    darkBg: "rgba(186,230,253,0.15)",
    darkText: "#7dd3fc",
    glow: "rgba(56,189,248,0.4)",
  },
  purpose: {
    bg: "rgba(168,85,247,0.12)",
    text: "#9333ea",
    darkBg: "rgba(233,213,255,0.15)",
    darkText: "#d8b4fe",
    glow: "rgba(192,132,252,0.4)",
  },
  gratitude: {
    bg: "rgba(244,63,94,0.12)",
    text: "#e11d48",
    darkBg: "rgba(254,205,211,0.15)",
    darkText: "#fda4af",
    glow: "rgba(251,113,133,0.4)",
  },
  courage: {
    bg: "rgba(239,68,68,0.12)",
    text: "#dc2626",
    darkBg: "rgba(254,202,202,0.15)",
    darkText: "#fca5a5",
    glow: "rgba(239,68,68,0.4)",
  },
  legacy: {
    bg: "rgba(217,119,6,0.12)",
    text: "#d97706",
    darkBg: "rgba(254,215,170,0.15)",
    darkText: "#fcd34d",
    glow: "rgba(251,191,36,0.4)",
  },
  professional: {
    bg: "rgba(37,99,235,0.12)",
    text: "#2563eb",
    darkBg: "rgba(191,219,254,0.15)",
    darkText: "#93c5fd",
    glow: "rgba(59,130,246,0.4)",
  },
  discipline: {
    bg: "rgba(15,118,110,0.12)",
    text: "#0f766e",
    darkBg: "rgba(153,246,228,0.15)",
    darkText: "#99f6e4",
    glow: "rgba(20,184,166,0.4)",
  },
  creativity: {
    bg: "rgba(124,58,237,0.12)",
    text: "#7c3aed",
    darkBg: "rgba(221,214,254,0.15)",
    darkText: "#c4b5fd",
    glow: "rgba(167,139,250,0.4)",
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
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const quote = useMemo(() => getDailyQuote(), []);
  const quoteRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tagColor = TAG_COLORS[quote.tag] ?? TAG_COLORS.action;

  useEffect(() => {
    setMounted(true);

    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setTextIn(true), 400);
    const t3 = setTimeout(() => setGlowing(true), 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Check if quote text overflows
  useEffect(() => {
    if (!textIn || !quoteRef.current || !containerRef.current) return;

    const checkOverflow = () => {
      const quoteEl = quoteRef.current;
      const containerEl = containerRef.current;
      if (!quoteEl || !containerEl) return;

      // Check if text width exceeds container width
      const isOverflow = quoteEl.scrollWidth > containerEl.clientWidth;
      setIsOverflowing(isOverflow);
    };

    // Initial check
    setTimeout(checkOverflow, 100);

    // Recheck on window resize
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [textIn]);

  useEffect(() => {
    if (!mounted) return;

    const shimmerInterval = setInterval(() => {
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1200);
    }, 7000);

    const glowInterval = setInterval(() => {
      setGlowing(false);
      setTimeout(() => setGlowing(true), 150);
    }, 10000);

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
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap');

        /* ─────────────────────────────
           KEYFRAMES
        ───────────────────────────── */
        @keyframes mqBannerSlideIn {
          0% {
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
          }
          60% {
            transform: translateY(2px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes mqTextSlideIn {
          0% {
            opacity: 0;
            transform: translateX(-12px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
        }

        @keyframes mqDotBreathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.4);
            opacity: 1;
          }
        }

        @keyframes mqShimmerSweep {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        @keyframes mqGlowPulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(0,0,0,0),
              0 4px 20px -2px rgba(0,0,0,0.08),
              inset 0 1px 0 0 rgba(255,255,255,0.1);
          }
          50% {
            box-shadow:
              0 0 30px 2px var(--glow-color),
              0 8px 30px -2px rgba(0,0,0,0.12),
              inset 0 1px 0 0 rgba(255,255,255,0.15);
          }
        }

        @keyframes mqGlowPulseDark {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(0,0,0,0),
              0 8px 32px -4px rgba(0,0,0,0.4),
              inset 0 1px 0 0 rgba(255,255,255,0.08);
          }
          50% {
            box-shadow:
              0 0 40px 4px var(--glow-color),
              0 12px 40px -4px rgba(0,0,0,0.5),
              inset 0 1px 0 0 rgba(255,255,255,0.12);
          }
        }

        @keyframes mqNameFadeIn {
          0% {
            opacity: 0;
            letter-spacing: 0.2em;
            transform: translateY(3px);
          }
          100% {
            opacity: 1;
            letter-spacing: 0.05em;
            transform: translateY(0);
          }
        }

        @keyframes mqQuoteFadeIn {
          0% {
            opacity: 0;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes mqMarqueeScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes mqTagSpring {
          0% {
            transform: scale(0.75) rotate(-2deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.08) rotate(1deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @keyframes mqBorderShine {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        /* ─────────────────────────────
           WRAPPER
        ───────────────────────────── */
        .mq-banner {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 16px 10px 12px;
          border-radius: 16px;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          flex-shrink: 1;
          opacity: 0;
          position: relative;
          isolation: isolate;
          transition:
            transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
            border-color 0.5s ease,
            background 0.5s ease;
          will-change: transform, opacity;
        }

        .mq-banner:hover {
          transform: translateY(-2px) scale(1.005);
        }

        .mq-banner.mq-in {
          animation: mqBannerSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .mq-banner.mq-glow {
          animation:
            mqBannerSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            mqGlowPulse 5s ease-in-out 1.2s infinite;
        }

        .mq-banner.mq-glow.mq-dark {
          animation:
            mqBannerSlideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            mqGlowPulseDark 5s ease-in-out 1.2s infinite;
        }

        /* Animated gradient border */
        .mq-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1.5px;
          border-radius: inherit;
          background: linear-gradient(
            135deg,
            transparent 0%,
            var(--accent-color-1) 25%,
            var(--accent-color-2) 50%,
            var(--accent-color-3) 75%,
            transparent 100%
          );
          background-size: 300% 300%;
          animation: mqBorderShine 6s linear infinite;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 3;
          opacity: 0.7;
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
          width: 9px;
          height: 9px;
          border-radius: 999px;
          animation: mqDotBreathe 3s ease-in-out infinite;
          box-shadow: 0 0 12px currentColor;
        }

        /* ─────────────────────────────
           DIVIDER
        ───────────────────────────── */
        .mq-divider {
          flex-shrink: 0;
          width: 1.5px;
          height: 24px;
          align-self: center;
          z-index: 4;
          border-radius: 999px;
          opacity: 0.25;
        }

        /* ─────────────────────────────
           TEXT BLOCK - WITH MARQUEE
        ───────────────────────────── */
        .mq-texts {
          display: flex;
          align-items: baseline;
          gap: 7px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
          opacity: 0;
          z-index: 4;
          position: relative;
        }

        .mq-texts.mq-text-in {
          animation: mqTextSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
        }

        .mq-name {
          font-family: 'DM Serif Display', Georgia, serif;
          font-style: italic;
          font-size: 13px;
          font-weight: 400;
          white-space: nowrap;
          flex-shrink: 0;
          opacity: 0;
          letter-spacing: 0.05em;
          text-shadow: 0 0 20px currentColor;
        }

        .mq-name.mq-name-in {
          animation: mqNameFadeIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s forwards;
        }

        .mq-sep {
          font-size: 11px;
          flex-shrink: 0;
          opacity: 0.4;
          margin: 0 1px;
          font-weight: 300;
        }

        .mq-quote-container {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          position: relative;
          opacity: 0;
        }

        .mq-quote-container.mq-quote-in {
          animation: mqQuoteFadeIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards;
        }

        .mq-quote-wrapper {
          display: inline-flex;
          gap: 0;
          white-space: nowrap;
        }

        .mq-quote-wrapper.mq-marquee {
          animation: mqMarqueeScroll 22s linear infinite;
        }

        .mq-quote-wrapper.mq-marquee.mq-paused {
          animation-play-state: paused;
        }

        .mq-quote {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          white-space: nowrap;
          line-height: 1.5;
          display: inline-block;
          letter-spacing: 0.01em;
        }

        .mq-quote.mq-duplicate {
          padding-left: 2.5em;
        }

        /* Gradient fade edges for marquee */
        .mq-quote-container::before,
        .mq-quote-container::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 50px;
          z-index: 5;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .mq-quote-container.mq-has-overflow::before,
        .mq-quote-container.mq-has-overflow::after {
          opacity: 1;
        }

        .mq-quote-container::before {
          left: 0;
          background: linear-gradient(to right, var(--gradient-fade-start), transparent);
        }

        .mq-quote-container::after {
          right: 0;
          background: linear-gradient(to left, var(--gradient-fade-start), transparent);
        }

        /* ─────────────────────────────
           TAG PILL
        ───────────────────────────── */
        .mq-tag {
          flex-shrink: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          padding: 5px 12px;
          border-radius: 999px;
          white-space: nowrap;
          opacity: 0;
          border: 1.5px solid transparent;
          transition:
            background 0.4s ease,
            color 0.4s ease,
            border-color 0.4s ease,
            transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.4s ease;
          z-index: 4;
          position: relative;
          overflow: hidden;
        }

        .mq-tag:hover {
          transform: translateY(-2px) scale(1.05);
        }

        .mq-tag.mq-tag-in {
          animation: mqTagSpring 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s forwards;
        }

        .mq-tag.mq-shimmer::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.4) 50%,
            transparent 100%
          );
          background-size: 200% auto;
          animation: mqShimmerSweep 1.2s ease-out;
        }
      `}</style>

      <div
        ref={containerRef}
        className={`mq-banner hidden lg:flex ${
          visible ? (glowing ? `mq-in mq-glow ${isDark ? 'mq-dark' : ''}` : "mq-in") : ""
        }`}
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(30,30,45,0.95), rgba(20,20,32,0.92))"
            : "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.92))",
          border: `2px solid ${
            isDark ? "rgba(255,255,255,0.06)" : "rgba(226,232,240,0.8)"
          }`,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          // @ts-ignore
          "--gradient-fade-start": isDark
            ? "rgba(20,20,32,1)"
            : "rgba(248,250,252,1)",
          "--accent-color-1": tagColor.glow.replace("0.4", "0.6"),
          "--accent-color-2": isDark ? "rgba(139,92,246,0.5)" : "rgba(99,102,241,0.5)",
          "--accent-color-3": isDark ? "rgba(59,130,246,0.5)" : "rgba(14,165,233,0.5)",
          "--glow-color": tagColor.glow,
        }}
        aria-label="Daily motivational quote"
        title={quote.text}
      >
        {/* Pulsing dot */}
        <div className="mq-dot-wrap">
          <span
            className="mq-dot"
            style={{
              background: isDark 
                ? `linear-gradient(135deg, ${tagColor.darkText}, ${pillText})`
                : `linear-gradient(135deg, ${tagColor.text}, ${pillText})`,
              color: tagColor.glow,
            }}
          />
        </div>

        {/* Divider */}
        <span
          className="mq-divider"
          style={{
            background: isDark
              ? `linear-gradient(180deg, transparent, ${tagColor.darkText}40, transparent)`
              : `linear-gradient(180deg, transparent, ${tagColor.text}30, transparent)`,
          }}
        />

        {/* Text */}
        <div className={`mq-texts ${textIn ? "mq-text-in" : ""}`}>
          <span
            className={`mq-name ${textIn ? "mq-name-in" : ""}`}
            style={{
              color: isDark ? tagColor.darkText : tagColor.text,
            }}
          >
            Hey, {firstName} ✦
          </span>

          <span
            className="mq-sep"
            style={{ color: isDark ? "#64748b" : "#94a3b8" }}
          >
            —
          </span>

          <div
            className={`mq-quote-container ${textIn ? "mq-quote-in" : ""} ${
              isOverflowing ? "mq-has-overflow" : ""
            }`}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div
              ref={quoteRef}
              className={`mq-quote-wrapper ${
                isOverflowing ? `mq-marquee ${isPaused ? "mq-paused" : ""}` : ""
              }`}
            >
              <span
                className="mq-quote"
                style={{
                  color: isDark ? "#e2e8f0" : "#1e293b",
                }}
              >
                {quote.text}
              </span>
              {isOverflowing && (
                <span
                  className="mq-quote mq-duplicate"
                  style={{
                    color: isDark ? "#e2e8f0" : "#1e293b",
                  }}
                >
                  {quote.text}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tag pill */}
        <span
          className={`mq-tag ${textIn ? "mq-tag-in" : ""} ${
            shimmer ? "mq-shimmer" : ""
          }`}
          style={{
            background: pillBg,
            color: pillText,
            borderColor: isDark ? `${pillText}35` : `${pillText}30`,
            boxShadow: `0 0 20px ${tagColor.glow.replace("0.4", "0.2")}, inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
        >
          #{quote.tag}
        </span>
      </div>
    </>
  );
}