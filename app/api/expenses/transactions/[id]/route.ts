// app/api/expenses/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Transaction from "@/app/models/Transaction";
import Wallet from "@/app/models/Wallet";
import { requireAuth } from "@/app/lib/authGuard";

// ─── GET: fetch single transaction ────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const { id } = await params;
    const userId = authResult.payload.userId;
    await connectDB();

    const transaction = await Transaction.findOne({ _id: id, userId }).lean();
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}

// ─── PATCH: edit a transaction (no rate limit) ────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const { id }   = await params;
    const userId   = authResult.payload.userId;
    const body     = await request.json();
    const { amount, paymentMethod, category, note, date } = body;

    await connectDB();

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // Reverse old wallet effect
    if (transaction.type === "add_money") {
      if (transaction.paymentMethod === "cash") wallet.cashBalance -= transaction.amount;
      else wallet.onlineBalance -= transaction.amount;
    } else {
      if (transaction.paymentMethod === "cash") wallet.cashBalance += transaction.amount;
      else wallet.onlineBalance += transaction.amount;
    }

    const newAmount = amount !== undefined ? parseFloat(amount) : transaction.amount;
    const newMethod = paymentMethod || transaction.paymentMethod;
    const newDate   = date ? new Date(date) : transaction.date;

    if (newAmount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (newDate > now) {
      return NextResponse.json({ error: "Cannot set future date" }, { status: 400 });
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);
    if (newDate < ninetyDaysAgo) {
      return NextResponse.json({ error: "Date cannot be older than 90 days" }, { status: 400 });
    }

    // Apply new wallet effect
    if (transaction.type === "add_money") {
      if (newMethod === "cash") wallet.cashBalance += newAmount;
      else wallet.onlineBalance += newAmount;
    } else {
      const available = newMethod === "cash" ? wallet.cashBalance : wallet.onlineBalance;
      if (available < newAmount) {
        return NextResponse.json(
          { error: `Insufficient ${newMethod} balance. Available: ₹${available}` },
          { status: 400 }
        );
      }
      if (newMethod === "cash") wallet.cashBalance -= newAmount;
      else wallet.onlineBalance -= newAmount;
    }

    transaction.amount       = newAmount;
    transaction.paymentMethod = newMethod;
    if (category !== undefined) transaction.category = category;
    if (note     !== undefined) transaction.note     = note;
    transaction.date         = newDate;

    await Promise.all([wallet.save(), transaction.save()]);

    return NextResponse.json({
      success: true,
      message: "Transaction updated",
      transaction,
      wallet: {
        cashBalance:   wallet.cashBalance,
        onlineBalance: wallet.onlineBalance,
        totalBalance:  wallet.cashBalance + wallet.onlineBalance,
      },
    });
  } catch (error: any) {
    console.error("Error editing transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

// ─── PUT: alias for PATCH ─────────────────────────────────────────────────────
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}

// ─── DELETE: delete a transaction (no rate limit) ─────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const { id } = await params;
    const userId = authResult.payload.userId;

    await connectDB();

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      if (transaction.type === "add_money") {
        if (transaction.paymentMethod === "cash") wallet.cashBalance -= transaction.amount;
        else wallet.onlineBalance -= transaction.amount;
      } else {
        if (transaction.paymentMethod === "cash") wallet.cashBalance += transaction.amount;
        else wallet.onlineBalance += transaction.amount;
      }
      wallet.cashBalance   = Math.max(0, wallet.cashBalance);
      wallet.onlineBalance = Math.max(0, wallet.onlineBalance);
      await wallet.save();
    }

    await transaction.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Transaction deleted",
      wallet: wallet
        ? {
            cashBalance:   wallet.cashBalance,
            onlineBalance: wallet.onlineBalance,
            totalBalance:  wallet.cashBalance + wallet.onlineBalance,
          }
        : null,
    });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}