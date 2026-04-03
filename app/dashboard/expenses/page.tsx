"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  TrendingUp,
  Banknote,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Lightbulb,
  Tag,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  ShieldAlert,
  CalendarDays,
  RotateCcw,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const todayStr = () => new Date().toISOString().split("T")[0];
const monthStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const CAT_COLORS = [
  "#7c6ef3", "#5bb8f5", "#f5a623", "#50e3a4",
  "#ff6b6b", "#ffd166", "#06d6a0", "#ef476f",
  "#118ab2", "#ffd60a", "#c77dff", "#48cae4",
];

const DEFAULT_CATEGORIES = [
  "Food", "Travel", "Petrol", "Shopping", "Bills",
  "Health", "Entertainment", "Rent", "Recharge", "Groceries", "Miscellaneous",
];

const minDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
};

// ─── Shared atom styles (no Tailwind hardcodes) ───────────────────────────────

const S = {
  input: {
    background: "var(--bg)",
    border: "1px solid var(--b2)",
    color: "var(--tx)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--tx2)",
    marginBottom: 5,
    display: "block" as const,
  },
  surface: {
    background: "var(--sf)",
    border: "1px solid var(--b2)",
    borderRadius: 16,
  },
  pill: (active: boolean, color = "var(--ac)") =>
    ({
      padding: "7px 16px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      border: "none",
      background: active ? color : "transparent",
      color: active ? "#fff" : "var(--tx2)",
      transition: "all 0.15s",
    } as const),
  btn: (variant: "primary" | "danger" | "ghost" = "primary") => {
    const map = {
      primary: { background: "var(--ac)", color: "#fff" },
      danger: { background: "#ff6b6b22", color: "#ff6b6b", border: "1px solid #ff6b6b44" },
      ghost: { background: "transparent", color: "var(--tx2)", border: "1px solid var(--b2)" },
    };
    return {
      ...map[variant],
      padding: "9px 18px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
    } as const;
  },
};

// ─── CSS injection ─────────────────────────────────────────────────────────────
// We use CSS variables that inherit from the host theme (zinc dark palette)

