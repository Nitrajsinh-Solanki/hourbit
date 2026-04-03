"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Banknote,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  Lightbulb,
  Tag,
  CalendarDays,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletData {
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

interface AnalysisSummary {
  totalSpent: number;
  totalAdded: number;
  biggestCategory: string;
  cashSpent: number;
  onlineSpent: number;
  averageDailySpend: number;
  expenseCount: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
}

interface MonthlyTrend {
  month: string;
  amount: number;
}

interface AnalysisData {
  summary: AnalysisSummary;
  categoryBreakdown: CategoryBreakdown[];
  paymentMethodBreakdown: { method: string; amount: number }[];
  monthlyTrend: MonthlyTrend[];
  insights: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const todayStr = () => new Date().toISOString().split("T")[0];

const monthStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const CATEGORY_COLORS = [
  "#7c6ef3", "#5bb8f5", "#f5a623", "#50e3a4",
  "#ff6b6b", "#ffd166", "#06d6a0", "#ef476f",
  "#118ab2", "#ffd60a", "#c77dff", "#48cae4",
];

const DEFAULT_CATEGORIES = [
  "Food", "Travel", "Petrol", "Shopping", "Bills",
  "Health", "Entertainment", "Rent", "Recharge", "Groceries", "Miscellaneous",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--text2)" }}>
          {label}
        </span>
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, color }}
        >
          <Icon size={16} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          ₹{value}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text2)", border: "1px solid var(--border2)" }}
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--text2)" }}>
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border2)",
          color: "var(--text)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border2)";
          props.onBlur?.(e);
        }}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const openPicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    // Native date picker support in modern browsers
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--text2)" }}>
        {label}
      </label>

      <div className="relative">
        <input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          ref={(el) => {
            // no-op, just allows openPicker target via wrapper click if needed later
          }}
          className="w-full rounded-xl px-3 py-2.5 pr-11 text-sm outline-none transition-all appearance-none cursor-pointer"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border2)",
            color: "var(--text)",
            colorScheme: "dark light",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border2)";
          }}
          onClick={(e) => {
            const input = e.currentTarget;
            if (typeof input.showPicker === "function") {
              input.showPicker();
            }
          }}
        />

        <button
          type="button"
          onClick={(e) => {
            const input = e.currentTarget
              .parentElement
              ?.querySelector("input[type='date']") as HTMLInputElement | null;
            openPicker(input);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{ color: "var(--text3)" }}
          tabIndex={-1}
        >
          <CalendarDays size={16} />
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--text2)" }}>
        {label}
      </label>
      <select
        {...props}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border2)",
          color: "var(--text)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActionBtn({
  children,
  loading,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
      style={
        variant === "primary"
          ? { background: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }
          : {
              background: "transparent",
              color: "var(--text2)",
              border: "1px solid var(--border2)",
            }
      }
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─── Add Money Modal ──────────────────────────────────────────────────────────

function AddMoneyModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (wallet: WalletData) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount(""); setMethod("cash"); setNote(""); setDate(todayStr()); setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setLoading(true);
    try {
      const res = await fetch("/expenses/add-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method, note, date }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to add money.");
      onSuccess(data.wallet);
      handleClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Money to Wallet">
      <div className="flex flex-col gap-4">
        <InputField
          label="Amount (₹)"
          type="number"
          min="1"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <SelectField
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: "cash", label: "💵 Cash" },
            { value: "online", label: "💳 Online" },
          ]}
        />
       <DateField
  label="Date"
  value={date}
  max={todayStr()}
  min={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
  onChange={setDate}
/>
        <InputField
          label="Note (optional)"
          type="text"
          placeholder="e.g. Salary, Freelance..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#ff6b6b18", color: "#ff6b6b" }}>
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <ActionBtn variant="ghost" onClick={handleClose}>Cancel</ActionBtn>
          <ActionBtn loading={loading} onClick={submit}>Add Money</ActionBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({
  open,
  onClose,
  onSuccess,
  categories,
  wallet,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (wallet: WalletData) => void;
  categories: string[];
  wallet: WalletData | null;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount(""); setMethod("cash"); setCategory(""); setNote(""); setDate(todayStr()); setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const availableBalance = wallet
    ? method === "cash"
      ? wallet.cashBalance
      : wallet.onlineBalance
    : 0;

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (!category) return setError("Please select a category.");
    setLoading(true);
    try {
      const res = await fetch("/expenses/add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method, category, note, date }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to add expense.");
      onSuccess(data.wallet);
      handleClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Expense">
      <div className="flex flex-col gap-4">
        <InputField
          label="Amount (₹)"
          type="number"
          min="1"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <SelectField
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: "cash", label: "💵 Cash" },
            { value: "online", label: "💳 Online" },
          ]}
        />
        {wallet && (
          <p className="text-xs -mt-2" style={{ color: "var(--text3)" }}>
            Available {method} balance: <strong>₹{fmt(availableBalance)}</strong>
          </p>
        )}
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: "", label: "Select category..." },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <DateField
  label="Date"
  value={date}
  max={todayStr()}
  min={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
  onChange={setDate}
/>
        <InputField
          label="Note (optional)"
          type="text"
          placeholder="e.g. Lunch, Uber..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#ff6b6b18", color: "#ff6b6b" }}>
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <ActionBtn variant="ghost" onClick={handleClose}>Cancel</ActionBtn>
          <ActionBtn loading={loading} onClick={submit}>Add Expense</ActionBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ categories }: { categories: string[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMonth, setFilterMonth] = useState(monthStr());

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (filterType) params.set("type", filterType);
    if (filterMethod) params.set("paymentMethod", filterMethod);
    if (filterCategory) params.set("category", filterCategory);
    if (filterMonth) params.set("month", filterMonth);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/expenses/transactions?${params}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setTotalPages(data.pagination.pages || 1);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterMethod, filterCategory, filterMonth, search]);

  useEffect(() => {
    fetchTxns();
  }, [fetchTxns]);

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <Search size={14} style={{ color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent outline-none text-sm w-full"
            style={{ color: "var(--text)" }}
          />
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
        />
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
        >
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="add_money">Added</option>
        </select>
        <select
          value={filterMethod}
          onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
        >
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border2)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Filter size={32} style={{ color: "var(--text3)" }} />
            <p style={{ color: "var(--text2)" }}>No transactions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border2)", background: "var(--surface)" }}>
                {["Date", "Type", "Category", "Method", "Note", "Amount"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium"
                    style={{ color: "var(--text2)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, i) => (
                <tr
                  key={txn._id}
                  style={{
                    borderBottom: i < transactions.length - 1 ? "1px solid var(--border2)" : "none",
                    background: "var(--surface)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--surface)")
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text2)" }}>
                    {new Date(txn.date).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
                      style={
                        txn.type === "expense"
                          ? { background: "#ff6b6b18", color: "#ff6b6b" }
                          : { background: "#50e3a418", color: "#50e3a4" }
                      }
                    >
                      {txn.type === "expense" ? (
                        <ArrowDownRight size={11} />
                      ) : (
                        <ArrowUpRight size={11} />
                      )}
                      {txn.type === "expense" ? "Expense" : "Added"}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                    {txn.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs"
                      style={{ background: "var(--bg)", color: "var(--text2)" }}
                    >
                      {txn.paymentMethod === "cash" ? (
                        <Banknote size={11} />
                      ) : (
                        <CreditCard size={11} />
                      )}
                      {txn.paymentMethod === "cash" ? "Cash" : "Online"}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 max-w-[160px] truncate"
                    style={{ color: "var(--text3)" }}
                  >
                    {txn.note || "—"}
                  </td>
                  <td
                    className="px-4 py-3 font-semibold whitespace-nowrap"
                    style={{ color: txn.type === "expense" ? "#ff6b6b" : "#50e3a4" }}
                  >
                    {txn.type === "expense" ? "−" : "+"}₹{fmt(txn.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border2)",
              color: page === 1 ? "var(--text3)" : "var(--text2)",
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm" style={{ color: "var(--text2)" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border2)",
              color: page === totalPages ? "var(--text3)" : "var(--text2)",
              opacity: page === totalPages ? 0.5 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────

function AnalysisTab() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthStr());

  useEffect(() => {
    setLoading(true);
    fetch(`/expenses/analysis?month=${month}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!data) return null;

  const { summary, categoryBreakdown, monthlyTrend, insights } = data;
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.amount), 1);
  const maxCat = categoryBreakdown[0]?.amount || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text)" }}
        />
        <span className="text-sm" style={{ color: "var(--text3)" }}>
          {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Spent", value: fmt(summary.totalSpent), color: "#ff6b6b" },
          { label: "Total Added", value: fmt(summary.totalAdded), color: "#50e3a4" },
          { label: "Cash Spent", value: fmt(summary.cashSpent), color: "#f5a623" },
          { label: "Online Spent", value: fmt(summary.onlineSpent), color: "#5bb8f5" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex flex-col gap-1"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <p className="text-xs" style={{ color: "var(--text3)" }}>{label}</p>
            <p className="text-xl font-bold" style={{ color }}>₹{value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
            Spending by Category
          </h4>
          {categoryBreakdown.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text3)" }}>No expenses this month.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {categoryBreakdown.slice(0, 8).map(({ category, amount }, i) => {
                const pct = (amount / maxCat) * 100;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <div key={category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: "var(--text2)" }}>{category}</span>
                      <span style={{ color: "var(--text)" }}>₹{fmt(amount)}</span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--bg)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly trend */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
            6-Month Trend
          </h4>
          <div className="flex items-end gap-2 h-32">
            {monthlyTrend.map(({ month: m, amount }, i) => {
              const h = maxTrend > 0 ? (amount / maxTrend) * 100 : 0;
              const isCurrent = i === monthlyTrend.length - 1;
              return (
                <div key={m} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full flex items-end" style={{ height: "100px" }}>
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      style={{
                        height: `${Math.max(h, 4)}%`,
                        background: isCurrent ? "var(--accent)" : "var(--border2)",
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] text-center"
                    style={{ color: isCurrent ? "var(--accent)" : "var(--text3)" }}
                  >
                    {m.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} style={{ color: "#f5a623" }} />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Insights
            </h4>
          </div>
          <ul className="flex flex-col gap-2">
            {insights.map((insight, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2"
                style={{ color: "var(--text2)" }}
              >
                <span style={{ color: "var(--accent)", marginTop: "2px" }}>•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "analysis">("overview");
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  // Recent transactions for overview
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/expenses/wallet");
      const data = await res.json();
      if (data.success) setWallet(data.wallet);
    } catch {
      /* ignore */
    } finally {
      setWalletLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/expenses/categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const res = await fetch("/expenses/transactions?limit=5");
      const data = await res.json();
      if (data.success) setRecentTxns(data.transactions);
    } catch {
      /* ignore */
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    fetchCategories();
    fetchRecent();
  }, [fetchWallet, fetchCategories, fetchRecent]);

  const onWalletUpdate = (updated: WalletData) => {
    setWallet(updated);
    fetchRecent();
  };

  const TABS = [
    { key: "overview", label: "Overview", icon: Wallet },
    { key: "transactions", label: "Transactions", icon: BarChart3 },
    { key: "analysis", label: "Analysis", icon: TrendingUp },
  ] as const;

  return (
    <>
      <AddMoneyModal
        open={addMoneyOpen}
        onClose={() => setAddMoneyOpen(false)}
        onSuccess={onWalletUpdate}
      />
      <AddExpenseModal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        onSuccess={onWalletUpdate}
        categories={categories}
        wallet={wallet}
      />

      <div className="flex flex-col gap-6 pb-4">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              Expense Tracker
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>
              Track your spending and manage your wallet
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAddMoneyOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "#50e3a420", color: "#50e3a4", border: "1px solid #50e3a430" }}
            >
              <PlusCircle size={15} />
              Add Money
            </button>
            <button
              onClick={() => setAddExpenseOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              <MinusCircle size={15} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Wallet cards */}
        {walletLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-5 h-28 animate-pulse"
                style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Balance"
              value={fmt(wallet?.totalBalance ?? 0)}
              icon={Wallet}
              color="var(--accent)"
              sub="Cash + Online"
            />
            <StatCard
              label="Cash Balance"
              value={fmt(wallet?.cashBalance ?? 0)}
              icon={Banknote}
              color="#50e3a4"
              sub="Physical money"
            />
            <StatCard
              label="Online Balance"
              value={fmt(wallet?.onlineBalance ?? 0)}
              icon={CreditCard}
              color="#5bb8f5"
              sub="UPI / Card / Net banking"
            />
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text2)",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
              Recent Transactions
            </h3>
            {recentLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            ) : recentTxns.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <Tag size={28} style={{ color: "var(--text3)" }} />
                <p className="text-sm" style={{ color: "var(--text2)" }}>
                  No transactions yet. Add money or log an expense to get started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentTxns.map((txn) => (
                  <div
                    key={txn._id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: "1px solid var(--border2)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={
                          txn.type === "expense"
                            ? { background: "#ff6b6b18", color: "#ff6b6b" }
                            : { background: "#50e3a418", color: "#50e3a4" }
                        }
                      >
                        {txn.type === "expense" ? (
                          <ArrowDownRight size={15} />
                        ) : (
                          <ArrowUpRight size={15} />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {txn.type === "expense"
                            ? txn.category || "Expense"
                            : "Money Added"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text3)" }}>
                          {txn.note || (txn.paymentMethod === "cash" ? "Cash" : "Online")} ·{" "}
                          {new Date(txn.date).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: txn.type === "expense" ? "#ff6b6b" : "#50e3a4" }}
                    >
                      {txn.type === "expense" ? "−" : "+"}₹{fmt(txn.amount)}
                    </p>
                  </div>
                ))}
                <button
                  onClick={() => setActiveTab("transactions")}
                  className="text-sm mt-1 transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  View all transactions →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "transactions" && (
          <TransactionsTab categories={categories} />
        )}

        {activeTab === "analysis" && <AnalysisTab />}
      </div>
    </>
  );
}