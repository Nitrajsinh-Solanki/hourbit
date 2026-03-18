// app/api/quiz/subcategories/route.ts
// GET ?categoryId=xxx — returns subcategories with progress counts
//
// FIXES (performance):
//  - Replaced Promise.all(map(...)) N+1 pattern with 3 aggregation queries
//    Old: 1 + 2N DB round-trips for N subcategories
//    New: 3 DB round-trips total
//  - Returns categoryName so the frontend breadcrumb doesn't need an extra fetch
//  - Added Cache-Control header

import { NextRequest, NextResponse } from "next/server";
import { connectDB }                 from "@/app/lib/mongodb";
import { requireAuth }               from "@/app/lib/authGuard";
import { Category }                  from "@/app/models/brain/Category";
import { Subcategory }               from "@/app/models/brain/Subcategory";
import { Level, UserLevelProgress }  from "@/app/models/brain";
import mongoose                      from "mongoose";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    );
  }

  const categoryId = new URL(req.url).searchParams.get("categoryId");
  if (!categoryId) {
    return NextResponse.json(
      { success: false, message: "categoryId required" },
      { status: 400 }
    );
  }

  await connectDB();

  const userId      = new mongoose.Types.ObjectId(auth.payload.userId);
  const catObjectId = new mongoose.Types.ObjectId(categoryId);

  // 1. Category name (for breadcrumb)
  const category = await Category.findById(catObjectId).select("name").lean();

  // 2. All active subcategories in this category
  const subcategories = await Subcategory.find({
    categoryId: catObjectId,
    status:     "active",
  })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  if (subcategories.length === 0) {
    return NextResponse.json({
      success:       true,
      categoryName:  (category as any)?.name ?? "",
      subcategories: [],
    });
  }

  const subIds = subcategories.map(s => s._id);

  // 3. Total active levels per subcategory — one aggregation
  const levelCountAgg = await Level.aggregate([
    { $match: { subcategoryId: { $in: subIds }, status: "active" } },
    { $group: { _id: "$subcategoryId", count: { $sum: 1 } } },
  ]);
  const levelCountMap = new Map<string, number>(
    levelCountAgg.map(r => [String(r._id), r.count])
  );

  // 4. Completed levels for this user per subcategory — one aggregation
  const completedAgg = await UserLevelProgress.aggregate([
    {
      $match: {
        userId,
        subcategoryId: { $in: subIds },
        isCompleted:   true,
      },
    },
    { $group: { _id: "$subcategoryId", count: { $sum: 1 } } },
  ]);
  const completedMap = new Map<string, number>(
    completedAgg.map(r => [String(r._id), r.count])
  );

  const result = subcategories.map(sub => ({
    _id:            sub._id,
    name:           sub.name,
    description:    (sub as any).description || "",
    totalLevels:    levelCountMap.get(String(sub._id)) ?? 0,
    completedLevels: completedMap.get(String(sub._id)) ?? 0,
  }));

  return NextResponse.json(
    {
      success:       true,
      categoryName:  (category as any)?.name ?? "",
      subcategories: result,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    }
  );
}