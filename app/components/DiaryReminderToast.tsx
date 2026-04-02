// app/components/DiaryReminderToast.tsx
//
// A beautiful custom toast that nudges the user to write their diary
// after they save today's work log (entry + exit time both present).
//
// HOW IT WORKS:
//   1. After a successful save with BOTH entryTime AND exitTime filled:
//   2. Call GET /api/diary/check-date?date=YYYY-MM-DD
//   3. If exists === false  → call showDiaryReminderToast(router)
//   4. If exists === true   → do nothing (user already journaled today 🎉)
//
// USAGE (in your today's track page, inside handleSave):
//
//   import { showDiaryReminderToast } from "@/app/components/DiaryReminderToast";
//   import { useRouter } from "next/navigation";
//
//   const router = useRouter();
//
//   // after successful save:
//   const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
//   const diaryCheck = await fetch(`/api/diary/check-date?date=${today}`);
//   const { exists } = await diaryCheck.json();
//   if (!exists) showDiaryReminderToast(router);

"use client";

import toast                         from "react-hot-toast";
import { useRouter }                  from "next/navigation";
import { BookOpen, X, ArrowRight, Sparkles } from "lucide-react";

// ─── Funny message bank ──────────────────────────────────────────────────────
// 50% chance English, 50% chance Hindi — picked randomly each call.

