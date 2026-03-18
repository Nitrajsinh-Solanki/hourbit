// app/api/quiz/session/route.ts
//
// POST — starts a new quiz attempt
// GET  — returns current active session for a level (resume support)
//
// SECURITY DESIGN:
//   hintText        → NOT sent to client (reveals hint for free before XP penalty)
//   hintXpPenalty   → SENT to client (not sensitive — just a number, shows cost on button)
//   correctOption   → NOT sent
//   acceptedAnswers → NOT sent

import { NextRequest, NextResponse }                    from "next/server";
import { connectDB }                                    from "@/app/lib/mongodb";
import { requireAuth }                                  from "@/app/lib/authGuard";
import { Level, UserLevelProgress, UserLevelSession }   from "@/app/models/brain";
import { Question }                                     from "@/app/models/brain/Question";
import mongoose                                         from "mongoose";

// ── GET — check if an active session exists ───────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const levelId = new URL(req.url).searchParams.get("levelId");
  if (!levelId) {
    return NextResponse.json({ success: false, message: "levelId required" }, { status: 400 });
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

  // Check timer expiry
  const level = await Level.findById(levelId).lean();
  if (level && level.timeLimitMinutes > 0) {
    const elapsedSecs = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    if (elapsedSecs >= level.timeLimitMinutes * 60) {
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

// ── POST — start a new quiz attempt ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const { levelId } = await req.json();
  if (!levelId) {
    return NextResponse.json({ success: false, message: "levelId required" }, { status: 400 });
  }

  await connectDB();
  const userId = auth.payload.userId;

  const level = await Level.findById(levelId).lean();
  if (!level || level.status !== "active") {
    return NextResponse.json({ success: false, message: "Level not found" }, { status: 404 });
  }

  let progress = await UserLevelProgress.findOne({ userId, levelId });

  // Check unlock position in subcategory
  const allLevels = await Level.find({
    subcategoryId: level.subcategoryId,
    status:        "active",
  })
    .sort({ displayOrder: 1, levelNumber: 1 })
    .select("_id")
    .lean();

  const levelIndex = allLevels.findIndex(l => String(l._id) === String(levelId));

  if (levelIndex > 0) {
    const prevLevelId  = allLevels[levelIndex - 1]._id;
    const prevProgress = await UserLevelProgress.findOne({ userId, levelId: prevLevelId }).lean();
    const isUnlocked   = prevProgress?.isCompleted || prevProgress?.isExhausted;
    if (!isUnlocked) {
      return NextResponse.json(
        { success: false, message: "This level is locked. Complete the previous level first." },
        { status: 403 }
      );
    }
  }

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

  // Abandon any stale sessions
  await UserLevelSession.updateMany(
    { userId, levelId, status: "started" },
    { $set: { status: "abandoned", abandonedAt: new Date() } }
  );

  // Create session — attempt counted immediately (anti-cheat)
  const session = await UserLevelSession.create({
    userId,
    levelId,
    status:    "started",
    startedAt: new Date(),
    answers:   {},
  });

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

  const isNowExhausted = progress.attemptsUsed >= level.maxAttempts && !progress.isCompleted;

  // ── Fetch questions ───────────────────────────────────────────────────────
  // SECURITY:
  //   hintText        → STRIPPED  (reading hint for free before penalty)
  //   correctOption   → STRIPPED  (answer cheat)
  //   acceptedAnswers → STRIPPED  (answer cheat)
  //   hintXpPenalty   → INCLUDED  (not sensitive — just a cost number shown on button)
  const questions = await Question.find({ levelId, status: "published" })
    .sort({ displayOrder: 1 })
    .select("_id questionType questionContent optionA optionB optionC optionD hintXpPenalty displayOrder")
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveCategoryId(subcategoryId: mongoose.Types.ObjectId | string) {
  const { Subcategory } = await import("@/app/models/brain/Subcategory");
  const sub = await Subcategory.findById(subcategoryId).select("categoryId").lean();
  return (sub as any)?.categoryId;
}

async function checkExhaustionUnlock(
  userId: string,
  prevLevelId: mongoose.Types.ObjectId
): Promise<boolean> {
  const prev = await UserLevelProgress.findOne({ userId, levelId: prevLevelId }).lean();
  return prev?.isExhausted === true && prev?.isCompleted !== true;
}