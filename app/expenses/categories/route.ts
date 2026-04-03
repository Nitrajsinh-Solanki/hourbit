// app/expenses/categories/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import ExpenseCategory from "@/app/models/ExpenseCategory";
import { requireAuth } from "@/app/lib/authGuard";

const DEFAULT_CATEGORIES = [
  "Food",
  "Travel",
  "Petrol",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Rent",
  "Recharge",
  "Groceries",
  "Miscellaneous",
];

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.payload.userId;
    await connectDB();

    const customCategories = await ExpenseCategory.find({ userId })
      .sort({ name: 1 })
      .lean();

    const customCategoryNames = customCategories.map((cat) => cat.name);
    const allCategories = [...DEFAULT_CATEGORIES, ...customCategoryNames];

    return NextResponse.json({
      success: true,
      categories: allCategories,
      defaultCategories: DEFAULT_CATEGORIES,
      customCategories: customCategoryNames,
    });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.payload.userId;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Category name must be less than 50 characters" },
        { status: 400 }
      );
    }

    const isDefaultCategory = DEFAULT_CATEGORIES.some(
      (cat) => cat.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDefaultCategory) {
      return NextResponse.json(
        { error: "This category already exists as a default category" },
        { status: 400 }
      );
    }

    await connectDB();

    try {
      const category = await ExpenseCategory.create({
        userId,
        name: trimmedName,
      });

      return NextResponse.json({
        success: true,
        message: "Category created successfully",
        category: category.name,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        return NextResponse.json(
          { error: "This category already exists" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}