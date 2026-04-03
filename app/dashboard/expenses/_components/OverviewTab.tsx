// app/dashboard/expenses/_components/OverviewTab.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface Wallet {
  cashBalance: number;
  onlineBalance: number;
  totalBalance: number;
}

interface Transaction {
  _id: string;
  type: "add_money" | "expense";
  amount: number;
  paymentMethod: "cash" | "online";
  category?: string;
  note?: string;
  date: string;
  createdAt: string;
}

export default function OverviewTab({
  onAddExpenseClick,
}: {
  onAddExpenseClick: () => void;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetchOverviewData();
  }, [selectedMonth]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      // Fetch wallet
      const walletRes = await fetch("/api/expenses/wallet");
      const walletData = await walletRes.json();

      if (walletData.success) {
        setWallet(walletData.wallet);
      }

      // Fetch recent transactions for selected month
      const transactionsRes = await fetch(
        `/api/expenses/transactions?month=${selectedMonth}&limit=10`
      );
      const transactionsData = await transactionsRes.json();

      if (transactionsData.success) {
        setRecentTransactions(transactionsData.transactions);
      }
    } catch (error) {
      console.error("Error fetching overview data:", error);
      toast.error("Failed to load overview data");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm opacity-60">Loading overview...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="text-sm text-zinc-400 mb-2">Cash Balance</div>
          <div className="text-2xl font-semibold text-white">
            {formatCurrency(wallet?.cashBalance || 0)}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="text-sm text-zinc-400 mb-2">Online Balance</div>
          <div className="text-2xl font-semibold text-white">
            {formatCurrency(wallet?.onlineBalance || 0)}
          </div>
        </div>

        <div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-6">
          <div className="text-sm text-violet-300 mb-2">Total Balance</div>
          <div className="text-2xl font-semibold text-violet-100">
            {formatCurrency(wallet?.totalBalance || 0)}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-zinc-400">
            <label htmlFor="month-selector" className="mr-2">
              Month:
            </label>
            <input
              id="month-selector"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <button
          onClick={onAddExpenseClick}
          className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          + Add Expense
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h3 className="font-semibold text-white">Recent Transactions</h3>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-zinc-500 text-sm">
              No transactions for this month yet
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction._id}
                className="px-6 py-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {transaction.type === "expense" ? (
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                    <span className="font-medium text-white">
                      {transaction.type === "expense"
                        ? transaction.category
                        : "Money Added"}
                    </span>
                    <span className="text-xs text-zinc-500 uppercase">
                      {transaction.paymentMethod}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 pl-5">
                    {transaction.note && (
                      <div className="mb-1">{transaction.note}</div>
                    )}
                    <div>{formatDate(transaction.date)}</div>
                  </div>
                </div>

                <div
                  className={`text-lg font-semibold ${
                    transaction.type === "expense"
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {transaction.type === "expense" ? "-" : "+"}
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}