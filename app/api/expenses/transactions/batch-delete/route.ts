// app/api/expenses/transactions/batch-delete/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Transaction from "@/app/models/Transaction";
import Wallet from "@/app/models/Wallet";
import { requireAuth } from "@/app/lib/authGuard";

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const userId = authResult.payload.userId;
    const body   = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No transaction IDs provided" }, { status: 400 });
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Cannot delete more than 100 transactions at once" },
        { status: 400 }
      );
    }

    await connectDB();

    const transactions = await Transaction.find({ _id: { $in: ids }, userId });

    if (transactions.length === 0) {
      return NextResponse.json({ error: "No matching transactions found" }, { status: 404 });
    }

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
      wallet.cashBalance   = Math.max(0, wallet.cashBalance);
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
            cashBalance:   wallet.cashBalance,
            onlineBalance: wallet.onlineBalance,
            totalBalance:  wallet.cashBalance + wallet.onlineBalance,
          }
        : null,
    });
  } catch (error) {
    console.error("Batch delete error:", error);
    return NextResponse.json({ error: "Failed to delete transactions" }, { status: 500 });
  }
}