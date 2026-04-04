// app/components/DiaryReminderToast.tsx
//
// A beautiful custom toast that nudges the user to write their diary
// after they save today's work log (entry + exit time both present).
//
// Auto-dismisses immediately when the user navigates to a different route.

"use client";

import toast                         from "react-hot-toast";
import { useRouter, usePathname }    from "next/navigation";
import { useEffect }                 from "react";
import { BookOpen, X, ArrowRight, Sparkles } from "lucide-react";

// ─── Funny message bank ──────────────────────────────────────────────────────
const ENGLISH_MSGS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🧠",
    title: "You Will Forget Everything",
    body: "That 'important thing' that happened today? Gone by 11 PM. You'll lie in bed trying to remember it like a goldfish with anxiety.",
  },
  {
    emoji: "💀",
    title: "Your Future Self Hates You",
    body: "Future you will scroll back trying to understand why today was bad. You're about to give them absolutely nothing. Diary. Now.",
  },
  {
    emoji: "🫥",
    title: "You're Already Fading",
    body: "The version of you that lived through today is dying. In 3 hours it'll be gone forever. Write the diary or it didn't happen.",
  },
  {
    emoji: "🪦",
    title: "Today Is Dying Unwritten",
    body: "Every day you don't write a diary is a day you murdered and buried with your own hands. Congratulations on the body count.",
  },
  {
    emoji: "🐛",
    title: "Unprocessed Day Bug Detected",
    body: "You think you'll process today in your sleep. You won't. You'll just replay your most embarrassing memory from 2019 instead.",
  },
  {
    emoji: "🌑",
    title: "Dark Thoughts Need A Container",
    body: "All that stuff you're pretending didn't bother you today? It's going somewhere. Diary or your 2 AM anxiety. Your pick.",
  },
  {
    emoji: "🫀",
    title: "Your Heart Filed A Report",
    body: "Your heart had a whole day of opinions and feelings. You logged your work hours. You absolute machine. Write the diary.",
  },
  {
    emoji: "🧨",
    title: "Detonation Scheduled For Midnight",
    body: "Whatever you're suppressing right now has a timer on it. Either write it down or meet it at 3 AM while staring at the ceiling.",
  },
  {
    emoji: "🕳️",
    title: "The Void Is Eating Today",
    body: "Every minute you don't write, today disappears. The void is hungry and patient. Your diary is the only weapon you have.",
  },
  {
    emoji: "🔪",
    title: "This Is A Cry For Help",
    body: "Not from you. From today. Today is screaming to be documented and you're here closing tabs like nothing happened. DIARY.",
  },
  {
    emoji: "☠️",
    title: "Memory Cemetery Is Getting Full",
    body: "Another undocumented day joins the graveyard of every other day you forgot. Pour one out and write the diary.",
  },
  {
    emoji: "🧟",
    title: "Zombie Mode Detected",
    body: "You saved your work log and now you're going to scroll reels until you're dead inside. Diary first. Rot later.",
  },
  {
    emoji: "🩸",
    title: "Bleed It Out Already",
    body: "Something happened today that you're holding in your chest. You know what it is. The diary knows too. Let it out.",
  },
  {
    emoji: "🌘",
    title: "Darkness Is Free Real Estate",
    body: "If you don't fill today with words, your brain will fill it with regret loops and imaginary arguments. Write the diary.",
  },
  {
    emoji: "😶‍🌫️",
    title: "You're Dissociating Right Now",
    body: "Be honest. You're not even fully present. Part of you is still in a meeting from 4 hours ago. Write about it. Come back to earth.",
  },
  {
    emoji: "🪤",
    title: "Your Brain Will Trap You",
    body: "Skip the diary and your brain will reconstruct today wrong — dramatic where it was boring, fine where it was awful. Write the truth.",
  },
  {
    emoji: "👁️",
    title: "Something Is Watching You Avoid This",
    body: "You've checked your phone 4 times since finishing work. You've done everything except the one thing that might actually help.",
  },
  {
    emoji: "🫣",
    title: "You're Scared Of Your Own Diary",
    body: "Interesting. You'll write code, answer emails, do everything — but writing one honest paragraph about yourself? Terrifying. Why?",
  },
  {
    emoji: "📉",
    title: "Self-Awareness Levels: Critical",
    body: "You spent all day being perceived by others and zero minutes perceiving yourself. The diary is where you get to be honest. Use it.",
  },
  {
    emoji: "🌪️",
    title: "The Chaos Needs Organizing",
    body: "You held it together all day. You were professional. You smiled when you didn't want to. Write it down before the mask gets permanent.",
  },
  {
    emoji: "🔮",
    title: "Future You Will Pay For This",
    body: "In 6 months you'll wonder why you felt so off during this period. With no diary you'll have exactly zero evidence. Start writing.",
  },
  {
    emoji: "🧊",
    title: "You Froze Out Your Own Feelings",
    body: "You're very good at compartmentalizing. Too good, actually. The diary is the one place you're allowed to be messy. Be messy.",
  },
  {
    emoji: "🎭",
    title: "Take The Mask Off",
    body: "You performed 'person who is fine' all day. The show is over. The diary doesn't care about the performance. Write who was actually there.",
  },
  {
    emoji: "🌚",
    title: "The Night Shift Starts Soon",
    body: "Your brain's night shift involves replaying conversations and questioning choices. The diary is the only way to clock it out early.",
  },
  {
    emoji: "🦷",
    title: "Mental Hygiene Check",
    body: "You brush your teeth every night. That's just maintenance, right? The diary is the same thing but for your brain. Brush your brain.",
  },
  {
    emoji: "🧯",
    title: "Something Is Still Burning",
    body: "You know exactly what it is. You've been ignoring it since noon. The diary is the extinguisher. The bed at midnight is not.",
  },
  {
    emoji: "📡",
    title: "Signal Lost At Midnight",
    body: "The version of you that remembers today clearly exists only until you fall asleep. After that? Interference. Write before signal dies.",
  },
  {
    emoji: "⚰️",
    title: "Bury It In The Diary, Not In You",
    body: "Every thing you suppress becomes weight you carry tomorrow. The diary takes the weight. That's literally its whole job.",
  },
  {
    emoji: "🐍",
    title: "Something's Coiling In There",
    body: "That low-level bad feeling you've been carrying? It doesn't have a name yet. Give it one. In the diary. Right now.",
  },
  {
    emoji: "🌒",
    title: "The Quiet Hours Are Lying",
    body: "Right now it feels quiet and fine. It isn't. The diary at 9 PM is honest. The anxiety at 2 AM is not. Choose wisely.",
  },
  {
    emoji: "🔩",
    title: "Something Is Loose In There",
    body: "You can feel it. Something today didn't sit right. Didn't resolve. Didn't close. The diary finds the loose screw. Go write.",
  },
  {
    emoji: "🫁",
    title: "Breathe It Out On Paper",
    body: "You breathed through today. Good. Now exhale it properly — into the diary, where it can't keep choking you.",
  },
  {
    emoji: "🧠",
    title: "Your RAM Is Full Of Today",
    body: "Everything is still loaded and hot. You won't sleep clean with all this running. Dump it to disk. Write the diary. Shut down properly.",
  },
  {
    emoji: "🎪",
    title: "The Circus Didn't End At 5",
    body: "You left the office but the circus followed you home. It lives in your chest now. Evict it. Diary.",
  },
  {
    emoji: "🦴",
    title: "Tired To The Bone",
    body: "Yeah. We know. But tired people who write their diary sleep better than tired people who scroll until they go numb. Proven.",
  },
  {
    emoji: "🌪️",
    title: "Everything Is Still Spinning",
    body: "You're not calm. You're just still. There's a difference. The diary will tell you which thoughts are yours and which are just noise.",
  },
  {
    emoji: "🧬",
    title: "Today Changed You Slightly",
    body: "You won't notice it now. But something shifted. Every day does. Document it before the before-version of you is unrecoverable.",
  },
  {
    emoji: "🪐",
    title: "You Are The Only Witness",
    body: "Nobody else saw today the way you did. Nobody else felt it. If you don't write it, that perspective dies with the day.",
  },
  {
    emoji: "🕵️",
    title: "Evidence Is Disappearing",
    body: "If you ever need to know what actually happened to you this year — not vibes, not a feeling, actual events — the diary is the only record.",
  },
  {
    emoji: "💾",
    title: "Unsaved Progress Warning",
    body: "You auto-save code. You backup files. But you? You? You're just gonna let today corrupt and lose it. Open the diary.",
  },
  {
    emoji: "🫗",
    title: "You're Spilling And Don't Notice",
    body: "Thoughts are leaking. Feelings are leaking. You're everywhere right now. The diary puts you back in the container. Go.",
  },
  {
    emoji: "🧿",
    title: "The Evil Eye Saw Everything",
    body: "Something cursed happened today and you're about to let it fester unprocessed. Write it down and break the cycle.",
  },
  {
    emoji: "📍",
    title: "Pin Yourself To This Moment",
    body: "Tomorrow you'll be a different person with different problems. Today's version of you deserves to be pinned down. Write the diary.",
  },
  {
    emoji: "🔋",
    title: "Recharge Requires Reflection",
    body: "Sleep won't actually recharge you if the day is still processing in the background. Clear the cache. Write the diary.",
  },
  {
    emoji: "🫧",
    title: "The Bubble Is About To Pop",
    body: "You're holding everything in. You've been holding everything in. One honest diary entry is worth 6 suppressed conversations.",
  },
  {
    emoji: "🌫️",
    title: "Things Are Foggy And You Know It",
    body: "You can't quite see clearly right now. That's normal. The diary is how you find out what's actually there in the fog.",
  },
  {
    emoji: "🎬",
    title: "The Director's Cut Needs Writing",
    body: "The version of today everyone saw? That's the theatrical release. The real version — your version — lives only in the diary.",
  },
  {
    emoji: "🧪",
    title: "You Are The Experiment",
    body: "Your life is ongoing data. Every day is a data point. You just lived a data point. Document it before the sample corrupts.",
  },
  {
    emoji: "🌑",
    title: "The Darkest Thoughts Deserve Paper",
    body: "Not therapist paper. Just yours. The diary is the one place where the worst thoughts can go without doing any damage.",
  },
  {
    emoji: "🏁",
    title: "Close Today Properly",
    body: "You can't close a browser tab by minimizing it. Same thing. Open the diary. Write. Close today for real.",
  },
];

