// app/api/expenses/transactions/batch-delete/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Transaction from "@/app/models/Transaction";
import Wallet from "@/app/models/Wallet";
import { requireAuth } from "@/app/lib/authGuard";

const rateLimitStore = new Map<string, { deleteCount: number; day: string }>();
const DAILY_DELETE_LIMIT = 20;

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function checkBatchRateLimit(
  userId: string,
  count: number
): { allowed: boolean; remaining: number; limit: number } {
  const today = getTodayKey();
  const key = `${userId}:${today}:delete`;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { deleteCount: 0, day: today });
  }

  const entry = rateLimitStore.get(key)!;
  if (entry.day !== today) {
    entry.deleteCount = 0;
    entry.day = today;
  }

  const current = entry.deleteCount;

  if (current + count > DAILY_DELETE_LIMIT) {
    return { allowed: false, remaining: Math.max(0, DAILY_DELETE_LIMIT - current), limit: DAILY_DELETE_LIMIT };
  }

  entry.deleteCount += count;
  return { allowed: true, remaining: DAILY_DELETE_LIMIT - (current + count), limit: DAILY_DELETE_LIMIT };
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const userId = authResult.payload.userId;
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No transaction IDs provided" }, { status: 400 });
    }

    if (ids.length > 20) {
      return NextResponse.json({ error: "Cannot delete more than 20 transactions at once" }, { status: 400 });
    }

    // Rate limit check
    const rl = checkBatchRateLimit(userId, ids.length);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Daily delete limit (${DAILY_DELETE_LIMIT}) would be exceeded. You can delete ${rl.remaining} more today.`,
          rateLimitExceeded: true,
          remaining: rl.remaining,
          limit: rl.limit,
        },
        { status: 429 }
      );
    }

    await connectDB();

    // Fetch all transactions to verify ownership
    const transactions = await Transaction.find({ _id: { $in: ids }, userId });

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No matching transactions found" }, { status: 404 });
    }

    // Reverse wallet effects
    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      for (const txn of transactions) {
        if (txn.type === "add_money") {
          if (txn.paymentMethod === "cash") wallet.cashBalance -= txn.amount;
          else wallet.onlineBalance -= txn.amount;
        } else {
          if (txn.paymentMethod === "cash") wallet.cashBalance += txn.amount;
          else wallet.onlineBalance += txn.amount;
        }
      }
      wallet.cashBalance = Math.max(0, wallet.cashBalance);
      wallet.onlineBalance = Math.max(0, wallet.onlineBalance);
      await wallet.save();
    }

    await Transaction.deleteMany({ _id: { $in: ids }, userId });

    return NextResponse.json({
      success: true,
      message: `${transactions.length} transaction${transactions.length > 1 ? "s" : ""} deleted`,
      deletedCount: transactions.length,
      wallet: wallet
        ? {
            cashBalance: wallet.cashBalance,
            onlineBalance: wallet.onlineBalance,
            totalBalance: wallet.cashBalance + wallet.onlineBalance,
          }
        : null,
      rateLimitRemaining: rl.remaining,
    });
  } catch (error) {
    console.error("Batch delete error:", error);
    return NextResponse.json({ error: "Failed to delete transactions" }, { status: 500 });
  }
}