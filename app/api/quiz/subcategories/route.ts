// app/api/quiz/subcategories/route.ts
// GET ?categoryId=xxx — returns subcategories with employee's progress

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import { requireAuth }               from "@/app/lib/authGuard";
import { Subcategory }               from "@/app/models/brain/Subcategory";
import { Level, UserLevelProgress }  from "@/app/models/brain";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const categoryId = new URL(req.url).searchParams.get("categoryId");
  if (!categoryId) {
    return NextResponse.json({ success: false, message: "categoryId required" }, { status: 400 });
  }

  await connectDB();

  const userId = auth.payload.userId;

  const subcategories = await Subcategory.find({ categoryId, status: "active" })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  const result = await Promise.all(
    subcategories.map(async (sub) => {
      const totalLevels = await Level.countDocuments({
        subcategoryId: sub._id,
        status:        "active",
      });

      const completedLevels = await UserLevelProgress.countDocuments({
        userId,
        subcategoryId: sub._id,
        isCompleted:   true,
      });

      return {
        _id:            sub._id,
        name:           sub.name,
        description:    (sub as any).description || "",
        totalLevels,
        completedLevels,
      };
    })
  );

  return NextResponse.json({ success: true, subcategories: result });
}