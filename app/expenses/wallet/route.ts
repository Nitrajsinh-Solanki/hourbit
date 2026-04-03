// app/expenses/wallet/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import Wallet from "@/app/models/Wallet";
import { requireAuth } from "@/app/lib/authGuard";

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

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        cashBalance: 0,
        onlineBalance: 0,
      });
    }

    return NextResponse.json({
      success: true,
      wallet: {
        cashBalance: wallet.cashBalance,
        onlineBalance: wallet.onlineBalance,
        totalBalance: wallet.cashBalance + wallet.onlineBalance,
      },
    });
  } catch (error: any) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet data" },
      { status: 500 }
    );
  }
}