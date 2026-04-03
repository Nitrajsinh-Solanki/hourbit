// app/dashboard/expenses/_components/AnalysisTab.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface AnalysisData {
  summary: {
    totalSpent: number;
    totalAdded: number;
    biggestCategory: string;
    cashSpent: number;
    onlineSpent: number;
    averageDailySpend: number;
    expenseCount: number;
  };
  categoryBreakdown: { category: string; amount: number }[];
  paymentMethodBreakdown: { method: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
  insights: string[];
}

export default function AnalysisTab() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetchAnalysisData();
  }, [selectedMonth]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/expenses/analysis?month=${selectedMonth}`);
      const data = await res.json();

      if (data.success) {
        setAnalysisData(data);
      } else {
        toast.error("Failed to load analysis data");
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const getPercentage = (part: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm opacity-60">Loading analysis...</div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm opacity-60">No analysis data available</div>
      </div>
    );
  }

  const { summary, categoryBreakdown, paymentMethodBreakdown, monthlyTrend, insights } =
    analysisData;

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Expense Analysis</h2>
        <div>
          <label htmlFor="analysis-month" className="text-sm text-zinc-400 mr-2">
            Month:
          </label>
          <input
            id="analysis-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Total Spent</div>
          <div className="text-2xl font-semibold text-red-400">
            {formatCurrency(summary.totalSpent)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {summary.expenseCount} transaction{summary.expenseCount !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Total Added</div>
          <div className="text-2xl font-semibold text-green-400">
            {formatCurrency(summary.totalAdded)}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Top Category</div>
          <div className="text-xl font-semibold text-white truncate">
            {summary.biggestCategory}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Avg Daily Spend</div>
          <div className="text-2xl font-semibold text-white">
            {formatCurrency(summary.averageDailySpend)}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Cash Spent</div>
          <div className="text-xl font-semibold text-white">
            {formatCurrency(summary.cashSpent)}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-xs text-zinc-400 mb-1">Online Spent</div>
          <div className="text-xl font-semibold text-white">
            {formatCurrency(summary.onlineSpent)}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="font-semibold text-white mb-4">
            Category-wise Breakdown
          </h3>
          {categoryBreakdown.length === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No expenses this month
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.slice(0, 8).map((item) => {
                const percentage = getPercentage(item.amount, summary.totalSpent);
                return (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300">{item.category}</span>
                      <span className="text-white font-medium">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">{percentage}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Method Breakdown */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="font-semibold text-white mb-4">
            Cash vs Online Spending
          </h3>
          {summary.totalSpent === 0 ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              No expenses this month
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethodBreakdown.map((item) => {
                const percentage = getPercentage(item.amount, summary.totalSpent);
                return (
                  <div key={item.method} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-300">
                        {item.method}
                      </span>
                      <span className="text-sm text-zinc-400">{percentage}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.method === "Cash"
                              ? "bg-gradient-to-r from-orange-600 to-orange-400"
                              : "bg-gradient-to-r from-blue-600 to-blue-400"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white w-20 text-right">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
        <h3 className="font-semibold text-white mb-4">6-Month Spending Trend</h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {monthlyTrend.map((item) => {
            const maxAmount = Math.max(...monthlyTrend.map((d) => d.amount), 1);
            const height = (item.amount / maxAmount) * 100;
            return (
              <div key={item.month} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-end justify-center flex-1">
                  <div
                    className="w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t transition-all hover:from-violet-500 hover:to-violet-300"
                    style={{ height: `${height}%`, minHeight: item.amount > 0 ? "8px" : "0" }}
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-2 text-center">
                  {item.month}
                </div>
                <div className="text-xs text-zinc-400 font-medium">
                  {formatCurrency(item.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-6">
          <h3 className="font-semibold text-violet-100 mb-4">💡 Insights</h3>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2" />
                <p className="text-sm text-violet-200">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}