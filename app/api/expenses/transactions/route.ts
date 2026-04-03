// app/api/expenses/transactions/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Transaction from "@/app/models/Transaction";
import { requireAuth } from "@/app/lib/authGuard";

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.message },
        { status: authResult.status }
      );
    }

    const userId = authResult.payload.userId;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const type = searchParams.get("type");
    const paymentMethod = searchParams.get("paymentMethod");
    const category = searchParams.get("category");
    const month = searchParams.get("month");
    const search = searchParams.get("search");

    await connectDB();

    const query: any = { userId };

    if (type && ["add_money", "expense"].includes(type)) {
      query.type = type;
    }

    if (paymentMethod && ["cash", "online"].includes(paymentMethod)) {
      query.paymentMethod = paymentMethod;
    }

    if (category) {
      query.category = category;
    }

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    if (search) {
      query.$or = [
        { note: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}