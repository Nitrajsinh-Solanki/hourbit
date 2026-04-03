// app/expenses/add-expense/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Wallet from "@/app/models/Wallet";
import Transaction from "@/app/models/Transaction";
import { requireAuth } from "@/app/lib/authGuard";

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
    const { amount, paymentMethod, category, note, date } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (!paymentMethod || !["cash", "online"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    const transactionDate = new Date(date);
    const now = new Date();
    if (transactionDate > now) {
      return NextResponse.json(
        { error: "Cannot add expense for future dates" },
        { status: 400 }
      );
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (transactionDate < ninetyDaysAgo) {
      return NextResponse.json(
        { error: "Cannot add expense for dates older than 90 days" },
        { status: 400 }
      );
    }

    await connectDB();

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        cashBalance: 0,
        onlineBalance: 0,
      });
    }

    const currentBalance =
      paymentMethod === "cash" ? wallet.cashBalance : wallet.onlineBalance;

    if (currentBalance < amount) {
      return NextResponse.json(
        {
          error: `Insufficient ${paymentMethod} balance. Available: ₹${currentBalance}`,
        },
        { status: 400 }
      );
    }

    if (paymentMethod === "cash") {
      wallet.cashBalance -= amount;
    } else {
      wallet.onlineBalance -= amount;
    }
    await wallet.save();

    const transaction = await Transaction.create({
      userId,
      type: "expense",
      amount,
      paymentMethod,
      category,
      note: note || "",
      date: transactionDate,
    });

    return NextResponse.json({
      success: true,
      message: "Expense added successfully",
      transaction,
      wallet: {
        cashBalance: wallet.cashBalance,
        onlineBalance: wallet.onlineBalance,
        totalBalance: wallet.cashBalance + wallet.onlineBalance,
      },
    });
  } catch (error: any) {
    console.error("Error adding expense:", error);
    return NextResponse.json(
      { error: "Failed to add expense" },
      { status: 500 }
    );
  }
}