const ENGLISH_MSGS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🧠",
    title: "Brain Cache Almost Full",
    body: "Today's chaos is still floating in temporary memory. Write it down before your brain force quits.",
  },
  {
    emoji: "📦",
    title: "Daily Thoughts Not Packaged",
    body: "Your work log shipped successfully, but your inner drama is still sitting in dev environment.",
  },
  {
    emoji: "🤖",
    title: "Human Logs Missing",
    body: "System metrics recorded. Emotional telemetry? Absolutely not. Add your diary entry, carbon-based user.",
  },
  {
    emoji: "🫠",
    title: "Mental Server Overheating",
    body: "You survived the day somehow. Now dump the madness into your diary before your thoughts melt.",
  },
  {
    emoji: "🧾",
    title: "Receipt Found, Story Missing",
    body: "You logged your hours like a responsible machine. Now explain the plot twist of your day, legend.",
  },
  {
    emoji: "👀",
    title: "Suspicious Silence Detected",
    body: "No diary entry? That's exactly what someone with a chaotic day would say. Go write it.",
  },
  {
    emoji: "🎭",
    title: "Main Character Update Needed",
    body: "Your side quests are logged. But where's today's episode summary for the main character?",
  },
  {
    emoji: "🛸",
    title: "Alien Activity Suspected",
    body: "A lot clearly happened today. If you don't write it down, future-you will assume aliens were involved.",
  },
  {
    emoji: "🧨",
    title: "Emotional Bomb Unstored",
    body: "That weird thing that happened today? Yeah… it belongs in your diary before it explodes at 2 AM.",
  },
  {
    emoji: "📡",
    title: "Thought Signal Weak",
    body: "Your memories are already fading like bad Wi-Fi. Lock them into your diary while the signal still exists.",
  },
  {
    emoji: "🎪",
    title: "Circus Closed, Notes Pending",
    body: "Today's clown show is over. Please document the performance for future scientific analysis.",
  },
  {
    emoji: "🪦",
    title: "Unwritten Thoughts Have Died",
    body: "A moment of silence for all the brilliant thoughts that vanished because you said 'I'll remember later.'",
  },
  {
    emoji: "🕵️",
    title: "Case File Incomplete",
    body: "The investigation is ongoing. Suspect: your day. Evidence: missing diary entry. Solve it now.",
  },
  {
    emoji: "🌪️",
    title: "Chaos Successfully Generated",
    body: "You made it through the storm. Now document the emotional weather report before tomorrow pretends nothing happened.",
  },
  {
    emoji: "🧃",
    title: "Your Day Needs Juicing",
    body: "Squeeze today's thoughts into your diary before they go stale and taste like expired memory.",
  },
  {
    emoji: "🎬",
    title: "Post-Credit Scene Missing",
    body: "Your day had action, suspense, and probably unnecessary suffering. Write the final scene in your diary.",
  },
  {
    emoji: "📉",
    title: "Reflection Levels Critically Low",
    body: "Productivity recorded. Self-awareness not found. Write something before you become a spreadsheet with legs.",
  },
  {
    emoji: "🪤",
    title: "Memory Trap Failed",
    body: "You thought you'd remember everything later. That was adorable. Write it down now.",
  },
  {
    emoji: "🎰",
    title: "Emotional Jackpot Unclaimed",
    body: "Today definitely had a weird moment worth saving. Go cash it in with a diary entry.",
  },
  {
    emoji: "🧬",
    title: "Daily DNA Not Preserved",
    body: "Today had unique emotional genetics. If you don't write it, tomorrow mutates the whole story.",
  },
  {
    emoji: "🫥",
    title: "Your Day Is Becoming A Ghost",
    body: "It's fading already. Write your diary before today becomes one of those 'something happened… I think?' days.",
  },
  {
    emoji: "🍿",
    title: "This Episode Needs Commentary",
    body: "You lived through today's nonsense. The least you can do is leave director's notes in your diary.",
  },
  {
    emoji: "🧊",
    title: "Freeze This Day",
    body: "Today deserves to be frozen before time turns it into emotional soup. Write your diary.",
  },
  {
    emoji: "🪞",
    title: "Mirror Mode Disabled",
    body: "You did the work. Cool. But have you looked at your own brain today? Diary. Now.",
  },
  {
    emoji: "📚",
    title: "Chapter Written? Absolutely Not.",
    body: "Another dramatic page in the book of your life and somehow… still no diary entry?",
  },
  {
    emoji: "🐒",
    title: "Inner Monkey Still Screaming",
    body: "Your outer self acted normal today. Your inner monkey has notes. Let it write.",
  },
  {
    emoji: "⚠️",
    title: "Unprocessed Day Warning",
    body: "This day has not been emotionally compiled. Please process before weird bugs appear tomorrow.",
  },
  {
    emoji: "🪐",
    title: "Planet You Needs Logs",
    body: "Astronomers may never understand your day, but your diary at least has a chance.",
  },
  {
    emoji: "🎯",
    title: "Mission Almost Complete",
    body: "Work log done. Survival achieved. Only one final boss remains: writing your diary.",
  },
  {
    emoji: "🦖",
    title: "Ancient Memory Risk",
    body: "In approximately 6 hours, today will feel like it happened in the dinosaur era. Write it now.",
  },
  {
    emoji: "🧿",
    title: "Your Day Had Evil Eye Energy",
    body: "Something definitely happened today that deserves documentation before it haunts your next mood swing.",
  },
  {
    emoji: "🚨",
    title: "Drama Archive Empty",
    body: "You cannot keep producing daily plot twists and then refuse to maintain proper records.",
  },
  {
    emoji: "🍕",
    title: "Diary First, Pizza Later",
    body: "You've earned snacks, but your brain is asking for emotional closure before the cheese arrives.",
  },
  {
    emoji: "🎤",
    title: "Mic Check — Your Thoughts?",
    body: "You had a full day and somehow left the stage without saying anything? Diary, superstar.",
  },
  {
    emoji: "🫡",
    title: "Soldier, Write The Report",
    body: "You survived another battlefield disguised as a normal day. File the diary report immediately.",
  },
  {
    emoji: "🛑",
    title: "Stop Scrolling, Commander",
    body: "Yes, this is your sign. No, Instagram will not preserve your personal lore. Diary will.",
  },
  {
    emoji: "🧸",
    title: "Tiny Feelings Need A Home",
    body: "Even the weird little thoughts deserve housing. Put them in your diary before they become midnight nonsense.",
  },
  {
    emoji: "🫣",
    title: "Avoiding Reflection Again?",
    body: "Interesting strategy. Bold, even. Unfortunately, your diary is still waiting like an unpaid bill.",
  },
  {
    emoji: "🧱",
    title: "Character Development Pending",
    body: "You can't become legendary if you refuse to document the emotional construction process.",
  },
  {
    emoji: "🎮",
    title: "Side Quest: Write Your Diary",
    body: "Reward: clarity. XP: wisdom. Penalty for skipping: random overthinking at bedtime.",
  },
  {
    emoji: "🪄",
    title: "Make Today Less Useless",
    body: "Turn today's confusion into future wisdom with one powerful spell: writing stuff down.",
  },
  {
    emoji: "🐍",
    title: "Thoughts Slithering Away",
    body: "Your best reflections are escaping quietly. Catch them in your diary before they disappear into the void.",
  },
  {
    emoji: "🌚",
    title: "Night Shift For Your Mind",
    body: "Before your brain starts replaying embarrassing moments at midnight, write the diary and save yourself.",
  },
  {
    emoji: "🧯",
    title: "Extinguish Internal Fire",
    body: "Your day may be over, but your brain is still smoking. Write it out before it reignites.",
  },
  {
    emoji: "📀",
    title: "Insert Emotional Backup Disk",
    body: "Today's memories are one accidental sleep away from corruption. Backup required: diary entry.",
  },
  {
    emoji: "🪓",
    title: "Cut The Mental Clutter",
    body: "Too many tabs open in your head. Time to close some with a clean diary dump.",
  },
  {
    emoji: "🫗",
    title: "Thought Overflow Incoming",
    body: "Your brain cup is full. Pour today into your diary before it spills into anxiety.",
  },
  {
    emoji: "📍",
    title: "Pin This Day",
    body: "Some part of today matters more than you think. Pin it down before tomorrow buries it.",
  },
  {
    emoji: "🦴",
    title: "Give Your Day A Skeleton",
    body: "Right now today is just vibes and fragments. Add structure. Add words. Add diary.",
  },
  {
    emoji: "🏁",
    title: "Finish Like A Legend",
    body: "You already survived the day. Ending it with a diary entry is how professionals close loops.",
  },
];

