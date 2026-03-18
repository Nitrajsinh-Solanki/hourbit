// app/api/quiz/categories/route.ts
// GET — returns all active categories with progress counts
//
// FIXES (performance):
//  - Replaced N Promise.all(map(...)) with 2 aggregation pipelines
//    Old code: 1 + 3N DB round-trips for N categories
//    New code: 4 DB round-trips total regardless of category count
//  - Added Cache-Control header (60 s private cache)

import { NextResponse }   from "next/server";
import { connectDB }      from "@/app/lib/mongodb";
import { requireAuth }    from "@/app/lib/authGuard";
import { Category }       from "@/app/models/brain/Category";
import { Subcategory }    from "@/app/models/brain/Subcategory";
import { Level, UserLevelProgress } from "@/app/models/brain";
import mongoose from "mongoose";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  await connectDB();

  const userId = new mongoose.Types.ObjectId(auth.payload.userId);

  // 1. All active categories
  const categories = await Category.find({ status: "active" })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  if (categories.length === 0) {
    return NextResponse.json({ success: true, categories: [] });
  }

  const categoryIds = categories.map(c => c._id);

  // 2. Subcategory counts per category — one query
  const subCountAgg = await Subcategory.aggregate([
    { $match: { categoryId: { $in: categoryIds }, status: "active" } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const subCountMap = new Map<string, number>(
    subCountAgg.map(r => [String(r._id), r.count])
  );

  // 3. All active subcategory IDs (needed to count levels per category)
  const allSubcategories = await Subcategory.find({
    categoryId: { $in: categoryIds },
    status:     "active",
  })
    .select("_id categoryId")
    .lean();

  // Build categoryId → subcategoryId[] map
  const catToSubs = new Map<string, mongoose.Types.ObjectId[]>();
  for (const sub of allSubcategories) {
    const key = String((sub as any).categoryId);
    if (!catToSubs.has(key)) catToSubs.set(key, []);
    catToSubs.get(key)!.push(sub._id as mongoose.Types.ObjectId);
  }

  const allSubIds = allSubcategories.map(s => s._id);

  // 4. Total active levels per category — one query
  const levelCountAgg = await Level.aggregate([
    { $match: { subcategoryId: { $in: allSubIds }, status: "active" } },
    {
      $lookup: {
        from:         "subcategories",
        localField:   "subcategoryId",
        foreignField: "_id",
        as:           "sub",
      },
    },
    { $unwind: "$sub" },
    { $group: { _id: "$sub.categoryId", count: { $sum: 1 } } },
  ]);
  const levelCountMap = new Map<string, number>(
    levelCountAgg.map(r => [String(r._id), r.count])
  );

  // 5. Completed levels per category for this user — one query
  const completedAgg = await UserLevelProgress.aggregate([
    {
      $match: {
        userId,
        categoryId: { $in: categoryIds },
        isCompleted: true,
      },
    },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const completedMap = new Map<string, number>(
    completedAgg.map(r => [String(r._id), r.count])
  );

  const result = categories.map(cat => ({
    _id:              cat._id,
    name:             cat.name,
    description:      (cat as any).description || "",
    subcategoryCount: subCountMap.get(String(cat._id))  ?? 0,
    totalLevels:      levelCountMap.get(String(cat._id)) ?? 0,
    completedLevels:  completedMap.get(String(cat._id))  ?? 0,
  }));

  return NextResponse.json(
    { success: true, categories: result },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    }
  );
}