const HINDI_MSGS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "💀",
    title: "Kal Yaad Nahi Rahega Kuch Bhi",
    body: "Aaj jo important laga, kal subah tak uski laash bhi nahi milegi. Diary likh ya phir raat bhar neend mein usi ke saath lad.",
  },
  {
    emoji: "🧟",
    title: "Zombie Mode Mein Hai Tu",
    body: "Kaam save karke ab reels scroll karega jab tak andar se khatam nahi ho jaata. Diary pehle. Marna baad mein.",
  },
  {
    emoji: "🪦",
    title: "Aaj Ko Zinda Dafan Mat Kar",
    body: "Bina Diary ke aaj sirf ek aur bhool jaane wala din hai. Har aisa din tujhse kuch chheen ke jaata hai. Likh.",
  },
  {
    emoji: "🌑",
    title: "Andar Ka Andhera Grows Without Diary",
    body: "Jo bhi suppress karke rakha hai aaj, woh raat ko rent-free dimaag mein rehta hai. Diary mein daal. Nikaal bahar.",
  },
  {
    emoji: "🫀",
    title: "Dil Ka Data Missing Hai",
    body: "Work log mein ghante save kar liye. Lekin aaj dil kya bolna chahta tha? Woh toh tune record hi nahi kiya, machine.",
  },
  {
    emoji: "🧨",
    title: "Midnight Pe Phatega Ye",
    body: "Jo abhi thoda thoda uncomfortable feel ho raha hai na? Woh 2 baje bomb ban jaata hai. Diary usse defuse karta hai.",
  },
  {
    emoji: "🕳️",
    title: "Void Khaa Raha Hai Aaj Ko",
    body: "Har minute ke saath aaj thoda aur gayab ho raha hai. Diary likh warna sirf ek vague feeling bachegi — 'kuch hua tha shayad.'",
  },
  {
    emoji: "🩸",
    title: "Andar Kuch Tap Raha Hai",
    body: "'Sab theek hai' bolta rehta hai. Sab theek nahi hai. Tu khud jaanta hai. Diary mein likh jo actually hua tha.",
  },
  {
    emoji: "🌘",
    title: "Khud Se Bach Nahi Sakta",
    body: "Screen band kar. Phone rakh. Thoda ruk. Diary khol. Aaj jo hua — seedha likha — wahi sach hai. Wahi rakhna hai.",
  },
  {
    emoji: "☠️",
    title: "Memory Cemetery Mein Ek Aur Plot",
    body: "Ek aur undocumented din. Ek aur din jo tujhe shape karta raha aur tujhe kuch pata nahi chalega kyun. Diary likh.",
  },
  {
    emoji: "😶‍🌫️",
    title: "Tu Present Nahi Hai Abhi Bhi",
    body: "Tera ek hissa abhi bhi office mein hai. Ek hissa kal ki chinta mein hai. Diary likh aur actually ghar aa.",
  },
  {
    emoji: "🫣",
    title: "Khud Se Kyon Darta Hai?",
    body: "Code likh sakta hai, meetings le sakta hai, emails answer karta hai — lekin ek honest paragraph khud ke baare mein? Scary kyun hai ye?",
  },
  {
    emoji: "📉",
    title: "Self-Awareness Critically Low",
    body: "Poora din duniya ke liye perform kiya. Khud ko ek baar bhi nahi dekha. Diary woh aaina hai jo jhooth nahi bolta.",
  },
  {
    emoji: "🌪️",
    title: "Mask Utar Abhi",
    body: "Poora din 'main theek hoon' ka natak kiya. Performance khatam. Diary mein woh likh jo actually tha andar.",
  },
  {
    emoji: "🧊",
    title: "Feelings Ko Freeze Mat Kar",
    body: "Compartmentalize karna skill hai, par teri zindagi mein sab kuch frozen padi hai. Diary mein pighlne de. Ek baar.",
  },
  {
    emoji: "🌚",
    title: "Brain Ki Night Shift Shuru Hogi",
    body: "Raat ko dimaag khud se unresolved conversations replay karta hai. Diary likh aur uski overtime cancel kar.",
  },
  {
    emoji: "🦷",
    title: "Mental Hygiene Kahin Gayi?",
    body: "Raat ko daant saaf karta hai kyunki maintenance zaroori hai. Diary bhi wahi kaam karta hai — brain ke liye. Kar.",
  },
  {
    emoji: "🧯",
    title: "Kuch Abhi Bhi Jal Raha Hai",
    body: "Tu jaanta hai kya hai. Dopahar se ignore kar raha hai. Diary bujhayega. Raat ka takiya nahi.",
  },
  {
    emoji: "⚰️",
    title: "Andar Dafan Mat Kar",
    body: "Jo cheez andar dabaata hai woh kal bhari ho jaati hai. Diary woh weight le leti hai. Yahi uska kaam hai.",
  },
  {
    emoji: "🐍",
    title: "Kuch Lapeta Hua Hai Andar",
    body: "Woh low-key bad feeling jo poore din rahi? Uska naam nahi pata abhi. Diary mein likh aur naam de use.",
  },
  {
    emoji: "🌒",
    title: "Abhi Theek Lag Raha Hai — Jhooth Hai",
    body: "9 baje ki Diary sach bolti hai. 2 baje ki anxiety jhooth bolti hai. Tu decide kar kisse milna hai.",
  },
  {
    emoji: "🔩",
    title: "Kuch Loose Hai Andar",
    body: "Feel ho raha hai na? Kuch resolve nahi hua aaj. Kuch close nahi hua. Diary dhoondh leti hai woh screw. Likh.",
  },
  {
    emoji: "🫁",
    title: "Paper Pe Saans Le",
    body: "Poora din saans rok ke jeeta raha. Ab theek se exhale kar — Diary mein — jahan woh tujhe choke nahi kar sakta.",
  },
  {
    emoji: "🧠",
    title: "RAM Full Hai Teri",
    body: "Sab kuch abhi loaded aur garam hai. Neend aane se pehle dump kar disk pe. Diary likh. Properly shutdown kar.",
  },
  {
    emoji: "🎪",
    title: "Circus Ghar Aaya Hai Saath",
    body: "Office chhhoda par circus chest mein aa gaya. Wahan hi rehta hai jab tak diary mein nahi nikalta.",
  },
  {
    emoji: "🦴",
    title: "Haddi Haddi Thaka Hua Hai",
    body: "Pata hai. Lekin jo log diary likhke sote hain, woh better sote hain jo scroll karke numb hote hain. Proven.",
  },
  {
    emoji: "🧬",
    title: "Aaj Ne Thoda Badal Diya Tujhe",
    body: "Abhi nahi dikhega. Par kuch shift hua. Roz hota hai. Document kar before-version recover na ho sake tab tak.",
  },
  {
    emoji: "🪐",
    title: "Tu Akela Witness Hai",
    body: "Aaj tera version sirf tujhne dekha. Teri aankhon se. Teri feeling se. Diary nahi likhi toh woh perspective mar gaya.",
  },
  {
    emoji: "🕵️",
    title: "Evidence Disappear Ho Raha Hai",
    body: "Ek din tu jaanna chahega is saal kya actually hua tha. Sirf diary batayegi. Abhi likh tab tak sach garam hai.",
  },
  {
    emoji: "💾",
    title: "Unsaved Progress Warning",
    body: "Code auto-save. Files backup. Par khud ko? Aise hi corrupt hone dega aur lose kar dega aaj ko? Diary khol.",
  },
  {
    emoji: "🫗",
    title: "Tu Bahut Jagah Bic Gaya Hai Aaj",
    body: "Soch yahan, feelings wahan, energy khatam. Diary wapas container mein daalta hai sab. Likh.",
  },
  {
    emoji: "📍",
    title: "Aaj Ke Tu Ko Pin Kar",
    body: "Kal alag insaan hoga alag problems ke saath. Aaj ka version pin hone ka haqdar hai. Diary likh.",
  },
  {
    emoji: "🔋",
    title: "Sone Se Pehle Clear Kar",
    body: "Neend recharge nahi karti agar aaj abhi bhi background mein chal raha hai. Cache clear kar. Diary likh. Properly soo.",
  },
  {
    emoji: "🫧",
    title: "Bubble Pop Hone Wala Hai",
    body: "Sab rok ke rakha hua hai. Ek honest diary entry 6 suppressed conversations ki jagah le sakti hai. Likh.",
  },
  {
    emoji: "🌫️",
    title: "Fog Mein Hai Tu",
    body: "Saaf nahi dikh raha abhi. Normal hai. Diary batati hai fog mein actually kya hai. Likh aur dekh.",
  },
  {
    emoji: "🎬",
    title: "Tera Director's Cut Likha Nahi",
    body: "Duniya ne aaj jo version dekha woh theatrical release tha. Tera asli version — woh sirf diary mein jeeta hai.",
  },
  {
    emoji: "🌑",
    title: "Andheri Sochon Ko Jagah Chahiye",
    body: "Therapist ke paas nahi. Bas teri — apni. Diary woh jagah hai jahan worst thoughts bina nuksan ke reh sakti hain.",
  },
  {
    emoji: "🏁",
    title: "Aaj Ko Sahi Se Band Kar",
    body: "Browser tab minimize karne se close nahi hota. Same cheez. Diary khol. Likh. Aaj ko actually close kar.",
  },
  {
    emoji: "🧪",
    title: "Tu Khud Experiment Hai",
    body: "Teri life ongoing data hai. Har din ek data point hai. Aaj woh data point tha. Document kar before sample corrupt ho.",
  },
  {
    emoji: "🔮",
    title: "Future Tu Dhundhega Evidence",
    body: "6 mahine baad tu sochega is period mein itna off kyun tha. Diary ke bina? Zero evidence. Abhi likh.",
  },
  {
    emoji: "🌪️",
    title: "Sab Spin Ho Raha Hai Abhi Bhi",
    body: "Tu still hai, calm nahi. Fark hai. Diary batayegi kaun si soch teri hai aur kaun si sirf shor tha.",
  },
  {
    emoji: "🧿",
    title: "Aaj Ki Nazar Utaar",
    body: "Kuch toh aaj ka tha jo theek nahi laga. Unsettled. Unresolved. Diary mein nikal — nazar utarne jaisa hi kaam hai.",
  },
  {
    emoji: "🫥",
    title: "Aaj Fade Ho Raha Hai Real Time Mein",
    body: "Har minute thoda aur zyada ghundla ho raha hai aaj. Diary likh ya phir ek aur din zinda maar.",
  },
  {
    emoji: "👁️",
    title: "Kuch Dekh Raha Hai Tujhe Avoid Karte Hue",
    body: "Phone 4 baar dekh chuka. Har jagah gayi nazar. Bas diary nahi khuli. Kyun? Seriously — kyun?",
  },
  {
    emoji: "🔪",
    title: "Sach Katega — Par Theek Bhi Karega",
    body: "Diary mein likhna thoda uncomfortable hota hai. Chup rehna zyada uncomfortable hota hai raat ko. Choose kar.",
  },
  {
    emoji: "🧠",
    title: "Dimaag Ki Zip Fail Hogi",
    body: "Jo aaj press ho raha hai na — woh compress hota rehta hai. Ek din burst hoga. Diary regular decompress karta hai. Likh.",
  },
  {
    emoji: "🌘",
    title: "Andhere Mein Akele Mat Reh",
    body: "Diary se baat kar agar kisi aur se nahi kar sakta. Woh judge nahi karti. Bolta nahi. Sirf sunn-ti hai.",
  },
  {
    emoji: "🎭",
    title: "Natak Khatam Hua",
    body: "Poora din 'sab theek hai' ka role kiya. Curtain gir gaya. Diary woh jagah hai jahan character nahi rehte — sirf tu rehta hai.",
  },
  {
    emoji: "😶‍🌫️",
    title: "Dissociate Mat Kar, Likh",
    body: "Dekh raha hai par feel nahi kar raha? Screen scroll ho rahi hai par tu kahan hai? Diary ground karti hai. Try kar.",
  },
  {
    emoji: "⚠️",
    title: "Aaj Ka Kachra Kal Tak Mat Chhod",
    body: "Jo aaj unresolved tha woh kal compounded hoke aayega. Diary aaj ka kachra aaj niptaati hai. Mandatory hai ye.",
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
  toastId:       string;
  emoji:         string;
  title:         string;
  body:          string;
  spawnPathname: string; // pathname where the toast was created
  onWrite:       () => void;
  onDismiss:     () => void;
}