const HINDI_MSGS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "😂",
    title: "Arre bhai, Diary ka kya?",
    body: "Work log toh save kar diya, par aaj ki feelings ka kya? Diary likha ya nahi? 📝",
  },
  {
    emoji: "🤔",
    title: "Git Push Toh Kiya...",
    body: "Tera kaam toh push ho gaya. Ab apni Diary pe bhi commit kar de yaar! 🚀",
  },
  {
    emoji: "😅",
    title: "Bug Report: Diary Missing",
    body: "Production mein work log live hai, par teri Diary ka route 404 de raha hai. Fix kar! 📔",
  },
  {
    emoji: "🙈",
    title: "Aaj Kya Hua Tha Bhai?",
    body: "Kal poochha toh bolunga 'yaad nahi'! Abhi Diary likh de — future-you thank karega. 😄",
  },
  {
    emoji: "🤣",
    title: "RAM Full Ho Jayegi!",
    body: "Aaj ki saari memories abhi RAM mein hain. Diary mein save kar nahi toh crash hoga! 💾",
  },
  {
    emoji: "😤",
    title: "Stack Overflow Pe Mat Dhoond",
    body: "Teri life ka solution Stack Overflow pe nahi milega. Diary likh, bhai! ✍️",
  },
  {
    emoji: "🎯",
    title: "Deployment Adhoori Hai!",
    body: "Work deploy ho gaya. Diary entry abhi bhi pending hai yaar. Pipeline complete kar! 😂",
  },
  {
    emoji: "😆",
    title: "Null Pointer Exception!",
    body: "Aaj ki feelings null return kar rahi hain. Diary mein initialize kar de jaldi! 📖",
  },
  {
    emoji: "🏆",
    title: "Achievement Incomplete!",
    body: "Office se nikla ✅ Kaam save kiya ✅ Diary likhi ❌ Aa chal, ab Diary likh! 😤",
  },
  {
    emoji: "🔥",
    title: "Hot Reload Chhod, Diary Likh!",
    body: "Browser toh reload hota rehta hai. Teri memories nahi. Ab Diary likh de! 📔",
  },
  {
    emoji: "🧠",
    title: "Dimaag Cache Overflow",
    body: "Aaj ka pura din dimaag mein temporary file ban ke pada hai. Diary mein dump kar warna udd jayega.",
  },
  {
    emoji: "📦",
    title: "Thoughts Parcel Mein Atke Hain",
    body: "Kaam deliver ho gaya, par tere thoughts abhi bhi packing mein hain. Diary likh aur release kar.",
  },
  {
    emoji: "🤖",
    title: "Insaan Ban Thoda",
    body: "Machine ki tarah kaam kar liya. Ab thoda human mode ON kar aur Diary likh.",
  },
  {
    emoji: "🫠",
    title: "Dimaag Pighal Raha Hai",
    body: "Aaj ka din heavy tha na? Diary mein likh de warna raat ko wahi replay hoga.",
  },
  {
    emoji: "🧾",
    title: "Bill Bana, Diary Gayab",
    body: "Invoice generate kar diya, par aaj ki kahani Diary mein likhna bhool gaya? Kya logic hai ye?",
  },
  {
    emoji: "👀",
    title: "Kuch Toh Chhupa Raha Hai",
    body: "Diary nahi likhi? Matlab aaj kuch interesting ya dangerous hua hai. Sach bol aur Diary likh.",
  },
  {
    emoji: "🎭",
    title: "Aaj Hero Tha Ya Villain?",
    body: "Aaj ka role kya tha tera? Hero, clown, ya villain? Decide kar aur Diary mein likh.",
  },
  {
    emoji: "🛸",
    title: "Aaj Kuch Alien Level Hua Hai",
    body: "Aaj ka din normal nahi tha. Diary nahi likhi toh kal lagega aliens aaye the.",
  },
  {
    emoji: "🧨",
    title: "Andar Bomb Pada Hai",
    body: "Jo bhi andar daba ke rakha hai na… Diary mein nahi likha toh kabhi bhi phat sakta hai.",
  },
  {
    emoji: "📡",
    title: "Memory Signal Weak",
    body: "Aaj ki yaadein weak network pe chal rahi hain. Diary likh warna signal gone.",
  },
  {
    emoji: "🎪",
    title: "Aaj Ka Circus Khatam",
    body: "Aaj ka pura clown show over ho gaya. Ab uska official summary Diary mein likh.",
  },
  {
    emoji: "🪦",
    title: "Unwritten Thoughts RIP",
    body: "Jo bhi achha ya weird aaj feel hua tha, Diary mein nahi likha toh kal tak dead ho jayega.",
  },
  {
    emoji: "🕵️",
    title: "Case File Missing Hai",
    body: "Aaj kya hua uski report file nahi hui. Detective banna band kar aur Diary likh.",
  },
  {
    emoji: "🌪️",
    title: "Toofan Aaya Tha Kya?",
    body: "Aaj ka din simple nahi tha. Diary mein likh warna kal sab hawa ho jayega.",
  },
  {
    emoji: "🧃",
    title: "Aaj Ka Juice Nikaal",
    body: "Din ka asli extract Diary mein likh. Warna bas thakan hi yaad rahegi.",
  },
  {
    emoji: "🎬",
    title: "Movie Ka Last Scene Missing",
    body: "Aaj ka din movie tha, par uska ending scene Diary mein likhna abhi baaki hai.",
  },
  {
    emoji: "📉",
    title: "Self-Awareness Down Hai",
    body: "Kaam ho gaya, par aaj tune feel kya kiya? Diary likh warna tu khud se disconnected ho raha hai.",
  },
  {
    emoji: "🪤",
    title: "Yaad Rahega? Haan Haan...",
    body: "Tu phir soch raha hai 'baad mein yaad rahega'. Nahi rahega. Diary likh abhi.",
  },
  {
    emoji: "🎰",
    title: "Aaj Ka Scene Worthy Tha",
    body: "Aaj ek na ek moment toh Diary worthy tha. Usko waste mat hone de.",
  },
  {
    emoji: "🧬",
    title: "Aaj Ka Version Unique Tha",
    body: "Har din same nahi hota. Aaj ka version Diary mein preserve kar.",
  },
  {
    emoji: "🫥",
    title: "Din Ghost Ban Raha Hai",
    body: "Aaj ka din dheere dheere ghost ban raha hai. Diary likh warna bas vibe bachegi.",
  },
  {
    emoji: "🍿",
    title: "Review Toh De",
    body: "Aaj ka full movie experience mila. Ab uska review Diary mein likh na, critic saab.",
  },
  {
    emoji: "🧊",
    title: "Freeze Kar Is Din Ko",
    body: "Aaj ka din important tha ya weird tha — dono cases mein Diary mein freeze kar.",
  },
  {
    emoji: "🪞",
    title: "Khud Ko Ignore Mat Kar",
    body: "Sabka kaam dekh liya. Ab khud ko dekh aur Diary likh.",
  },
  {
    emoji: "📚",
    title: "Life Ka Chapter Skip Mat Kar",
    body: "Aaj ka chapter bina Diary ke skip kar diya toh story weak ho jayegi.",
  },
  {
    emoji: "🐒",
    title: "Andar Ka Bandar Chill Nahi Hai",
    body: "Andar kuch na kuch toh kood raha hai. Usko Diary mein daal warna disturb karega.",
  },
  {
    emoji: "⚠️",
    title: "Unprocessed Din Detected",
    body: "Aaj ka din abhi process nahi hua. Diary likh warna kal mental glitch aayega.",
  },
  {
    emoji: "🪐",
    title: "Teri Story Chhoti Nahi Hai",
    body: "Tujhe lag raha hoga normal din tha, par future mein ye Diary entry gold lagegi.",
  },
  {
    emoji: "🎯",
    title: "Mission Bas Ek Step Door",
    body: "Kaam save, din khatam, bas Diary likh aur mission complete kar.",
  },
  {
    emoji: "🦖",
    title: "Kal Sab Prehistoric Lagega",
    body: "Aaj jo fresh lag raha hai na, kal dinosaur era jaisa lagega. Diary likh abhi.",
  },
  {
    emoji: "🚨",
    title: "Drama Archive Empty Hai",
    body: "Roz itna content generate karta hai aur Diary maintain bhi nahi karta? Shame.",
  },
  {
    emoji: "🍕",
    title: "Pehle Diary, Phir Chill",
    body: "Pizza, reels, scrolling sab baad mein. Pehle Diary likh aur dimaag halka kar.",
  },
  {
    emoji: "🎤",
    title: "Bolna Tha Kuch?",
    body: "Aaj kuch andar dab gaya hai kya? Diary likh warna woh raat ko awaaz karega.",
  },
  {
    emoji: "🫡",
    title: "Report File Kar, Soldier",
    body: "Aaj ka battlefield survive kar liya? Achha. Ab Diary report file kar.",
  },
  {
    emoji: "🛑",
    title: "Scroll Band Kar Ab",
    body: "Instagram teri life yaad nahi rakhega. Diary rakhegi. Samajh ja.",
  },
  {
    emoji: "🧸",
    title: "Chhoti Feelings Bhi Matter Karti Hain",
    body: "Jo chhoti si baat aaj lagi na… wahi kal important niklegi. Diary likh.",
  },
  {
    emoji: "🫣",
    title: "Sach Se Bhaag Raha Hai?",
    body: "Diary nahi likh raha? Matlab aaj kuch toh hai jo tu face nahi karna chahta.",
  },
  {
    emoji: "🧱",
    title: "Character Development Pending",
    body: "Growth sirf kaam se nahi hoti. Diary likhne se bhi hoti hai, hero.",
  },
  {
    emoji: "🎮",
    title: "Side Quest: Diary",
    body: "Main mission complete. Ab side quest kar — Diary likh aur XP le.",
  },
  {
    emoji: "🪄",
    title: "Magic Yahin Se Shuru Hoti Hai",
    body: "Aaj ka random din bhi Diary mein likhne ke baad meaningful lagta hai.",
  },
  {
    emoji: "🐍",
    title: "Thoughts Fisal Rahe Hain",
    body: "Jo soch raha tha na, woh dheere dheere nikal raha hai. Diary mein pakad le.",
  },
  {
    emoji: "🌚",
    title: "Raat Ko Yaad Aayega Sab",
    body: "Ab Diary nahi likhi toh raat ko bed pe padhe padhe sab yaad aayega. Phir mat bolna.",
  },
  {
    emoji: "🧯",
    title: "Andar Aag Lagi Hai",
    body: "Jo andar jal raha hai usko Diary mein likh warna kal aur dhuaan niklega.",
  },
  {
    emoji: "📀",
    title: "Backup Nahi Liya Tune",
    body: "Aaj ka din bina Diary ke bina backup ke chhod raha hai. Risky kaam hai ye.",
  },
  {
    emoji: "🪓",
    title: "Dimaag Ka Kachra Saaf Kar",
    body: "Bahut tabs open hain dimaag mein. Diary likh aur thoda clean up kar.",
  },
  {
    emoji: "🫗",
    title: "Brain Overflow Alert",
    body: "Dimaag full ho chuka hai. Diary likh warna overthinking leak ho jayegi.",
  },
  {
    emoji: "📍",
    title: "Is Din Ko Pin Kar",
    body: "Aaj ka din ya feeling normal nahi thi. Diary mein pin kar de.",
  },
  {
    emoji: "🦴",
    title: "Aaj Ko Structure De",
    body: "Abhi sab random lag raha hai. Diary likh aur aaj ko shape de.",
  },
  {
    emoji: "🏁",
    title: "Din Ko Legend Jaise Close Kar",
    body: "Aaj ka end proper tabhi hoga jab tu Diary likh ke is din ko close karega.",
  },
  {
    emoji: "🌑",
    title: "Aaj Ka Din Chup Chap Mar Raha Hai",
    body: "Diary mein nahi likha toh aaj ka din bina nishaan ke mar jayega. Itna bhi sasta mat hone de.",
  },
  {
    emoji: "🕳️",
    title: "Sab Kuch Void Mein Gir Raha Hai",
    body: "Aaj ki baatein dheere dheere andhere mein gir rahi hain. Diary likh warna kuch nahi bachega.",
  },
  {
    emoji: "☠️",
    title: "Memory Ki Laash Mil Gayi",
    body: "Kal subah tak aaj ki aadhi yaadein mar chuki hongi. Diary likh aur unko bacha.",
  },
  {
    emoji: "🩸",
    title: "Andar Se Kuch Tapak Raha Hai",
    body: "Sab theek bolne se sab theek nahi hota. Diary likh. Andar jo hai usko naam de.",
  },
  {
    emoji: "🌘",
    title: "Tu Khud Se Bach Nahi Raha",
    body: "Diary avoid karke sirf likhna nahi, khud ko avoid kar raha hai. Thoda sach likh.",
  },
  {
    emoji: "⚰️",
    title: "Aaj Ko Dafna Mat",
    body: "Har din bas survive karke dafan mat kar. Diary likh aur usko meaning de.",
  },
  {
    emoji: "🫀",
    title: "Dil Ka Log File Pending",
    body: "Work log save ho gaya. Dil ka log file abhi bhi missing hai. Diary khol.",
  },
  {
    emoji: "🪦",
    title: "Kal Tak Sab Mitt Jayega",
    body: "Jo aaj itna real lag raha hai, kal aadha fake lagega. Diary likh jab tak sach garam hai.",
  },
  {
    emoji: "🌒",
    title: "Andhera Itna Bhi Cool Nahi Hai",
    body: "Har cheez andar daba ke rakhna deep nahi hota. Diary likh. Zinda insaan lag.",
  },
  {
    emoji: "🔪",
    title: "Truth Cut Karega, Par Heal Bhi",
    body: "Diary likhne mein thoda dard hai, par chup rehne mein zyada. Aaj ka sach likh.",
  },
];

