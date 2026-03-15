// app/api/quiz/hint/route.ts
// POST — records that a hint was used for a question in the active session
// This ensures hint XP penalty is preserved even if the user abandons the quiz

import { NextRequest, NextResponse }   from "next/server";
import { connectDB }                   from "@/app/lib/mongodb";
import { requireAuth }                 from "@/app/lib/authGuard";
import { UserLevelSession }            from "@/app/models/brain";
import { Question }                    from "@/app/models/brain/Question";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const { sessionId, questionId } = await req.json();

  if (!sessionId || !questionId) {
    return NextResponse.json(
      { success: false, message: "sessionId and questionId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId = auth.payload.userId;

  // Verify session belongs to this user
  const session = await UserLevelSession.findOne({
    _id:    sessionId,
    userId,
    status: "started",
  });

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Active session not found" },
      { status: 404 }
    );
  }

  // Fetch question to get the penalty value
  const question = await Question.findById(questionId)
    .select("hintXpPenalty hintText")
    .lean();

  if (!question) {
    return NextResponse.json(
      { success: false, message: "Question not found" },
      { status: 404 }
    );
  }

  // Store hint usage in the session answers map
  // Key format: "hint:{questionId}" → penalty value as string
  // This survives browser close — submit route reads it back
  const hintKey = `hint:${questionId}`;
  const existing = session.answers.get(hintKey);

  if (existing) {
    // Already recorded — idempotent
    return NextResponse.json({
      success:      true,
      alreadyUsed:  true,
      hintXpPenalty: Number(existing),
    });
  }

  session.answers.set(hintKey, String(question.hintXpPenalty ?? 0));
  await session.save();

  return NextResponse.json({
    success:       true,
    hintXpPenalty: question.hintXpPenalty ?? 0,
  });
}