function DiaryToastRenderer({
  toastId, emoji, title, body, spawnPathname, onWrite, onDismiss,
}: ToastRendererProps) {

  // ── Auto-dismiss when user navigates away ──────────────────────────────
  const currentPathname = usePathname();

  useEffect(() => {
    // If the current pathname differs from where the toast was spawned,
    // dismiss immediately.
    if (currentPathname !== spawnPathname) {
      toast.dismiss(toastId);
    }
  }, [currentPathname, spawnPathname, toastId]);

  return (
    <>
      {/* ── Global keyframes ── */}
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
          position:      "relative",
          display:       "flex",
          flexDirection: "column",
          gap:           "12px",
          background:    "linear-gradient(145deg, #12102b 0%, #1a1535 40%, #0e1e45 100%)",
          border:        "1px solid rgba(140,124,255,0.38)",
          borderRadius:  "20px",
          padding:       "18px 20px 14px",
          minWidth:      "320px",
          maxWidth:      "380px",
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.04)",
            "0 12px 40px rgba(0,0,0,0.55)",
            "0 4px 16px rgba(124,110,243,0.28)",
            "inset 0 1px 0 rgba(255,255,255,0.07)",
          ].join(", "),
          animation: "hb-slide-in 0.55s cubic-bezier(0.34,1.26,0.64,1) both",
          overflow:  "hidden",
        }}
      >
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
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
              <Sparkles size={10} color="rgba(200,180,255,0.8)" />
              <span
                style={{
                  fontSize:             "10px",
                  fontWeight:           700,
                  color:                "rgba(190,170,255,0.85)",
                  letterSpacing:        "0.1em",
                  textTransform:        "uppercase",
                  background:           "linear-gradient(90deg, rgba(190,170,255,0.85), rgba(140,180,255,0.8), rgba(190,170,255,0.85))",
                  backgroundSize:       "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor:  "transparent",
                  animation:            "hb-badge-shine 3s linear infinite",
                }}
              >
                📔 Diary Reminder
              </span>
            </div>
            <p
              style={{
                margin:        0,
                fontSize:      "15px",
                fontWeight:    700,
                color:         "#edeaff",
                lineHeight:    1.25,
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

          <button
            className="hb-btn-later"
            onClick={onDismiss}
            style={{
              background:   "rgba(255,255,255,0.06)",
              border:       "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding:      "9px 16px",
              color:        "rgba(210,200,240,0.75)",
              fontSize:     "13px",
              fontWeight:   500,
              cursor:       "pointer",
              transition:   "all 0.22s ease",
              whiteSpace:   "nowrap",
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
  router:   ReturnType<typeof useRouter>,
  pathname: string   // pass usePathname() from the calling component
): void {
  const msg = getRandomMsg();

  toast.custom(
    (t) => (
      <DiaryToastRenderer
        toastId       = {t.id}
        emoji         = {msg.emoji}
        title         = {msg.title}
        body          = {msg.body}
        spawnPathname = {pathname}
        onWrite       = {() => {
          toast.dismiss(t.id);
          router.push("/dashboard/diary");
        }}
        onDismiss     = {() => toast.dismiss(t.id)}
      />
    ),
    {
      duration: 17000,
      position: "bottom-center",
      id:       "diary-reminder",
    }
  );
}