// ─── Pick a random message ─────────────────────────────────────────────────
function getRandomMsg() {
  const useHindi = Math.random() < 0.5;
  const pool     = useHindi ? HINDI_MSGS : ENGLISH_MSGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Floating orb decoration ──────────────────────────────────────────────
function FloatingOrbs() {
  return (
    <div
      aria-hidden="true"
      style={{
        position:      "absolute",
        inset:         0,
        overflow:      "hidden",
        borderRadius:  "20px",
        pointerEvents: "none",
      }}
    >
      {/* Top-right large orb */}
      <div
        style={{
          position:     "absolute",
          top:          "-30px",
          right:        "-30px",
          width:        "120px",
          height:       "120px",
          borderRadius: "50%",
          background:   "radial-gradient(circle, rgba(124,110,243,0.35) 0%, transparent 70%)",
          animation:    "hb-orb-pulse 4s ease-in-out infinite",
        }}
      />
      {/* Bottom-left smaller orb */}
      <div
        style={{
          position:     "absolute",
          bottom:       "-20px",
          left:         "10px",
          width:        "80px",
          height:       "80px",
          borderRadius: "50%",
          background:   "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)",
          animation:    "hb-orb-pulse 4s ease-in-out infinite 2s",
        }}
      />
      {/* Mid accent */}
      <div
        style={{
          position:     "absolute",
          top:          "50%",
          left:         "-15px",
          width:        "50px",
          height:       "50px",
          borderRadius: "50%",
          background:   "radial-gradient(circle, rgba(99,86,218,0.2) 0%, transparent 70%)",
          animation:    "hb-orb-pulse 6s ease-in-out infinite 1s",
        }}
      />
    </div>
  );
}

// ─── Sparkle dots decoration ──────────────────────────────────────────────
function SparkleParticles() {
  const particles = [
    { top: "18%", left: "85%", size: 3, delay: "0s",   dur: "2.5s" },
    { top: "70%", left: "92%", size: 2, delay: "0.8s", dur: "3s"   },
    { top: "35%", left: "78%", size: 2, delay: "1.4s", dur: "2.8s" },
    { top: "55%", left: "88%", size: 3, delay: "0.4s", dur: "3.2s" },
  ];

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: "20px" }}
    >
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            top:          p.top,
            left:         p.left,
            width:        `${p.size}px`,
            height:       `${p.size}px`,
            borderRadius: "50%",
            background:   "rgba(200,190,255,0.85)",
            animation:    `hb-sparkle ${p.dur} ease-in-out ${p.delay} infinite`,
            boxShadow:    "0 0 4px 1px rgba(180,170,255,0.5)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Custom Toast Renderer ─────────────────────────────────────────────────
