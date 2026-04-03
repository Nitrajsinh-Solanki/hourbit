//app/api/expenses/analysis/route.ts
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
    const month = searchParams.get("month");

    await connectDB();

    let startDate: Date;
    let endDate: Date;

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const expenses = transactions.filter((t) => t.type === "expense");
    const moneyAdded = transactions.filter((t) => t.type === "add_money");

    const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
    const totalAdded = moneyAdded.reduce((sum, t) => sum + t.amount, 0);

    const cashSpent = expenses
      .filter((t) => t.paymentMethod === "cash")
      .reduce((sum, t) => sum + t.amount, 0);

    const onlineSpent = expenses
      .filter((t) => t.paymentMethod === "online")
      .reduce((sum, t) => sum + t.amount, 0);

    const categoryBreakdown: { [key: string]: number } = {};
    expenses.forEach((t) => {
      const cat = t.category || "Uncategorized";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + t.amount;
    });

    const sortedCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({ category, amount }));

    const biggestCategory = sortedCategories[0]?.category || "None";

    const dailySpending: { [key: string]: number } = {};
    expenses.forEach((t) => {
      const day = new Date(t.date).getDate();
      dailySpending[day] = (dailySpending[day] || 0) + t.amount;
    });

    const highestSpendingDay = Object.entries(dailySpending)
      .sort(([, a], [, b]) => b - a)
      .map(([day]) => parseInt(day))[0];

    const daysInMonth = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0
    ).getDate();
    const averageDailySpend = totalSpent / daysInMonth;

    const prevMonthStart = new Date(
      startDate.getFullYear(),
      startDate.getMonth() - 1,
      1
    );
    const prevMonthEnd = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    const prevMonthExpenses = await Transaction.find({
      userId,
      type: "expense",
      date: { $gte: prevMonthStart, $lte: prevMonthEnd },
    }).lean();

    const prevMonthTotal = prevMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

    const insights: string[] = [];

    if (biggestCategory !== "None") {
      insights.push(`You spent most on ${biggestCategory} this month.`);
    }

    if (onlineSpent > cashSpent) {
      insights.push("Online spending is higher than cash spending.");
    } else if (cashSpent > onlineSpent) {
      insights.push("Cash spending is higher than online spending.");
    }

    if (highestSpendingDay) {
      insights.push(`Your highest spending day was ${highestSpendingDay}th.`);
    }

    if (prevMonthTotal > 0) {
      if (totalSpent > prevMonthTotal) {
        const increase = ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100;
        insights.push(
          `You spent ${increase.toFixed(1)}% more this month than last month.`
        );
      } else if (totalSpent < prevMonthTotal) {
        const decrease = ((prevMonthTotal - totalSpent) / prevMonthTotal) * 100;
        insights.push(
          `You spent ${decrease.toFixed(1)}% less this month than last month.`
        );
      }
    }

    if (expenses.length === 0) {
      insights.push("No expenses recorded this month yet.");
    }

    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth() - i,
        1
      );
      const monthEnd = new Date(
        startDate.getFullYear(),
        startDate.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999
      );

      const monthExpenses = await Transaction.find({
        userId,
        type: "expense",
        date: { $gte: monthStart, $lte: monthEnd },
      }).lean();

      const total = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

      monthlyTrend.push({
        month: monthStart.toLocaleString("en-US", { month: "short", year: "numeric" }),
        amount: total,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalSpent,
        totalAdded,
        biggestCategory,
        cashSpent,
        onlineSpent,
        averageDailySpend,
        expenseCount: expenses.length,
      },
      categoryBreakdown: sortedCategories,
      paymentMethodBreakdown: [
        { method: "Cash", amount: cashSpent },
        { method: "Online", amount: onlineSpent },
      ],
      monthlyTrend,
      insights,
    });
  } catch (error: any) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis data" },
      { status: 500 }
    );
  }
}