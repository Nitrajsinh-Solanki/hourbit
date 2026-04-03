// app/api/expenses/transactions/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Transaction from "@/app/models/Transaction";
import Wallet from "@/app/models/Wallet";
import { requireAuth } from "@/app/lib/authGuard";
import { headers } from "next/headers";

// ─── Rate limit store (in-memory; swap for Redis in production) ───────────────
const rateLimitStore = new Map<string, { editCount: number; deleteCount: number; day: string }>();

const DAILY_EDIT_LIMIT = 20;
const DAILY_DELETE_LIMIT = 20;

function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function checkRateLimit(
  userId: string,
  action: "edit" | "delete",
  count = 1
): { allowed: boolean; remaining: number; limit: number } {
  const today = getTodayKey();
  const key = `${userId}:${today}`;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { editCount: 0, deleteCount: 0, day: today });
  }

  const entry = rateLimitStore.get(key)!;

  // Reset if day changed (shouldn't happen with key-per-day, but just in case)
  if (entry.day !== today) {
    entry.editCount = 0;
    entry.deleteCount = 0;
    entry.day = today;
  }

  const limit = action === "edit" ? DAILY_EDIT_LIMIT : DAILY_DELETE_LIMIT;
  const current = action === "edit" ? entry.editCount : entry.deleteCount;

  if (current + count > limit) {
    return { allowed: false, remaining: Math.max(0, limit - current), limit };
  }

  if (action === "edit") entry.editCount += count;
  else entry.deleteCount += count;

  return { allowed: true, remaining: limit - (current + count), limit };
}

// ─── GET: fetch single transaction ────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const userId = authResult.payload.userId;
    await connectDB();

    const transaction = await Transaction.findOne({ _id: params.id, userId }).lean();
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}

// ─── PATCH: edit a transaction ────────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const userId = authResult.payload.userId;

    // Rate limit check
    const rl = checkRateLimit(userId, "edit");
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Daily edit limit reached (${DAILY_EDIT_LIMIT}/day). Try again tomorrow.`,
          rateLimitExceeded: true,
          remaining: 0,
          limit: rl.limit,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { amount, paymentMethod, category, note, date } = body;

    await connectDB();

    const transaction = await Transaction.findOne({ _id: params.id, userId });
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

    // Validate new amount
    const newAmount = amount !== undefined ? parseFloat(amount) : transaction.amount;
    const newMethod = paymentMethod || transaction.paymentMethod;
    const newDate = date ? new Date(date) : transaction.date;

    if (newAmount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    // Validate date
    const now = new Date();
    if (newDate > now) {
      return NextResponse.json({ error: "Cannot set future date" }, { status: 400 });
    }
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (newDate < ninetyDaysAgo) {
      return NextResponse.json({ error: "Date cannot be older than 90 days" }, { status: 400 });
    }

    // Apply new wallet effect
    if (transaction.type === "add_money") {
      if (newMethod === "cash") wallet.cashBalance += newAmount;
      else wallet.onlineBalance += newAmount;
    } else {
      // Check sufficient balance
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

    // Update transaction
    transaction.amount = newAmount;
    transaction.paymentMethod = newMethod;
    if (category !== undefined) transaction.category = category;
    if (note !== undefined) transaction.note = note;
    transaction.date = newDate;

    await Promise.all([wallet.save(), transaction.save()]);

    return NextResponse.json({
      success: true,
      message: "Transaction updated",
      transaction,
      wallet: {
        cashBalance: wallet.cashBalance,
        onlineBalance: wallet.onlineBalance,
        totalBalance: wallet.cashBalance + wallet.onlineBalance,
      },
      rateLimitRemaining: rl.remaining,
    });
  } catch (error: any) {
    console.error("Error editing transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

// ─── DELETE: delete a transaction ─────────────────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth();
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.message }, { status: authResult.status });
    }

    const userId = authResult.payload.userId;

    // Rate limit check
    const rl = checkRateLimit(userId, "delete");
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Daily delete limit reached (${DAILY_DELETE_LIMIT}/day). Try again tomorrow.`,
          rateLimitExceeded: true,
          remaining: 0,
          limit: rl.limit,
        },
        { status: 429 }
      );
    }

    await connectDB();

    const transaction = await Transaction.findOne({ _id: params.id, userId });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Reverse wallet balance
    const wallet = await Wallet.findOne({ userId });
    if (wallet) {
      if (transaction.type === "add_money") {
        if (transaction.paymentMethod === "cash") wallet.cashBalance -= transaction.amount;
        else wallet.onlineBalance -= transaction.amount;
      } else {
        if (transaction.paymentMethod === "cash") wallet.cashBalance += transaction.amount;
        else wallet.onlineBalance += transaction.amount;
      }
      // Clamp to 0 (safety)
      wallet.cashBalance = Math.max(0, wallet.cashBalance);
      wallet.onlineBalance = Math.max(0, wallet.onlineBalance);
      await wallet.save();
    }

    await transaction.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Transaction deleted",
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
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}