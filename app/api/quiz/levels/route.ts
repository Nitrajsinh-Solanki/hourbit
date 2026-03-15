// app/api/quiz/levels/route.ts
// GET ?subcategoryId=xxx — returns all levels with unlock status and attempts

import { NextRequest, NextResponse }          from "next/server";
import { connectDB }                          from "@/app/lib/mongodb";
import { requireAuth }                        from "@/app/lib/authGuard";
import { Level, UserLevelProgress }           from "@/app/models/brain";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const subcategoryId = new URL(req.url).searchParams.get("subcategoryId");
  if (!subcategoryId) {
    return NextResponse.json({ success: false, message: "subcategoryId required" }, { status: 400 });
  }

  await connectDB();

  const userId = auth.payload.userId;

  const levels = await Level.find({ subcategoryId, status: "active" })
    .sort({ displayOrder: 1, levelNumber: 1 })
    .lean();

  // Fetch all progress docs for this user in one query
  const levelIds    = levels.map(l => l._id);
  const progressDocs = await UserLevelProgress.find({
    userId,
    levelId: { $in: levelIds },
  }).lean();

  const progressMap = new Map(
    progressDocs.map(p => [String(p.levelId), p])
  );

  const result = levels.map((level, idx) => {
    const progress = progressMap.get(String(level._id));
    const prevLevel = idx > 0 ? levels[idx - 1] : null;
    const prevProgress = prevLevel
      ? progressMap.get(String(prevLevel._id))
      : null;

    // Unlock rules:
    // Level 1 (first level) → always unlocked
    // Level N → unlocked if previous level isCompleted OR isExhausted
    let isUnlocked = idx === 0;
    if (!isUnlocked && prevProgress) {
      isUnlocked = prevProgress.isCompleted || prevProgress.isExhausted;
    }

    const attemptsUsed      = progress?.attemptsUsed ?? 0;
    const attemptsRemaining = Math.max(0, level.maxAttempts - attemptsUsed);
    const isCompleted       = progress?.isCompleted ?? false;
    const isExhausted       = progress?.isExhausted ?? false;

    return {
      _id:                  level._id,
      levelNumber:          level.levelNumber,
      name:                 level.name,
      difficulty:           level.difficulty,
      xpReward:             level.xpReward,
      penaltyXpMultiplier:  level.penaltyXpMultiplier,
      maxAttempts:          level.maxAttempts,
      attemptsUsed,
      attemptsRemaining,
      questionCount:        level.questionCount,
      timeLimitMinutes:     level.timeLimitMinutes,
      isUnlocked,
      isCompleted,
      isExhausted,
      earnedXp:             progress?.earnedXp ?? 0,
      bestScore:            progress?.bestScore ?? 0,
      unlockedViaExhaustion:progress?.unlockedViaExhaustion ?? false,
    };
  });

  return NextResponse.json({ success: true, levels: result });
}