const CSS = `
  :root {
    --bg: #0a0a0a;
    --sf: #111113;
    --sf2: #18181b;
    --b2: #27272a;
    --tx: #fafafa;
    --tx2: #a1a1aa;
    --tx3: #52525b;
    --ac: #7c3aed;
    --ac2: #6d28d9;
    --green: #50e3a4;
    --red: #ff6b6b;
    --blue: #5bb8f5;
    --amber: #f5a623;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f8f8f8;
      --sf: #ffffff;
      --sf2: #f4f4f5;
      --b2: #e4e4e7;
      --tx: #18181b;
      --tx2: #71717a;
      --tx3: #a1a1aa;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
  .exp-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px 60px; }
  .fade-in { animation: fadeUp 0.3s ease both; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  /* Table row hover */
  .txn-row { transition: background 0.1s; cursor: default; }
  .txn-row:hover { background: var(--sf2) !important; }

  /* Checkbox tick animation */
  .cb-wrap { user-select: none; cursor: pointer; }

  /* Modal backdrop */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal-box {
    background: var(--sf);
    border: 1px solid var(--b2);
    border-radius: 20px;
    padding: 24px;
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 4px; }

  /* Input focus */
  input:focus, select:focus, textarea:focus {
    border-color: var(--ac) !important;
    outline: none;
  }

  /* Rate-limit banner */
  .rl-banner {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 10px;
    background: #f5a62318; border: 1px solid #f5a62344;
    color: #f5a623; font-size: 12px;
  }

  /* Responsive grid */
  .wallet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 640px) { .wallet-grid { grid-template-columns: 1fr; } }

  .analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 700px) { .analysis-grid { grid-template-columns: 1fr; } }

  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 700px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }

  .tab-bar { display: flex; gap: 2px; padding: 4px; background: var(--sf); border: 1px solid var(--b2); border-radius: 12px; width: fit-content; }

  .filter-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .filter-row select, .filter-row input[type=month] {
    background: var(--sf); border: 1px solid var(--b2); color: var(--tx);
    border-radius: 10px; padding: 7px 10px; font-size: 13px; outline: none;
  }

  /* Batch bar */
  .batch-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 16px; border-radius: 12px;
    background: var(--ac)18; border: 1px solid var(--ac)44;
  }

  /* Mobile txn card layout */
  .txn-mobile { display: none; }
  @media (max-width: 680px) {
    .txn-table-wrap { display: none; }
    .txn-mobile { display: flex; flex-direction: column; gap: 8px; }
  }

  /* Danger confirm */
  .danger-confirm { background: #ff6b6b18; border: 1px solid #ff6b6b33; border-radius: 12px; padding: 14px; }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StyleInject() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

function StatCard({
  label, value, icon: Icon, color, sub,
}: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div style={{ ...S.surface, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--tx2)" }}>{label}</span>
        <span style={{
          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", background: `${color}18`, color,
        }}>
          <Icon size={14} />
        </span>
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)" }}>₹{value}</p>
        {sub && <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 3 }}>{sub}</p>}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box fade-in" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--tx)" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--b2)", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx2)" }}>
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function TogglePill({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 500,
            cursor: "pointer", border: value === o.value ? "none" : "1px solid var(--b2)",
            background: value === o.value ? "var(--ac)" : "transparent",
            color: value === o.value ? "#fff" : "var(--tx2)",
            transition: "all 0.15s",
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RateLimitBanner({ editsRemaining, deletesRemaining }: { editsRemaining?: number; deletesRemaining?: number }) {
  const low = (editsRemaining !== undefined && editsRemaining <= 5) ||
    (deletesRemaining !== undefined && deletesRemaining <= 5);
  if (!low) return null;
  return (
    <div className="rl-banner">
      <ShieldAlert size={14} />
      <span>
        {editsRemaining !== undefined && editsRemaining <= 5 && `${editsRemaining} edits`}
        {editsRemaining !== undefined && editsRemaining <= 5 && deletesRemaining !== undefined && deletesRemaining <= 5 && " · "}
        {deletesRemaining !== undefined && deletesRemaining <= 5 && `${deletesRemaining} deletes`}
        {" "}remaining today
      </span>
    </div>
  );
}

// ─── Add Money Modal ──────────────────────────────────────────────────────────

function AddMoneyModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (w: WalletData) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setAmount(""); setMethod("cash"); setNote(""); setDate(todayStr()); setError(""); };
  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-money", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method, note, date }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed.");
      onSuccess(data.wallet);
      handleClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add money to wallet">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Amount (₹)">
          <input type="number" min="1" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={S.input} />
        </Field>
        <Field label="Wallet">
          <TogglePill options={[{ value: "cash", label: "💵 Cash" }, { value: "online", label: "💳 Online" }]} value={method} onChange={setMethod} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} min={minDate()} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={S.input} />
        </Field>
        <Field label="Note (optional)">
          <input type="text" placeholder="e.g. Salary, Freelance…" value={note} onChange={(e) => setNote(e.target.value)} style={S.input} />
        </Field>
        {error && <p style={{ fontSize: 12, color: "var(--red)", background: "#ff6b6b10", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.btn("ghost")} onClick={handleClose}>Cancel</button>
          <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={submit} disabled={loading}>
            {loading && <Loader2 size={13} className="animate-spin" />} Add Money
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({ open, onClose, onSuccess, categories, wallet }: {
  open: boolean; onClose: () => void; onSuccess: (w: WalletData) => void;
  categories: string[]; wallet: WalletData | null;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setAmount(""); setMethod("cash"); setCategory(""); setNote(""); setDate(todayStr()); setError(""); };
  const handleClose = () => { reset(); onClose(); };

  const availBal = wallet ? (method === "cash" ? wallet.cashBalance : wallet.onlineBalance) : 0;

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (!category) return setError("Please select a category.");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-expense", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method, category, note, date }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed.");
      onSuccess(data.wallet);
      handleClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add expense">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Amount (₹)">
          <input type="number" min="1" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={S.input} />
        </Field>
        <Field label="Payment method">
          <TogglePill options={[{ value: "cash", label: "💵 Cash" }, { value: "online", label: "💳 Online" }]} value={method} onChange={setMethod} />
          {wallet && <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 4 }}>Available: <strong style={{ color: "var(--tx2)" }}>₹{fmt(availBal)}</strong></p>}
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...S.input }}>
            <option value="">Select category…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={date} min={minDate()} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={S.input} />
        </Field>
        <Field label="Note (optional)">
          <input type="text" placeholder="e.g. Lunch, Uber…" value={note} onChange={(e) => setNote(e.target.value)} style={S.input} />
        </Field>
        {error && <p style={{ fontSize: 12, color: "var(--red)", background: "#ff6b6b10", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.btn("ghost")} onClick={handleClose}>Cancel</button>
          <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={submit} disabled={loading}>
            {loading && <Loader2 size={13} />} Add Expense
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Transaction Modal ───────────────────────────────────────────────────

function EditModal({ txn, onClose, onSuccess, categories, wallet }: {
  txn: Transaction | null; onClose: () => void;
  onSuccess: (updated: Transaction, newWallet: WalletData) => void;
  categories: string[]; wallet: WalletData | null;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (txn) {
      setAmount(String(txn.amount));
      setMethod(txn.paymentMethod);
      setCategory(txn.category || "");
      setNote(txn.note || "");
      setDate(txn.date.split("T")[0]);
      setError("");
    }
  }, [txn]);

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (txn?.type === "expense" && !category) return setError("Category is required.");
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/transactions/${txn!._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method, category: category || undefined, note, date }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to update.");
      onSuccess(data.transaction, data.wallet);
      onClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!txn} onClose={onClose} title={`Edit ${txn?.type === "expense" ? "expense" : "money added"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Amount (₹)">
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={S.input} />
        </Field>
        <Field label="Payment method">
          <TogglePill options={[{ value: "cash", label: "💵 Cash" }, { value: "online", label: "💳 Online" }]} value={method} onChange={setMethod} />
        </Field>
        {txn?.type === "expense" && (
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...S.input }}>
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        )}
        <Field label="Date">
          <input type="date" value={date} min={minDate()} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={S.input} />
        </Field>
        <Field label="Note (optional)">
          <input type="text" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} style={S.input} />
        </Field>
        {error && <p style={{ fontSize: 12, color: "var(--red)", background: "#ff6b6b10", padding: "8px 12px", borderRadius: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn("primary"), flex: 1, justifyContent: "center" }} onClick={submit} disabled={loading}>
            {loading && <Loader2 size={13} />} Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ txn, onClose, onSuccess }: {
  txn: Transaction | null; onClose: () => void;
  onSuccess: (id: string, newWallet: WalletData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/transactions/${txn!._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to delete.");
      onSuccess(txn!._id, data.wallet);
      onClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!txn} onClose={onClose} title="Delete transaction">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="danger-confirm">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color="var(--red)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500 }}>This will permanently delete this transaction and reverse its wallet effect.</p>
              {txn && (
                <p style={{ fontSize: 12, color: "var(--tx2)", marginTop: 6 }}>
                  {txn.type === "expense" ? `−₹${fmt(txn.amount)}` : `+₹${fmt(txn.amount)}`} · {txn.category || "Money added"} · {new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </div>
        {error && <p style={{ fontSize: 12, color: "var(--red)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn("danger"), flex: 1, justifyContent: "center" }} onClick={confirm} disabled={loading}>
            {loading && <Loader2 size={13} />} Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Batch Delete Modal ───────────────────────────────────────────────────────

function BatchDeleteModal({ ids, onClose, onSuccess }: {
  ids: string[]; onClose: () => void;
  onSuccess: (deletedIds: string[], newWallet: WalletData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/transactions/batch-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed.");
      onSuccess(ids, data.wallet);
      onClose();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={ids.length > 0} onClose={onClose} title={`Delete ${ids.length} transaction${ids.length !== 1 ? "s" : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="danger-confirm">
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color="var(--red)" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "var(--tx)" }}>
              You're about to permanently delete <strong>{ids.length} transaction{ids.length !== 1 ? "s" : ""}</strong>. This will reverse all their wallet effects and cannot be undone.
            </p>
          </div>
        </div>
        {error && <p style={{ fontSize: 12, color: "var(--red)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn("danger"), flex: 1, justifyContent: "center" }} onClick={confirm} disabled={loading}>
            {loading && <Loader2 size={13} />} Delete {ids.length} item{ids.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({
  categories, wallet, onWalletUpdate,
}: { categories: string[]; wallet: WalletData | null; onWalletUpdate: (w: WalletData) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMonth, setFilterMonth] = useState(monthStr());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<Transaction | null>(null);
  const [batchDeleteIds, setBatchDeleteIds] = useState<string[]>([]);
  const [rlStatus, setRlStatus] = useState<{ editsRemaining?: number; deletesRemaining?: number }>({});

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("page", String(page)); p.set("limit", "15");
    if (filterType) p.set("type", filterType);
    if (filterMethod) p.set("paymentMethod", filterMethod);
    if (filterCategory) p.set("category", filterCategory);
    if (filterMonth) p.set("month", filterMonth);
    if (search) p.set("search", search);
    try {
      const res = await fetch(`/api/expenses/transactions?${p}`);
      const data = await res.json();
      if (data.success) { setTransactions(data.transactions); setTotalPages(data.pagination.pages || 1); }
    } catch {} finally { setLoading(false); }
  }, [page, filterType, filterMethod, filterCategory, filterMonth, search]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);
  useEffect(() => { setSelected(new Set()); }, [filterType, filterMethod, filterCategory, filterMonth, search, page]);

  const toggleSelect = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected((s) => s.size === transactions.length ? new Set() : new Set(transactions.map((t) => t._id)));
  };

  const handleEditSuccess = (updated: Transaction, newWallet: WalletData) => {
    setTransactions((ts) => ts.map((t) => t._id === updated._id ? updated : t));
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, editsRemaining: (s.editsRemaining ?? 20) - 1 }));
  };

  const handleDeleteSuccess = (id: string, newWallet: WalletData) => {
    setTransactions((ts) => ts.filter((t) => t._id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, deletesRemaining: (s.deletesRemaining ?? 30) - 1 }));
  };

  const handleBatchDeleteSuccess = (deletedIds: string[], newWallet: WalletData) => {
    setTransactions((ts) => ts.filter((t) => !deletedIds.includes(t._id)));
    setSelected(new Set());
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, deletesRemaining: (s.deletesRemaining ?? 30) - deletedIds.length }));
  };

  const isAllSelected = transactions.length > 0 && selected.size === transactions.length;

  const renderRow = (txn: Transaction) => {
    const isExp = txn.type === "expense";
    const isSel = selected.has(txn._id);
    return (
      <tr key={txn._id} className="txn-row" style={{ background: isSel ? "var(--ac)0d" : "var(--sf)", borderBottom: "1px solid var(--b2)" }}>
        <td style={{ padding: "10px 12px", width: 40 }}>
          <div className="cb-wrap" onClick={() => toggleSelect(txn._id)}>
            {isSel ? <CheckSquare size={15} color="var(--ac)" /> : <Square size={15} color="var(--tx3)" />}
          </div>
        </td>
        <td style={{ padding: "10px 12px", color: "var(--tx2)", fontSize: 12, whiteSpace: "nowrap" }}>
          {new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
            borderRadius: 6, fontSize: 11, fontWeight: 500,
            background: isExp ? "#ff6b6b18" : "#50e3a418",
            color: isExp ? "var(--red)" : "var(--green)",
          }}>
            {isExp ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
            {isExp ? "Expense" : "Added"}
          </span>
        </td>
        <td style={{ padding: "10px 12px", color: "var(--tx)", fontSize: 13 }}>{txn.category || "—"}</td>
        <td style={{ padding: "10px 12px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--tx2)", background: "var(--sf2)", padding: "3px 7px", borderRadius: 6 }}>
            {txn.paymentMethod === "cash" ? <Banknote size={10} /> : <CreditCard size={10} />}
            {txn.paymentMethod === "cash" ? "Cash" : "Online"}
          </span>
        </td>
        <td style={{ padding: "10px 12px", color: "var(--tx3)", fontSize: 12, maxWidth: 160 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.note || "—"}</span>
        </td>
        <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap", color: isExp ? "var(--red)" : "var(--green)" }}>
          {isExp ? "−" : "+"}₹{fmt(txn.amount)}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setEditTxn(txn)} title="Edit" style={{ background: "none", border: "1px solid var(--b2)", borderRadius: 7, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx2)" }}>
              <Pencil size={11} />
            </button>
            <button onClick={() => setDeleteTxn(txn)} title="Delete" style={{ background: "none", border: "1px solid #ff6b6b33", borderRadius: 7, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)" }}>
              <Trash2 size={11} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (txn: Transaction) => {
    const isExp = txn.type === "expense";
    const isSel = selected.has(txn._id);
    return (
      <div key={txn._id} style={{ ...S.surface, padding: "12px 14px", background: isSel ? "var(--ac)0d" : "var(--sf)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
            <div className="cb-wrap" onClick={() => toggleSelect(txn._id)} style={{ marginTop: 2 }}>
              {isSel ? <CheckSquare size={15} color="var(--ac)" /> : <Square size={15} color="var(--tx3)" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{txn.category || "Money Added"}</span>
                <span style={{ fontSize: 10, background: isExp ? "#ff6b6b18" : "#50e3a418", color: isExp ? "var(--red)" : "var(--green)", padding: "2px 7px", borderRadius: 5, fontWeight: 500 }}>
                  {isExp ? "Expense" : "Added"}
                </span>
                <span style={{ fontSize: 10, background: "var(--sf2)", color: "var(--tx2)", padding: "2px 7px", borderRadius: 5 }}>
                  {txn.paymentMethod}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 3 }}>
                {new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                {txn.note && ` · ${txn.note}`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isExp ? "var(--red)" : "var(--green)" }}>
              {isExp ? "−" : "+"}₹{fmt(txn.amount)}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setEditTxn(txn)} style={{ background: "none", border: "1px solid var(--b2)", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx2)" }}>
                <Pencil size={10} />
              </button>
              <button onClick={() => setDeleteTxn(txn)} style={{ background: "none", border: "1px solid #ff6b6b33", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)" }}>
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <EditModal txn={editTxn} onClose={() => setEditTxn(null)} onSuccess={handleEditSuccess} categories={categories} wallet={wallet} />
      <DeleteModal txn={deleteTxn} onClose={() => setDeleteTxn(null)} onSuccess={handleDeleteSuccess} />
      <BatchDeleteModal ids={batchDeleteIds} onClose={() => setBatchDeleteIds([])} onSuccess={handleBatchDeleteSuccess} />

      <RateLimitBanner editsRemaining={rlStatus.editsRemaining} deletesRemaining={rlStatus.deletesRemaining} />

      {/* Filters */}
      <div className="filter-row">
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--sf)", border: "1px solid var(--b2)", borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 180 }}>
          <Search size={13} color="var(--tx3)" />
          <input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--tx)", width: "100%" }} />
        </div>
        <input type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }} />
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="add_money">Added</option>
        </select>
        <select value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}>
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Batch actions bar */}
      {selected.size > 0 && (
        <div className="batch-bar fade-in">
          <CheckSquare size={14} color="var(--ac)" />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)" }}>{selected.size} selected</span>
          <button onClick={() => setBatchDeleteIds(Array.from(selected))}
            style={{ ...S.btn("danger"), padding: "6px 14px", marginLeft: "auto" }}>
            <Trash2 size={12} /> Delete {selected.size}
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ ...S.btn("ghost"), padding: "6px 12px" }}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="txn-table-wrap" style={{ ...S.surface, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={22} color="var(--ac)" className="animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 10 }}>
            <Tag size={28} color="var(--tx3)" />
            <p style={{ fontSize: 13, color: "var(--tx2)" }}>No transactions found</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--b2)" }}>
                  <th style={{ padding: "10px 12px", width: 40, textAlign: "left" }}>
                    <div className="cb-wrap" onClick={toggleAll}>
                      {isAllSelected ? <CheckSquare size={15} color="var(--ac)" /> : <Square size={15} color="var(--tx3)" />}
                    </div>
                  </th>
                  {["Date", "Type", "Category", "Method", "Note", "Amount", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 500, color: "var(--tx2)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{transactions.map(renderRow)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="txn-mobile">
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Loader2 size={22} color="var(--ac)" className="animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--tx2)", fontSize: 13 }}>No transactions found</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <div className="cb-wrap" onClick={toggleAll} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--tx2)", fontSize: 12 }}>
                {isAllSelected ? <CheckSquare size={13} color="var(--ac)" /> : <Square size={13} color="var(--tx3)" />}
                Select all
              </div>
            </div>
            {transactions.map(renderMobileCard)}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sf)", border: "1px solid var(--b2)", cursor: "pointer", color: "var(--tx2)", opacity: page === 1 ? 0.4 : 1 }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, color: "var(--tx2)" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sf)", border: "1px solid var(--b2)", cursor: "pointer", color: "var(--tx2)", opacity: page === totalPages ? 0.4 : 1 }}>
            <ChevronRight size={14} />
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
    fetch(`/api/expenses/analysis?month=${month}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <Loader2 size={26} color="var(--ac)" className="animate-spin" />
    </div>
  );
  if (!data) return null;

  const { summary, categoryBreakdown, monthlyTrend, insights } = data;
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.amount), 1);
  const maxCat = categoryBreakdown[0]?.amount || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ ...S.input, width: "auto", padding: "7px 12px" }} />
        <span style={{ fontSize: 12, color: "var(--tx3)" }}>
          {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="summary-grid">
        {[
          { label: "Total Spent", value: fmt(summary.totalSpent), color: "var(--red)" },
          { label: "Total Added", value: fmt(summary.totalAdded), color: "var(--green)" },
          { label: "Cash Spent", value: fmt(summary.cashSpent), color: "var(--amber)" },
          { label: "Online Spent", value: fmt(summary.onlineSpent), color: "var(--blue)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.surface, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color }}>₹{value}</p>
          </div>
        ))}
      </div>

      <div className="analysis-grid">
        <div style={{ ...S.surface, padding: 18 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginBottom: 16 }}>Spending by category</h4>
          {categoryBreakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--tx3)" }}>No expenses this month.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {categoryBreakdown.slice(0, 8).map(({ category, amount }, i) => {
                const pct = (amount / maxCat) * 100;
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <div key={category}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--tx2)" }}>{category}</span>
                      <span style={{ color: "var(--tx)", fontWeight: 500 }}>₹{fmt(amount)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "var(--b2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ ...S.surface, padding: 18 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginBottom: 16 }}>6-month trend</h4>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {monthlyTrend.map(({ month: m, amount }, i) => {
              const h = maxTrend > 0 ? (amount / maxTrend) * 100 : 0;
              const isCurrent = i === monthlyTrend.length - 1;
              return (
                <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", height: 90, width: "100%" }}>
                    <div style={{
                      width: "100%", borderRadius: "4px 4px 0 0",
                      height: `${Math.max(h, 3)}%`,
                      background: isCurrent ? "var(--ac)" : "var(--b2)",
                      transition: "height 0.7s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: isCurrent ? "var(--ac)" : "var(--tx3)", textAlign: "center" }}>
                    {m.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {insights.length > 0 && (
        <div style={{ ...S.surface, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Lightbulb size={14} color="var(--amber)" />
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>Insights</h4>
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((insight, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--tx2)", alignItems: "flex-start" }}>
                <span style={{ color: "var(--ac)", flexShrink: 0, marginTop: 1 }}>•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onGoToTransactions }: { onGoToTransactions: () => void }) {
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/transactions?limit=6");
      const data = await res.json();
      if (data.success) setRecentTxns(data.transactions);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  return (
    <div style={{ ...S.surface, padding: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", marginBottom: 16 }}>Recent transactions</h3>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Loader2 size={20} color="var(--ac)" className="animate-spin" />
        </div>
      ) : recentTxns.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 32, gap: 10 }}>
          <Tag size={24} color="var(--tx3)" />
          <p style={{ fontSize: 13, color: "var(--tx2)" }}>No transactions yet. Add money or log an expense.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recentTxns.map((txn, i) => {
            const isExp = txn.type === "expense";
            return (
              <div key={txn._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < recentTxns.length - 1 ? "1px solid var(--b2)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: isExp ? "#ff6b6b18" : "#50e3a418", color: isExp ? "var(--red)" : "var(--green)", flexShrink: 0 }}>
                    {isExp ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)" }}>{txn.category || "Money Added"}</p>
                    <p style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>
                      {txn.paymentMethod === "cash" ? "Cash" : "Online"}
                      {txn.note ? ` · ${txn.note}` : ""}
                      {" · "}{new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: isExp ? "var(--red)" : "var(--green)" }}>
                  {isExp ? "−" : "+"}₹{fmt(txn.amount)}
                </p>
              </div>
            );
          })}
          <button onClick={onGoToTransactions} style={{ background: "none", border: "none", color: "var(--ac)", fontSize: 13, cursor: "pointer", textAlign: "left", marginTop: 12 }}>
            View all transactions →
          </button>
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

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses/wallet");
      const data = await res.json();
      if (data.success) setWallet(data.wallet);
    } catch {} finally { setWalletLoading(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses/categories");
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch {}
  }, []);

  useEffect(() => {
    fetchWallet();
    fetchCategories();
  }, [fetchWallet, fetchCategories]);

  const TABS = [
    { key: "overview" as const, label: "Overview", icon: Wallet },
    { key: "transactions" as const, label: "Transactions", icon: BarChart3 },
    { key: "analysis" as const, label: "Analysis", icon: TrendingUp },
  ];

  return (
    <>
      <StyleInject />
      <AddMoneyModal open={addMoneyOpen} onClose={() => setAddMoneyOpen(false)} onSuccess={(w) => { setWallet(w); setAddMoneyOpen(false); }} />
      <AddExpenseModal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} onSuccess={(w) => { setWallet(w); setAddExpenseOpen(false); }} categories={categories} wallet={wallet} />

      <div className="exp-page">
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)" }}>Expense Tracker</h1>
            <p style={{ fontSize: 12, color: "var(--tx3)", marginTop: 3 }}>Track spending and manage your wallet</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setAddMoneyOpen(true)} style={{ ...S.btn("ghost"), background: "#50e3a415", color: "var(--green)", border: "1px solid #50e3a430" }}>
              <PlusCircle size={13} /> Add Money
            </button>
            <button onClick={() => setAddExpenseOpen(true)} style={S.btn("primary")}>
              <MinusCircle size={13} /> Add Expense
            </button>
          </div>
        </div>

        {/* Wallet cards */}
        {walletLoading ? (
          <div className="wallet-grid" style={{ marginBottom: 22 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ ...S.surface, height: 90, opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div className="wallet-grid" style={{ marginBottom: 22 }}>
            <StatCard label="Total Balance" value={fmt(wallet?.totalBalance ?? 0)} icon={Wallet} color="var(--ac)" sub="Cash + Online" />
            <StatCard label="Cash Balance" value={fmt(wallet?.cashBalance ?? 0)} icon={Banknote} color="var(--green)" sub="Physical money" />
            <StatCard label="Online Balance" value={fmt(wallet?.onlineBalance ?? 0)} icon={CreditCard} color="var(--blue)" sub="UPI · Card · Net banking" />
          </div>
        )}

        {/* Tabs */}
        <div style={{ marginBottom: 20 }}>
          <div className="tab-bar">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: active ? "var(--ac)" : "transparent", color: active ? "#fff" : "var(--tx2)", transition: "all 0.15s" }}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="fade-in" key={activeTab}>
          {activeTab === "overview" && <OverviewTab onGoToTransactions={() => setActiveTab("transactions")} />}
          {activeTab === "transactions" && <TransactionsTab categories={categories} wallet={wallet} onWalletUpdate={setWallet} />}
          {activeTab === "analysis" && <AnalysisTab />}
        </div>
      </div>
    </>
  );
}