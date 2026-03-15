// app/api/quiz/categories/route.ts
// GET — returns all active categories with employee's progress counts

import { NextResponse }   from "next/server";
import { connectDB }      from "@/app/lib/mongodb";
import { requireAuth }    from "@/app/lib/authGuard";
import { Category }       from "@/app/models/brain/Category";
import { Subcategory }    from "@/app/models/brain/Subcategory";
import { Level, UserLevelProgress } from "@/app/models/brain";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  await connectDB();

  const userId = auth.payload.userId;

  // Fetch all active categories
  const categories = await Category.find({ status: "active" })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  // For each category, count subcategories and levels
  const result = await Promise.all(
    categories.map(async (cat) => {
      const subcategoryIds = await Subcategory.find({ categoryId: cat._id, status: "active" })
        .select("_id")
        .lean()
        .then(subs => subs.map(s => s._id));

      const totalLevels = await Level.countDocuments({
        subcategoryId: { $in: subcategoryIds },
        status: "active",
      });

      const completedLevels = await UserLevelProgress.countDocuments({
        userId,
        categoryId: cat._id,
        isCompleted: true,
      });

      return {
        _id:              cat._id,
        name:             cat.name,
        description:      (cat as any).description || "",
        subcategoryCount: subcategoryIds.length,
        totalLevels,
        completedLevels,
      };
    })
  );

  return NextResponse.json({ success: true, categories: result });
}