interface ToastRendererProps {
  toastId:   string;
  emoji:     string;
  title:     string;
  body:      string;
  onWrite:   () => void;
  onDismiss: () => void;
}

function DiaryToastRenderer({
  toastId, emoji, title, body, onWrite, onDismiss,
}: ToastRendererProps) {
  return (
    <>
      {/* ── Global keyframes (injected once, harmless if duplicated) ── */}
      <style>{`
        @keyframes hb-slide-in {
          0%   { opacity: 0; transform: translateX(80px) scale(0.88) rotate(2deg); }
          60%  { opacity: 1; transform: translateX(-6px) scale(1.02) rotate(-0.5deg); }
          100% { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
        }
        @keyframes hb-progress-bar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
        @keyframes hb-orb-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%      { transform: scale(1.18); opacity: 1;   }
        }
        @keyframes hb-sparkle {
          0%, 100% { opacity: 0;   transform: scale(0.5) rotate(0deg);   }
          40%      { opacity: 1;   transform: scale(1.3) rotate(90deg);  }
          70%      { opacity: 0.6; transform: scale(1)   rotate(180deg); }
        }
        @keyframes hb-icon-float {
          0%, 100% { transform: translateY(0px) rotate(0deg);   }
          50%      { transform: translateY(-3px) rotate(5deg);  }
        }
        @keyframes hb-badge-shine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center;  }
        }
        .hb-btn-write:hover {
          transform: translateY(-2px) scale(1.02) !important;
          box-shadow: 0 8px 24px rgba(124,110,243,0.65) !important;
        }
        .hb-btn-write:active {
          transform: translateY(0px) scale(0.98) !important;
        }
        .hb-btn-later:hover {
          background: rgba(255,255,255,0.14) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.25) !important;
        }
        .hb-dismiss:hover {
          background: rgba(255,255,255,0.18) !important;
          color: #fff !important;
          transform: rotate(90deg) scale(1.1) !important;
        }
      `}</style>

      {/* ── Outer shell ── */}
      <div
        style={{
          position:     "relative",
          display:      "flex",
          flexDirection:"column",
          gap:          "12px",
          background:   "linear-gradient(145deg, #12102b 0%, #1a1535 40%, #0e1e45 100%)",
          border:       "1px solid rgba(140,124,255,0.38)",
          borderRadius: "20px",
          padding:      "18px 20px 14px",
          minWidth:     "320px",
          maxWidth:     "380px",
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.04)",
            "0 12px 40px rgba(0,0,0,0.55)",
            "0 4px 16px rgba(124,110,243,0.28)",
            "inset 0 1px 0 rgba(255,255,255,0.07)",
          ].join(", "),
          animation:    "hb-slide-in 0.55s cubic-bezier(0.34,1.26,0.64,1) both",
          overflow:     "hidden",
        }}
      >
        {/* Decorative blobs + sparkles */}
        <FloatingOrbs />
        <SparkleParticles />

        {/* Top mesh line accent */}
        <div
          aria-hidden="true"
          style={{
            position:   "absolute",
            top:        0,
            left:       0,
            right:      0,
            height:     "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.7) 40%, rgba(99,179,237,0.4) 70%, transparent)",
          }}
        />

        {/* ── Dismiss button ── */}
        <button
          className="hb-dismiss"
          onClick={onDismiss}
          style={{
            position:       "absolute",
            top:            "12px",
            right:          "12px",
            background:     "rgba(255,255,255,0.06)",
            border:         "1px solid rgba(255,255,255,0.1)",
            borderRadius:   "8px",
            width:          "26px",
            height:         "26px",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            cursor:         "pointer",
            color:          "rgba(200,190,255,0.55)",
            transition:     "all 0.22s ease",
            zIndex:         10,
            padding:        0,
          }}
          aria-label="Dismiss"
        >
          <X size={12} strokeWidth={2.5} />
        </button>

        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingRight: "32px", position: "relative", zIndex: 1 }}>

          {/* Animated icon pill */}
          <div
            style={{
              flexShrink:     0,
              width:          "46px",
              height:         "46px",
              borderRadius:   "14px",
              background:     "linear-gradient(145deg, #7c6ef3 0%, #9b6de0 50%, #5e53c8 100%)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              boxShadow:      "0 6px 20px rgba(124,110,243,0.6), inset 0 1px 0 rgba(255,255,255,0.2)",
              animation:      "hb-icon-float 3s ease-in-out infinite",
              border:         "1px solid rgba(180,160,255,0.3)",
            }}
          >
            <BookOpen size={21} color="#fff" strokeWidth={1.8} />
          </div>

          <div style={{ flex: 1 }}>
            {/* Badge label */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
              <Sparkles size={10} color="rgba(200,180,255,0.8)" />
              <span
                style={{
                  fontSize:      "10px",
                  fontWeight:    700,
                  color:         "rgba(190,170,255,0.85)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background:    "linear-gradient(90deg, rgba(190,170,255,0.85), rgba(140,180,255,0.8), rgba(190,170,255,0.85))",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor:  "transparent",
                  animation:     "hb-badge-shine 3s linear infinite",
                }}
              >
                📔 Diary Reminder
              </span>
            </div>
            {/* Title */}
            <p
              style={{
                margin:     0,
                fontSize:   "15px",
                fontWeight: 700,
                color:      "#edeaff",
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              {emoji} {title}
            </p>
          </div>
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            height:     "1px",
            background: "linear-gradient(90deg, rgba(124,110,243,0.5) 0%, rgba(99,179,237,0.2) 60%, transparent 100%)",
            position:   "relative",
            zIndex:     1,
          }}
        />

        {/* ── Body text ── */}
        <p
          style={{
            margin:     0,
            fontSize:   "13px",
            color:      "rgba(210,205,235,0.88)",
            lineHeight: 1.6,
            position:   "relative",
            zIndex:     1,
          }}
        >
          {body}
        </p>

        {/* ── CTA buttons ── */}
        <div style={{ display: "flex", gap: "8px", position: "relative", zIndex: 1 }}>
          {/* Primary: Write Diary */}
          <button
            className="hb-btn-write"
            onClick={onWrite}
            style={{
              flex:           1,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "6px",
              background:     "linear-gradient(135deg, #7c6ef3 0%, #6152e8 60%, #8b6ef3 100%)",
              border:         "1px solid rgba(180,160,255,0.35)",
              borderRadius:   "12px",
              padding:        "9px 16px",
              color:          "#fff",
              fontSize:       "13px",
              fontWeight:     700,
              cursor:         "pointer",
              letterSpacing:  "0.01em",
              transition:     "all 0.22s cubic-bezier(0.34,1.4,0.64,1)",
              boxShadow:      "0 5px 16px rgba(124,110,243,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <BookOpen size={14} strokeWidth={2} />
            Write Diary
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>

          {/* Secondary: Later */}
          <button
            className="hb-btn-later"
            onClick={onDismiss}
            style={{
              background:     "rgba(255,255,255,0.06)",
              border:         "1px solid rgba(255,255,255,0.1)",
              borderRadius:   "12px",
              padding:        "9px 16px",
              color:          "rgba(210,200,240,0.75)",
              fontSize:       "13px",
              fontWeight:     500,
              cursor:         "pointer",
              transition:     "all 0.22s ease",
              whiteSpace:     "nowrap",
            }}
          >
            Later
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div
          style={{
            position:     "relative",
            height:       "3px",
            borderRadius: "2px",
            background:   "rgba(255,255,255,0.07)",
            overflow:     "hidden",
            zIndex:       1,
          }}
        >
          {/* Track glow */}
          <div
            style={{
              position:        "absolute",
              inset:           0,
              background:      "linear-gradient(90deg, #7c6ef3, #a78bfa, #6ee7f7)",
              borderRadius:    "2px",
              animation:       "hb-progress-bar 11s linear forwards",
              transformOrigin: "left center",
              boxShadow:       "0 0 6px rgba(167,139,250,0.8)",
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Public function — call this from your handleSave ─────────────────────
export function showDiaryReminderToast(
  router: ReturnType<typeof useRouter>
): void {
  const msg = getRandomMsg();

  toast.custom(
    (t) => (
      <DiaryToastRenderer
        toastId   = {t.id}
        emoji     = {msg.emoji}
        title     = {msg.title}
        body      = {msg.body}
        onWrite   = {() => {
          toast.dismiss(t.id);
          router.push("/dashboard/diary");
        }}
        onDismiss = {() => toast.dismiss(t.id)}
      />
    ),
    {
      duration: 15000,
      position: "bottom-center",
      id:       "diary-reminder",
    }
  );
}