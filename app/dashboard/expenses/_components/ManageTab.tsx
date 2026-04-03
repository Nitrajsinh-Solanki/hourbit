// app/dashboard/expenses/_components/ManageTab.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface Category {
  name: string;
  isCustom: boolean;
}

export default function ManageTab({ onUpdate }: { onUpdate: () => void }) {
  const [activeForm, setActiveForm] = useState<"money" | "expense" | "category">(
    "expense"
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Money Form State
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyPaymentMethod, setMoneyPaymentMethod] = useState<"cash" | "online">(
    "cash"
  );
  const [moneyNote, setMoneyNote] = useState("");
  const [moneyDate, setMoneyDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Add Expense Form State
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<
    "cash" | "online"
  >("cash");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseDate, setExpenseDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Custom Category State
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/expenses/categories");
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moneyAmount || parseFloat(moneyAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(moneyAmount),
          paymentMethod: moneyPaymentMethod,
          note: moneyNote,
          date: moneyDate,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setMoneyAmount("");
        setMoneyNote("");
        setMoneyDate(new Date().toISOString().split("T")[0]);
        onUpdate();
      } else {
        toast.error(data.error || "Failed to add money");
      }
    } catch (error) {
      console.error("Error adding money:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expenseCategory) {
      toast.error("Please select a category");
      return;
    }

    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expenseCategory,
          amount: parseFloat(expenseAmount),
          paymentMethod: expensePaymentMethod,
          note: expenseNote,
          date: expenseDate,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setExpenseCategory("");
        setExpenseAmount("");
        setExpenseNote("");
        setExpenseDate(new Date().toISOString().split("T")[0]);
        onUpdate();
      } else {
        toast.error(data.error || "Failed to add expense");
      }
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setNewCategoryName("");
        fetchCategories();
      } else {
        toast.error(data.error || "Failed to add category");
      }
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getMaxDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const getMinDate = () => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return ninetyDaysAgo.toISOString().split("T")[0];
  };

  return (
    <div className="space-y-6">
      {/* Form Selector */}
      <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800 w-fit">
        <button
          onClick={() => setActiveForm("expense")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeForm === "expense"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Add Expense
        </button>
        <button
          onClick={() => setActiveForm("money")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeForm === "money"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Add Money
        </button>
        <button
          onClick={() => setActiveForm("category")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeForm === "category"
              ? "bg-violet-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Manage Categories
        </button>
      </div>

      {/* Add Expense Form */}
      {activeForm === "expense" && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Add Expense</h3>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Amount <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Payment Method <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setExpensePaymentMethod("cash")}
                  className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                    expensePaymentMethod === "cash"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setExpensePaymentMethod("online")}
                  className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                    expensePaymentMethod === "online"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Online
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                max={getMaxDate()}
                min={getMinDate()}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Note (Optional)
              </label>
              <textarea
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Add a note..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Adding..." : "Add Expense"}
            </button>
          </form>
        </div>
      )}

      {/* Add Money Form */}
      {activeForm === "money" && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Add Money</h3>
          <form onSubmit={handleAddMoney} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Amount <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={moneyAmount}
                onChange={(e) => setMoneyAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Wallet Type <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMoneyPaymentMethod("cash")}
                  className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                    moneyPaymentMethod === "cash"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setMoneyPaymentMethod("online")}
                  className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                    moneyPaymentMethod === "online"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  Online
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={moneyDate}
                onChange={(e) => setMoneyDate(e.target.value)}
                max={getMaxDate()}
                min={getMinDate()}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Note (Optional)
              </label>
              <textarea
                value={moneyNote}
                onChange={(e) => setMoneyNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Add a note..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Adding..." : "Add Money"}
            </button>
          </form>
        </div>
      )}

      {/* Manage Categories */}
      {activeForm === "category" && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            Manage Categories
          </h3>

          <form onSubmit={handleAddCategory} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Add Custom Category
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  maxLength={50}
                  placeholder="Enter category name"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </form>

          <div>
            <div className="text-sm font-medium text-zinc-400 mb-3">
              All Categories ({categories.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-300"
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}