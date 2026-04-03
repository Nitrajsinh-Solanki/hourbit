// app/api/admin/users/[id]/expenses/route.ts
// Admin-only: view an employee's expense data

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/app/lib/mongodb";
import { Transaction } from "@/app/models/Transaction";
import { Wallet }      from "@/app/models/Wallet";
import User            from "@/app/models/User";
import { cookies }     from "next/headers";
import jwt             from "jsonwebtoken";
import mongoose        from "mongoose";

async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role:   string;
    };
    if (decoded.role !== "admin") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: "Invalid user ID" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(id).select("fullName email companyName").lean();
  if (!user) {
    return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const month  = searchParams.get("month");  // "YYYY-MM" or null = current month
  const pageN  = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limitN = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  let startDate: Date;
  let endDate: Date;

  if (month) {
    const [yr, mo] = month.split("-").map(Number);
    startDate = new Date(yr, mo - 1, 1);
    endDate   = new Date(yr, mo, 0, 23, 59, 59, 999);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Wallet balances
  const wallet = await Wallet.findOne({ userId: id }).lean();

  // Transactions for the month
  const allTxns = await Transaction.find({
    userId: id,
    date:   { $gte: startDate, $lte: endDate },
  })
    .sort({ date: -1 })
    .lean();

  const expenses    = allTxns.filter((t: any) => t.type === "expense");
  const moneyAdded  = allTxns.filter((t: any) => t.type === "add_money");

  const totalSpent  = expenses.reduce((s: number, t: any) => s + t.amount, 0);
  const totalAdded  = moneyAdded.reduce((s: number, t: any) => s + t.amount, 0);
  const cashSpent   = expenses.filter((t: any) => t.paymentMethod === "cash").reduce((s: number, t: any) => s + t.amount, 0);
  const onlineSpent = expenses.filter((t: any) => t.paymentMethod === "online").reduce((s: number, t: any) => s + t.amount, 0);

  // Category breakdown
  const catMap: Record<string, number> = {};
  for (const t of expenses) {
    const c = (t as any).category || "Uncategorized";
    catMap[c] = (catMap[c] || 0) + (t as any).amount;
  }
  const categoryBreakdown = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({ category, amount }));

  // Last 6 months trend
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(startDate.getFullYear(), startDate.getMonth() - i, 1);
    const mEnd   = new Date(startDate.getFullYear(), startDate.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const mExpenses = await Transaction.find({ userId: id, type: "expense", date: { $gte: mStart, $lte: mEnd } }).lean();
    monthlyTrend.push({
      month:  mStart.toLocaleString("en-US", { month: "short", year: "numeric" }),
      amount: mExpenses.reduce((s: number, t: any) => s + t.amount, 0),
    });
  }

  // Paginated transactions
  const total     = allTxns.length;
  const paginated = allTxns.slice((pageN - 1) * limitN, pageN * limitN);

  return NextResponse.json({
    success: true,
    user,
    wallet: wallet
      ? {
          cashBalance:   (wallet as any).cashBalance   ?? 0,
          onlineBalance: (wallet as any).onlineBalance ?? 0,
          totalBalance:  ((wallet as any).cashBalance ?? 0) + ((wallet as any).onlineBalance ?? 0),
        }
      : { cashBalance: 0, onlineBalance: 0, totalBalance: 0 },
    summary: {
      totalSpent,
      totalAdded,
      cashSpent,
      onlineSpent,
      expenseCount:   expenses.length,
      biggestCategory: categoryBreakdown[0]?.category || "None",
    },
    categoryBreakdown,
    monthlyTrend,
    transactions: paginated,
    pagination: {
      total,
      page:  pageN,
      limit: limitN,
      pages: Math.ceil(total / limitN),
    },
  });
}