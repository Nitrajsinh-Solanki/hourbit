// app/api/quiz/session/route.ts
//
// POST — starts a new quiz attempt (creates UserLevelSession + bumps attemptsUsed)
// GET  — returns current active session for a level if one exists (resume support)
//
// SECURITY FIX:
//   hintText and hintXpPenalty are NO LONGER sent to the client in the questions
//   payload.  The client has no need for them until the user explicitly clicks
//   "Show Hint", at which point POST /api/quiz/hint returns those fields.
//   Sending them upfront let anyone inspect the network tab and read all hints
//   before clicking the button — defeating the XP-penalty system entirely.
//
//   Fields stripped from client payload:
//     - hintText        ← was visible in questions array
//     - hintXpPenalty   ← was visible in questions array
//     - correctOption   ← already stripped (kept)
//     - acceptedAnswers ← already stripped (kept)

import { NextRequest, NextResponse }                    from "next/server";
import { connectDB }                                    from "@/app/lib/mongodb";
import { requireAuth }                                  from "@/app/lib/authGuard";
import { Level, UserLevelProgress, UserLevelSession }   from "@/app/models/brain";
import { Question }                                     from "@/app/models/brain/Question";
import mongoose                                         from "mongoose";

// ── GET — check if an active session exists for this level ───────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const levelId = new URL(req.url).searchParams.get("levelId");
  if (!levelId) {
    return NextResponse.json(
      { success: false, message: "levelId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId = auth.payload.userId;

  const session = await UserLevelSession.findOne({
    userId,
    levelId,
    status: "started",
  })
    .sort({ startedAt: -1 })
    .lean();

  if (!session) {
    return NextResponse.json({ success: true, session: null });
  }

  // Check if the timer has expired for this session
  const level = await Level.findById(levelId).lean();
  if (level && level.timeLimitMinutes > 0) {
    const elapsedSecs = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    const limitSecs   = level.timeLimitMinutes * 60;
    if (elapsedSecs >= limitSecs) {
      await UserLevelSession.findByIdAndUpdate(session._id, {
        status:      "abandoned",
        abandonedAt: new Date(),
      });
      return NextResponse.json({ success: true, session: null });
    }
  }

  return NextResponse.json({
    success: true,
    session: {
      sessionId: session._id,
      startedAt: session.startedAt,
      answers:   Object.fromEntries(session.answers as Map<string, string>),
    },
  });
}

// ── POST — start a new quiz attempt ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { levelId } = await req.json();
  if (!levelId) {
    return NextResponse.json(
      { success: false, message: "levelId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId = auth.payload.userId;

  const level = await Level.findById(levelId).lean();
  if (!level || level.status !== "active") {
    return NextResponse.json(
      { success: false, message: "Level not found" },
      { status: 404 }
    );
  }

  let progress = await UserLevelProgress.findOne({ userId, levelId });

  // Check unlock — find this level's position in subcategory
  const allLevels = await Level.find({
    subcategoryId: level.subcategoryId,
    status:        "active",
  })
    .sort({ displayOrder: 1, levelNumber: 1 })
    .select("_id")
    .lean();

  const levelIndex = allLevels.findIndex(
    l => String(l._id) === String(levelId)
  );

  if (levelIndex > 0) {
    const prevLevelId  = allLevels[levelIndex - 1]._id;
    const prevProgress = await UserLevelProgress.findOne({
      userId,
      levelId: prevLevelId,
    }).lean();

    const isUnlocked = prevProgress?.isCompleted || prevProgress?.isExhausted;
    if (!isUnlocked) {
      return NextResponse.json(
        {
          success: false,
          message: "This level is locked. Complete the previous level first.",
        },
        { status: 403 }
      );
    }
  }

  // Check attempts / completion
  if (progress) {
    if (progress.attemptsUsed >= level.maxAttempts && !progress.isCompleted) {
      return NextResponse.json(
        { success: false, message: "No attempts remaining for this level." },
        { status: 403 }
      );
    }
    if (progress.isCompleted) {
      return NextResponse.json(
        { success: false, message: "You have already completed this level." },
        { status: 403 }
      );
    }
  }

  // Abandon any stale started session for this user+level
  await UserLevelSession.updateMany(
    { userId, levelId, status: "started" },
    { $set: { status: "abandoned", abandonedAt: new Date() } }
  );

  // Create new session — attempt counted immediately (anti-cheat)
  const session = await UserLevelSession.create({
    userId,
    levelId,
    status:    "started",
    startedAt: new Date(),
    answers:   {},
  });

  // Upsert progress doc — bump attemptsUsed
  if (!progress) {
    progress = await UserLevelProgress.create({
      userId,
      levelId,
      subcategoryId:         level.subcategoryId,
      categoryId:            await resolveCategoryId(level.subcategoryId),
      attemptsUsed:          1,
      isCompleted:           false,
      isExhausted:           false,
      unlockedViaExhaustion:
        levelIndex > 0
          ? await checkExhaustionUnlock(userId, allLevels[levelIndex - 1]._id)
          : false,
    });
  } else {
    progress.attemptsUsed += 1;
    await progress.save();
  }

  const isNowExhausted =
    progress.attemptsUsed >= level.maxAttempts && !progress.isCompleted;

  // ── SECURITY: Strip hint fields and correct-answer fields from client payload ──
  // hintText / hintXpPenalty are returned ONLY via POST /api/quiz/hint when the
  // user explicitly clicks "Show Hint".  Sending them here lets anyone read all
  // hints from the network tab before paying the XP penalty.
  const questions = await Question.find({
    levelId,
    status: "published",
  })
    .sort({ displayOrder: 1 })
    .select(
      // Explicitly list safe fields — do NOT include:
      //   correctOption   (answer cheat)
      //   acceptedAnswers (answer cheat)
      //   hintText        (hint cheat — NEW FIX)
      //   hintXpPenalty   (hint cheat — NEW FIX)
      "_id questionType questionContent optionA optionB optionC optionD displayOrder"
    )
    .lean();

  return NextResponse.json({
    success:           true,
    sessionId:         session._id,
    startedAt:         session.startedAt,
    attemptsUsed:      progress.attemptsUsed,
    attemptsRemaining: Math.max(0, level.maxAttempts - progress.attemptsUsed),
    isNowExhausted,
    level: {
      _id:                 level._id,
      levelNumber:         level.levelNumber,
      name:                (level as any).name ?? "",
      timeLimitMinutes:    level.timeLimitMinutes,
      xpReward:            level.xpReward,
      penaltyXpMultiplier: level.penaltyXpMultiplier,
      maxAttempts:         level.maxAttempts,
      questionCount:       level.questionCount,
    },
    questions,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveCategoryId(
  subcategoryId: mongoose.Types.ObjectId | string
) {
  const { Subcategory } = await import("@/app/models/brain/Subcategory");
  const sub = await Subcategory.findById(subcategoryId)
    .select("categoryId")
    .lean();
  return (sub as any)?.categoryId;
}

async function checkExhaustionUnlock(
  userId: string,
  prevLevelId: mongoose.Types.ObjectId
): Promise<boolean> {
  const prev = await UserLevelProgress.findOne({
    userId,
    levelId: prevLevelId,
  }).lean();
  return prev?.isExhausted === true && prev?.isCompleted !== true;
}