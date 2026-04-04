"use client";
// app/dashboard/expenses/page.tsx

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
  TrendingDown,
  Activity,
  DollarSign,
  Layers,
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
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const fmtDec = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const minDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const DEFAULT_CATEGORIES = [
  "Food", "Travel", "Petrol", "Shopping", "Bills",
  "Health", "Entertainment", "Rent", "Recharge", "Groceries", "Miscellaneous",
];

const CAT_COLORS = [
  "#818cf8", "#34d399", "#fb923c", "#60a5fa",
  "#f472b6", "#a78bfa", "#2dd4bf", "#facc15",
  "#f87171", "#4ade80", "#e879f9", "#38bdf8",
];

// ─── Global CSS ───────────────────────────────────────────────────────────────
//
// KEY FIX: We no longer define our own hardcoded dark/light colour blocks.
// Instead, .exp-root aliases its local shorthand vars (--sf, --tx, etc.)
// to the layout's shared CSS variables (--surface, --text, etc.) that are
// injected onto :root by the dashboard layout's useTheme() hook.
// When the user toggles dark ↔ light, the layout updates :root, and every
// alias here automatically reflects the new values — no extra work needed.

const GLOBAL_CSS = `
  /* ── Map component shorthand vars → layout shared vars ────────────────
     The layout (app/dashboard/layout.tsx) injects these on :root:
       --bg, --surface, --surface2, --border, --border2,
       --text, --text2, --text3, --text4,
       --accent, --accent2, --green, --amber, --danger
     We alias them here so the rest of the component CSS is untouched.    */
  .exp-root {
    --sf:      var(--surface);
    --sf2:     var(--surface2);
    --sf3:     var(--surface2);      /* closest equivalent */
    --b1:      var(--border);
    --b2:      var(--border2);
    --tx:      var(--text);
    --tx2:     var(--text2);
    --tx3:     var(--text3);
    --tx4:     var(--text4);
    --ac:      var(--accent);
    --ac-d:    var(--accent2);
    --red:     var(--danger);
    --blue:    #60a5fa;
    --radius:    12px;
    --radius-sm: 8px;
    --shadow:    0 1px 3px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.10);
    --shadow-lg: 0 10px 40px rgba(0,0,0,0.22);
  }

  .exp-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .exp-root {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--tx);
    min-height: 100vh;
    transition: background 0.2s, color 0.2s;
  }
  .exp-page { max-width: 1080px; margin: 0 auto; padding: 28px 16px 80px; }

  /* Animations */
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .fade-in { animation: fadeUp 0.28s cubic-bezier(.2,.8,.4,1) both; }
  .spin { animation: spin 0.8s linear infinite; }

  /* Skeleton */
  .skeleton {
    background: linear-gradient(90deg, var(--sf2) 25%, var(--sf3) 50%, var(--sf2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: var(--radius-sm);
  }

  /* Surface */
  .surface {
    background: var(--sf);
    border: 1px solid var(--b1);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  /* Tabs */
  .tab-nav {
    display: flex;
    gap: 2px;
    background: var(--sf);
    border: 1px solid var(--b1);
    border-radius: var(--radius);
    padding: 4px;
    width: fit-content;
  }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 18px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--tx3);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .tab-btn:hover { color: var(--tx2); background: var(--sf2); }
  .tab-btn.active { background: var(--ac); color: #fff; }

  /* Inputs */
  .inp {
    width: 100%;
    background: var(--sf2);
    border: 1.5px solid var(--b1);
    border-radius: var(--radius-sm);
    padding: 10px 13px;
    font-size: 14px;
    color: var(--tx);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }
  .inp:focus { border-color: var(--ac); box-shadow: 0 0 0 3px rgba(129,140,248,0.12); }
  .inp::placeholder { color: var(--tx4); }
  select.inp { appearance: none; cursor: pointer; }

  /* Toggle pills */
  .toggle-group { display: flex; gap: 6px; }
  .toggle-pill {
    flex: 1;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    border: 1.5px solid var(--b1);
    background: transparent;
    color: var(--tx3);
    transition: all 0.15s;
    font-family: inherit;
  }
  .toggle-pill:hover { border-color: var(--ac); color: var(--tx); }
  .toggle-pill.active { background: var(--ac); border-color: var(--ac); color: #fff; }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    font-family: inherit;
    white-space: nowrap;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--ac); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--ac-d); }
  .btn-ghost { background: transparent; color: var(--tx2); border: 1.5px solid var(--b1); }
  .btn-ghost:hover:not(:disabled) { border-color: var(--b2); color: var(--tx); }
  .btn-danger { background: rgba(248,113,113,0.08); color: var(--red); border: 1.5px solid rgba(248,113,113,0.2); }
  .btn-danger:hover:not(:disabled) { background: rgba(248,113,113,0.15); }
  .btn-green { background: rgba(52,211,153,0.08); color: var(--green); border: 1.5px solid rgba(52,211,153,0.2); }
  .btn-green:hover:not(:disabled) { background: rgba(52,211,153,0.14); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-icon { padding: 7px; width: 30px; height: 30px; justify-content: center; border: 1.5px solid var(--b1); background: transparent; color: var(--tx3); border-radius: var(--radius-sm); }
  .btn-icon:hover { color: var(--tx); border-color: var(--b2); }
  .btn-icon-danger { border-color: rgba(248,113,113,0.2); color: var(--red); }
  .btn-icon-danger:hover { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.08); }

  /* Modal */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: fadeUp 0.15s ease both;
  }
  .modal-box {
    background: var(--sf);
    border: 1px solid var(--b1);
    border-radius: 18px;
    padding: 26px;
    width: 100%;
    max-width: 440px;
    max-height: 90dvh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: fadeUp 0.2s cubic-bezier(.2,.8,.4,1) both;
    position: relative;
  }
  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--tx);
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Form fields */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 12px; font-weight: 500; color: var(--tx3); letter-spacing: 0.03em; }
  .field-hint { font-size: 11px; color: var(--tx4); margin-top: 3px; }

  /* Error */
  .err-box {
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: var(--radius-sm);
    padding: 10px 13px;
    font-size: 13px;
    color: var(--red);
  }

  /* Transaction table */
  .txn-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .txn-table th {
    padding: 10px 12px;
    text-align: left;
    font-weight: 500;
    color: var(--tx4);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--b1);
    white-space: nowrap;
  }
  .txn-row { transition: background 0.1s; }
  .txn-row:hover td { background: var(--sf2); }
  .txn-row td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--b1);
    vertical-align: middle;
    background: var(--sf);
    transition: background 0.1s;
  }
  .txn-row.selected td { background: rgba(129,140,248,0.05); }
  .txn-row:last-child td { border-bottom: none; }

  /* Tags / badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
  }
  .badge-expense { background: rgba(248,113,113,0.1); color: var(--red); }
  .badge-income { background: rgba(52,211,153,0.1); color: var(--green); }
  .badge-method { background: var(--sf3); color: var(--tx3); border: 1px solid var(--b1); }

  /* Wallet cards */
  .wallet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 640px) { .wallet-grid { grid-template-columns: 1fr; } }

  /* Progress bar */
  .progress-bar {
    height: 6px;
    background: var(--sf3);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s cubic-bezier(.4,0,.2,1);
  }

  /* Filter row */
  .filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .filter-select {
    background: var(--sf);
    border: 1.5px solid var(--b1);
    color: var(--tx);
    border-radius: var(--radius-sm);
    padding: 8px 11px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s;
    cursor: pointer;
  }
  .filter-select:focus { border-color: var(--ac); }

  /* Batch bar */
  .batch-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 10px 16px;
    border-radius: var(--radius);
    background: rgba(129,140,248,0.06);
    border: 1.5px solid rgba(129,140,248,0.2);
    animation: fadeUp 0.2s ease both;
  }

  /* Rate limit */
  .rl-banner {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.2);
    color: var(--amber);
    font-size: 12px;
  }

  /* Danger box */
  .danger-box {
    background: rgba(248,113,113,0.06);
    border: 1px solid rgba(248,113,113,0.16);
    border-radius: var(--radius-sm);
    padding: 14px;
    display: flex; gap: 10px; align-items: flex-start;
  }

  /* Mobile txn cards */
  .txn-mobile { display: none; flex-direction: column; gap: 8px; }
  @media (max-width: 700px) {
    .txn-table-wrap { display: none; }
    .txn-mobile { display: flex; }
  }

  /* Mobile txn card */
  .txn-card {
    background: var(--sf);
    border: 1px solid var(--b1);
    border-radius: var(--radius);
    padding: 13px 14px;
    transition: background 0.1s;
  }
  .txn-card.selected { background: rgba(129,140,248,0.05); border-color: rgba(129,140,248,0.2); }

  /* Analysis */
  .analysis-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 700px) { .analysis-2col { grid-template-columns: 1fr; } }
  .summary-4col { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  @media (max-width: 700px) { .summary-4col { grid-template-columns: repeat(2,1fr); } }

  /* Bar chart */
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 130px; padding-bottom: 4px; }
  .bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; height: 100%; }
  .bar-col { width: 100%; display: flex; align-items: flex-end; flex: 1; }
  .bar { width: 100%; border-radius: 5px 5px 0 0; transition: height 0.8s cubic-bezier(.4,0,.2,1), opacity 0.2s; cursor: default; }
  .bar:hover { opacity: 0.8; }
  .bar-label { font-size: 10px; color: var(--tx4); text-align: center; white-space: nowrap; }
  .bar-amt { font-size: 9px; color: var(--tx3); text-align: center; white-space: nowrap; }

  /* Insight item */
  .insight-item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--sf2);
    font-size: 13px;
    color: var(--tx2);
    border: 1px solid var(--b1);
  }
  .insight-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ac); flex-shrink: 0; margin-top: 4px; }

  /* Overview list item */
  .txn-list-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 0;
    border-bottom: 1px solid var(--b1);
    gap: 12px;
  }
  .txn-list-item:last-child { border-bottom: none; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 4px; }

  /* Header */
  .page-header {
    display: flex; flex-wrap: wrap; align-items: flex-start;
    justify-content: space-between; gap: 14px; margin-bottom: 26px;
  }
  .page-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--tx); letter-spacing: -0.3px; }
  .page-sub { font-size: 13px; color: var(--tx4); margin-top: 3px; }

  /* Checkbox */
  .cb { cursor: pointer; display: flex; align-items: center; user-select: none; }

  /* Pagination */
  .pagination { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 16px; }
  .page-btn {
    width: 32px; height: 32px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    background: var(--sf); border: 1.5px solid var(--b1);
    cursor: pointer; color: var(--tx2);
    transition: all 0.15s;
  }
  .page-btn:hover:not(:disabled) { border-color: var(--ac); color: var(--ac); }
  .page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .page-info { font-size: 13px; color: var(--tx3); }

  /* Wallet stat card */
  .wallet-card {
    border-radius: var(--radius);
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 12px;
    background: var(--sf);
    border: 1px solid var(--b1);
    box-shadow: var(--shadow);
    transition: border-color 0.2s;
  }
  .wallet-card:hover { border-color: var(--b2); }
  .wallet-card-total { background: linear-gradient(135deg, rgba(129,140,248,0.1) 0%, rgba(129,140,248,0.03) 100%); border-color: rgba(129,140,248,0.22); }

  /* Loading empty states */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 20px; gap: 12px;
    color: var(--tx4);
  }
  .empty-state p { font-size: 13px; color: var(--tx3); }

  /* Section header */
  .section-title {
    font-size: 13px; font-weight: 600; color: var(--tx);
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }

  /* Tabs mobile */
  @media (max-width: 480px) {
    .tab-btn span { display: none; }
    .tab-nav { gap: 0; }
    .tab-btn { padding: 8px 14px; }
  }
`;

// ─── Style Injector ───────────────────────────────────────────────────────────

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />;
}

// ─── Shared Field Wrapper ─────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

// ─── Toggle Pills ─────────────────────────────────────────────────────────────

function TogglePill({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="toggle-group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`toggle-pill${value === o.value ? " active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

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
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <span>{title}</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px", gap: 4 }}
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Rate Limit Banner ────────────────────────────────────────────────────────

function RateLimitBanner({
  editsRemaining,
  deletesRemaining,
}: {
  editsRemaining?: number;
  deletesRemaining?: number;
}) {
  const low =
    (editsRemaining !== undefined && editsRemaining <= 5) ||
    (deletesRemaining !== undefined && deletesRemaining <= 5);
  if (!low) return null;
  return (
    <div className="rl-banner">
      <ShieldAlert size={13} />
      <span>
        {editsRemaining !== undefined && editsRemaining <= 5
          ? `${editsRemaining} edits`
          : ""}
        {editsRemaining !== undefined &&
          editsRemaining <= 5 &&
          deletesRemaining !== undefined &&
          deletesRemaining <= 5
          ? " · "
          : ""}
        {deletesRemaining !== undefined && deletesRemaining <= 5
          ? `${deletesRemaining} deletes`
          : ""}
        {" remaining today"}
      </span>
    </div>
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
  onSuccess: (w: WalletData) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount("");
    setMethod("cash");
    setNote("");
    setDate(todayStr());
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Please enter a valid amount.");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-money", {
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
    <Modal open={open} onClose={handleClose} title="💵 Add Money to Wallet">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Amount (₹)">
          <input
            className="inp"
            type="number"
            min="1"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Wallet Type">
          <TogglePill
            options={[
              { value: "cash", label: "💵 Cash" },
              { value: "online", label: "💳 Online" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </Field>

        <Field label="Date" hint="Select any date within the last 90 days">
          <input
            className="inp"
            type="date"
            value={date}
            min={minDateStr()}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Note (optional)">
          <input
            className="inp"
            type="text"
            placeholder="e.g. Salary, Freelance, Gift…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </Field>

        {error && <div className="err-box">{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={submit}
            disabled={loading}
          >
            {loading && <Loader2 size={13} className="spin" />}
            Add Money
          </button>
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
  onSuccess: (w: WalletData) => void;
  categories: string[];
  wallet: WalletData | null;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setAmount("");
    setMethod("cash");
    setCategory("");
    setNote("");
    setDate(todayStr());
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const availBal = wallet
    ? method === "cash"
      ? wallet.cashBalance
      : wallet.onlineBalance
    : 0;

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Please enter a valid amount.");
    if (!category) return setError("Please select a category.");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: method,
          category,
          note,
          date,
        }),
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
    <Modal open={open} onClose={handleClose} title="➖ Add Expense">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Amount (₹)">
          <input
            className="inp"
            type="number"
            min="1"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>

        <Field
          label="Payment Method"
          hint={
            wallet
              ? `Available: ₹${fmt(availBal)} (${method})`
              : undefined
          }
        >
          <TogglePill
            options={[
              { value: "cash", label: "💵 Cash" },
              { value: "online", label: "💳 Online" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </Field>

        <Field label="Category">
          <select
            className="inp"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date" hint="Select any date within the last 90 days">
          <input
            className="inp"
            type="date"
            value={date}
            min={minDateStr()}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Note (optional)">
          <input
            className="inp"
            type="text"
            placeholder="e.g. Lunch, Uber, Netflix…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </Field>

        {error && <div className="err-box">{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={submit}
            disabled={loading}
          >
            {loading && <Loader2 size={13} className="spin" />}
            Add Expense
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  txn,
  onClose,
  onSuccess,
  categories,
  wallet,
}: {
  txn: Transaction | null;
  onClose: () => void;
  onSuccess: (updated: Transaction, newWallet: WalletData) => void;
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

  useEffect(() => {
    if (txn) {
      setAmount(String(txn.amount));
      setMethod(txn.paymentMethod);
      setCategory(txn.category || "");
      setNote(txn.note || "");
      const d = new Date(txn.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      setDate(`${y}-${m}-${day}`);
      setError("");
    }
  }, [txn]);

  const submit = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Please enter a valid amount.");
    if (txn?.type === "expense" && !category)
      return setError("Category is required.");
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/transactions/${txn!._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: method,
          category: category || undefined,
          note,
          date,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to update.");
      onSuccess(data.transaction, data.wallet);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!txn}
      onClose={onClose}
      title={`✏️ Edit ${txn?.type === "expense" ? "Expense" : "Money Added"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Amount (₹)">
          <input
            className="inp"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label="Payment Method">
          <TogglePill
            options={[
              { value: "cash", label: "💵 Cash" },
              { value: "online", label: "💳 Online" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </Field>

        {txn?.type === "expense" && (
          <Field label="Category">
            <select
              className="inp"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Date">
          <input
            className="inp"
            type="date"
            value={date}
            min={minDateStr()}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <Field label="Note (optional)">
          <input
            className="inp"
            type="text"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </Field>

        {error && <div className="err-box">{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={submit}
            disabled={loading}
          >
            {loading && <Loader2 size={13} className="spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  txn,
  onClose,
  onSuccess,
}: {
  txn: Transaction | null;
  onClose: () => void;
  onSuccess: (id: string, newWallet: WalletData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/transactions/${txn!._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed to delete.");
      onSuccess(txn!._id, data.wallet);
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!txn} onClose={onClose} title="Delete Transaction">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="danger-box">
          <AlertTriangle
            size={16}
            color="var(--red)"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <div>
            <p style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500 }}>
              This will permanently delete the transaction and reverse its wallet
              effect.
            </p>
            {txn && (
              <p style={{ fontSize: 12, color: "var(--tx3)", marginTop: 6 }}>
                {txn.type === "expense"
                  ? `−₹${fmt(txn.amount)}`
                  : `+₹${fmt(txn.amount)}`}{" "}
                · {txn.category || "Money Added"} ·{" "}
                {formatDisplayDate(txn.date)}
              </p>
            )}
          </div>
        </div>

        {error && <div className="err-box">{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={confirm}
            disabled={loading}
          >
            {loading && <Loader2 size={13} className="spin" />}
            Delete Transaction
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Batch Delete Modal ───────────────────────────────────────────────────────

function BatchDeleteModal({
  ids,
  onClose,
  onSuccess,
}: {
  ids: string[];
  onClose: () => void;
  onSuccess: (deletedIds: string[], newWallet: WalletData) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/transactions/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed.");
      onSuccess(ids, data.wallet);
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={ids.length > 0}
      onClose={onClose}
      title={`Delete ${ids.length} Transaction${ids.length !== 1 ? "s" : ""}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="danger-box">
          <AlertTriangle
            size={16}
            color="var(--red)"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ fontSize: 13, color: "var(--tx)" }}>
            You're about to permanently delete{" "}
            <strong>{ids.length} transaction{ids.length !== 1 ? "s" : ""}</strong>. This will
            reverse all wallet effects and cannot be undone.
          </p>
        </div>

        {error && <div className="err-box">{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={confirm}
            disabled={loading}
          >
            {loading && <Loader2 size={13} className="spin" />}
            Delete {ids.length} item{ids.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Wallet Cards ─────────────────────────────────────────────────────────────

function WalletCards({ wallet, loading }: { wallet: WalletData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="wallet-grid" style={{ marginBottom: 22 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 88 }} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Balance",
      value: wallet?.totalBalance ?? 0,
      sub: "Cash + Online",
      icon: Wallet,
      color: "var(--ac)",
      accent: true,
    },
    {
      label: "Cash Balance",
      value: wallet?.cashBalance ?? 0,
      sub: "Physical money",
      icon: Banknote,
      color: "var(--green)",
      accent: false,
    },
    {
      label: "Online Balance",
      value: wallet?.onlineBalance ?? 0,
      sub: "UPI · Card · Net Banking",
      icon: CreditCard,
      color: "var(--blue)",
      accent: false,
    },
  ];

  return (
    <div className="wallet-grid" style={{ marginBottom: 22 }}>
      {cards.map(({ label, value, sub, icon: Icon, color, accent }) => (
        <div key={label} className={`wallet-card${accent ? " wallet-card-total" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--tx3)" }}>{label}</span>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `${color}18`,
                color,
              }}
            >
              <Icon size={14} />
            </span>
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--tx)", letterSpacing: "-0.5px" }}>
              ₹{fmt(value)}
            </p>
            <p style={{ fontSize: 11, color: "var(--tx4)", marginTop: 3 }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  wallet,
  onGoToTransactions,
}: {
  wallet: WalletData | null;
  onGoToTransactions: () => void;
}) {
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(monthStr());

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/transactions?limit=8&month=${filterMonth}`);
      const data = await res.json();
      if (data.success) setRecentTxns(data.transactions);
    } catch {}
    finally { setLoading(false); }
  }, [filterMonth]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const monthExpenses = recentTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthIncome = recentTxns.filter((t) => t.type === "add_money").reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="filter-select"
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.16)", color: "var(--red)", fontSize: 13, fontWeight: 500, alignItems: "center" }}>
          <TrendingDown size={12} />
          ₹{fmt(monthExpenses)} spent
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.16)", color: "var(--green)", fontSize: 13, fontWeight: 500 }}>
          <TrendingUp size={12} />
          ₹{fmt(monthIncome)} added
        </div>
      </div>

      <div className="surface" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>
            <Activity size={14} color="var(--ac)" />
            Recent Transactions
          </p>
          <button className="btn btn-ghost btn-sm" onClick={onGoToTransactions}>
            View all →
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : recentTxns.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <Tag size={28} />
            <p>No transactions for this month yet.</p>
            <p style={{ fontSize: 12, color: "var(--tx4)" }}>Add money to your wallet or log an expense.</p>
          </div>
        ) : (
          <div>
            {recentTxns.map((txn) => {
              const isExp = txn.type === "expense";
              return (
                <div key={txn._id} className="txn-list-item">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: isExp ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)", color: isExp ? "var(--red)" : "var(--green)", flexShrink: 0 }}>
                      {isExp ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                    </span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)" }}>
                        {txn.category || "Money Added"}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--tx4)", marginTop: 2 }}>
                        {txn.paymentMethod === "cash" ? "Cash" : "Online"}
                        {txn.note ? ` · ${txn.note}` : ""}
                        {" · "}
                        {formatDisplayDate(txn.date)}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: isExp ? "var(--red)" : "var(--green)", letterSpacing: "-0.3px" }}>
                    {isExp ? "−" : "+"}₹{fmt(txn.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({
  categories,
  wallet,
  onWalletUpdate,
}: {
  categories: string[];
  wallet: WalletData | null;
  onWalletUpdate: (w: WalletData) => void;
}) {
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
    p.set("page", String(page));
    p.set("limit", "15");
    if (filterType) p.set("type", filterType);
    if (filterMethod) p.set("paymentMethod", filterMethod);
    if (filterCategory) p.set("category", filterCategory);
    if (filterMonth) p.set("month", filterMonth);
    if (search) p.set("search", search);
    try {
      const res = await fetch(`/api/expenses/transactions?${p}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setTotalPages(data.pagination.pages || 1);
      }
    } catch {}
    finally { setLoading(false); }
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
    setTransactions((ts) => ts.map((t) => (t._id === updated._id ? updated : t)));
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, editsRemaining: Math.max(0, (s.editsRemaining ?? 20) - 1) }));
  };

  const handleDeleteSuccess = (id: string, newWallet: WalletData) => {
    setTransactions((ts) => ts.filter((t) => t._id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, deletesRemaining: Math.max(0, (s.deletesRemaining ?? 20) - 1) }));
  };

  const handleBatchDeleteSuccess = (deletedIds: string[], newWallet: WalletData) => {
    setTransactions((ts) => ts.filter((t) => !deletedIds.includes(t._id)));
    setSelected(new Set());
    onWalletUpdate(newWallet);
    setRlStatus((s) => ({ ...s, deletesRemaining: Math.max(0, (s.deletesRemaining ?? 20) - deletedIds.length) }));
  };

  const isAllSelected = transactions.length > 0 && selected.size === transactions.length;

  const renderDesktopRow = (txn: Transaction) => {
    const isExp = txn.type === "expense";
    const isSel = selected.has(txn._id);
    return (
      <tr key={txn._id} className={`txn-row${isSel ? " selected" : ""}`}>
        <td style={{ width: 42 }}>
          <div className="cb" onClick={() => toggleSelect(txn._id)}>
            {isSel ? <CheckSquare size={14} color="var(--ac)" /> : <Square size={14} color="var(--tx4)" />}
          </div>
        </td>
        <td style={{ color: "var(--tx3)", fontSize: 12, whiteSpace: "nowrap" }}>{formatDisplayDate(txn.date)}</td>
        <td>
          <span className={`badge ${isExp ? "badge-expense" : "badge-income"}`}>
            {isExp ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
            {isExp ? "Expense" : "Added"}
          </span>
        </td>
        <td style={{ color: "var(--tx)", fontSize: 13 }}>
          {txn.category || <span style={{ color: "var(--tx4)" }}>—</span>}
        </td>
        <td>
          <span className="badge badge-method">
            {txn.paymentMethod === "cash" ? <Banknote size={10} /> : <CreditCard size={10} />}
            {txn.paymentMethod === "cash" ? "Cash" : "Online"}
          </span>
        </td>
        <td style={{ color: "var(--tx4)", fontSize: 12, maxWidth: 140 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {txn.note || <span style={{ color: "var(--tx4)" }}>—</span>}
          </span>
        </td>
        <td style={{ fontWeight: 600, whiteSpace: "nowrap", color: isExp ? "var(--red)" : "var(--green)", fontSize: 13 }}>
          {isExp ? "−" : "+"}₹{fmt(txn.amount)}
        </td>
        <td>
          <div style={{ display: "flex", gap: 5 }}>
            <button className="btn btn-icon" title="Edit" onClick={() => setEditTxn(txn)}><Pencil size={11} /></button>
            <button className="btn btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleteTxn(txn)}><Trash2 size={11} /></button>
          </div>
        </td>
      </tr>
    );
  };

  const renderMobileCard = (txn: Transaction) => {
    const isExp = txn.type === "expense";
    const isSel = selected.has(txn._id);
    return (
      <div key={txn._id} className={`txn-card${isSel ? " selected" : ""}`}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div className="cb" onClick={() => toggleSelect(txn._id)} style={{ marginTop: 3 }}>
            {isSel ? <CheckSquare size={14} color="var(--ac)" /> : <Square size={14} color="var(--tx4)" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{txn.category || "Money Added"}</span>
                <span className={`badge ${isExp ? "badge-expense" : "badge-income"}`}>{isExp ? "Expense" : "Added"}</span>
                <span className="badge badge-method">{txn.paymentMethod}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: isExp ? "var(--red)" : "var(--green)", flexShrink: 0 }}>
                {isExp ? "−" : "+"}₹{fmt(txn.amount)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 11, color: "var(--tx4)" }}>
                {formatDisplayDate(txn.date)}{txn.note ? ` · ${txn.note}` : ""}
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                <button className="btn btn-icon" style={{ width: 26, height: 26 }} onClick={() => setEditTxn(txn)}><Pencil size={10} /></button>
                <button className="btn btn-icon btn-icon-danger" style={{ width: 26, height: 26 }} onClick={() => setDeleteTxn(txn)}><Trash2 size={10} /></button>
              </div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--sf)", border: "1.5px solid var(--b1)", borderRadius: "var(--radius-sm)", padding: "8px 12px", flex: 1, minWidth: 180 }}>
          <Search size={13} color="var(--tx4)" />
          <input
            type="text"
            placeholder="Search by note or category…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--tx)", width: "100%", fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx4)", display: "flex", padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </div>

        <input className="filter-select" type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1); }} />

        <select className="filter-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="add_money">Money Added</option>
        </select>

        <select className="filter-select" value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}>
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>

        <select className="filter-select" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      {/* Batch bar */}
      {selected.size > 0 && (
        <div className="batch-bar">
          <CheckSquare size={13} color="var(--ac)" />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--tx)" }}>{selected.size} selected</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-danger btn-sm" onClick={() => setBatchDeleteIds(Array.from(selected))}>
              <Trash2 size={12} /> Delete {selected.size}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              <X size={12} /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="txn-table-wrap surface" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 52 }}>
            <Loader2 size={22} color="var(--ac)" className="spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <Tag size={26} />
            <p>No transactions found</p>
            <p style={{ fontSize: 12 }}>Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="txn-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <div className="cb" onClick={toggleAll}>
                      {isAllSelected ? <CheckSquare size={14} color="var(--ac)" /> : <Square size={14} color="var(--tx4)" />}
                    </div>
                  </th>
                  {["Date", "Type", "Category", "Method", "Note", "Amount", ""].map((h) => (<th key={h}>{h}</th>))}
                </tr>
              </thead>
              <tbody>{transactions.map(renderDesktopRow)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="txn-mobile">
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Loader2 size={22} color="var(--ac)" className="spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state"><Tag size={24} /><p>No transactions found</p></div>
        ) : (
          <>
            <div className="cb" onClick={toggleAll} style={{ fontSize: 12, color: "var(--tx3)", gap: 6, padding: "4px 0" }}>
              {isAllSelected ? <CheckSquare size={13} color="var(--ac)" /> : <Square size={13} color="var(--tx4)" />}
              Select all
            </div>
            {transactions.map(renderMobileCard)}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={14} /></button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={14} /></button>
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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <Loader2 size={26} color="var(--ac)" className="spin" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, categoryBreakdown, monthlyTrend, insights, paymentMethodBreakdown } = data;
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.amount), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input className="filter-select" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {summary.expenseCount > 0 && (
          <span style={{ fontSize: 12, color: "var(--tx4)", background: "var(--sf)", border: "1px solid var(--b1)", padding: "5px 10px", borderRadius: 7 }}>
            {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""} this month
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="summary-4col">
        {[
          { label: "Total Spent", value: fmt(summary.totalSpent), color: "var(--red)", icon: TrendingDown },
          { label: "Total Added", value: fmt(summary.totalAdded), color: "var(--green)", icon: TrendingUp },
          { label: "Cash Spent", value: fmt(summary.cashSpent), color: "var(--amber)", icon: Banknote },
          { label: "Online Spent", value: fmt(summary.onlineSpent), color: "var(--blue)", icon: CreditCard },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="surface" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: "var(--tx4)" }}>{label}</p>
              <span style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, color }}>
                <Icon size={12} />
              </span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.5px" }}>₹{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="analysis-2col">
        <div className="surface" style={{ padding: 20 }}>
          <p className="section-title"><Layers size={14} color="var(--ac)" />Spending by Category</p>
          {categoryBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 0" }}><p>No expenses this month</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {categoryBreakdown.slice(0, 7).map(({ category, amount }, i) => {
                const pct = Math.round((amount / summary.totalSpent) * 100);
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <div key={category}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ color: "var(--tx2)" }}>{category}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: "var(--tx4)", fontSize: 11 }}>{pct}%</span>
                        <span style={{ color: "var(--tx)", fontWeight: 600, fontSize: 12 }}>₹{fmt(amount)}</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="surface" style={{ padding: 20 }}>
          <p className="section-title"><BarChart3 size={14} color="var(--ac)" />6-Month Spending Trend</p>
          {monthlyTrend.every((m) => m.amount === 0) ? (
            <div className="empty-state" style={{ padding: "30px 0" }}><p>No data available</p></div>
          ) : (
            <div className="bar-chart">
              {monthlyTrend.map(({ month: m, amount }, i) => {
                const h = maxTrend > 0 ? (amount / maxTrend) * 100 : 0;
                const isCurr = i === monthlyTrend.length - 1;
                const shortMonth = m.split(" ")[0];
                return (
                  <div key={m} className="bar-wrap">
                    <div className="bar-col">
                      <div
                        className="bar"
                        title={`${m}: ₹${fmt(amount)}`}
                        style={{
                          height: `${Math.max(h, amount > 0 ? 5 : 0)}%`,
                          background: isCurr ? "linear-gradient(180deg, var(--ac), var(--ac-d))" : "var(--sf3)",
                          border: isCurr ? "none" : "1px solid var(--b1)",
                        }}
                      />
                    </div>
                    <span className="bar-label" style={{ color: isCurr ? "var(--ac)" : "var(--tx4)" }}>{shortMonth}</span>
                    {amount > 0 && <span className="bar-amt">₹{fmt(amount)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cash vs Online */}
      {summary.totalSpent > 0 && (
        <div className="surface" style={{ padding: 20 }}>
          <p className="section-title"><DollarSign size={14} color="var(--ac)" />Cash vs Online Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {paymentMethodBreakdown.map(({ method, amount }) => {
              const pct = Math.round((amount / summary.totalSpent) * 100);
              const color = method === "Cash" ? "var(--amber)" : "var(--blue)";
              return (
                <div key={method}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--tx2)", fontWeight: 500 }}>
                      {method === "Cash" ? <Banknote size={13} color={color} /> : <CreditCard size={13} color={color} />}
                      {method}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--tx4)" }}>{pct}%</span>
                      <span style={{ fontWeight: 700, color, fontSize: 14 }}>₹{fmt(amount)}</span>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="surface" style={{ padding: 20 }}>
          <p className="section-title"><Lightbulb size={14} color="var(--amber)" />Smart Insights</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((insight, i) => (
              <div key={i} className="insight-item">
                <span className="insight-dot" />
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avg daily */}
      {summary.totalSpent > 0 && (
        <div className="surface" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={14} color="var(--ac)" />
            <span style={{ fontSize: 13, color: "var(--tx2)" }}>Average daily spend this month</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--tx)", letterSpacing: "-0.3px" }}>
            ₹{fmtDec(summary.averageDailySpend)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Manage Tab (Categories) ──────────────────────────────────────────────────

function ManageTab({
  categories,
  onCategoriesUpdate,
}: {
  categories: string[];
  onCategoriesUpdate: () => void;
}) {
  const [newCat, setNewCat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addCategory = async () => {
    setError(""); setSuccess("");
    if (!newCat.trim()) return setError("Please enter a category name.");
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCat.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Failed.");
      setNewCat("");
      setSuccess(`"${data.category}" added successfully.`);
      onCategoriesUpdate();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="surface" style={{ padding: 20 }}>
        <p className="section-title"><Tag size={14} color="var(--ac)" />Add Custom Category</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="inp"
            type="text"
            placeholder="e.g. Gym, Subscriptions, Investment…"
            value={newCat}
            onChange={(e) => { setNewCat(e.target.value); setError(""); setSuccess(""); }}
            maxLength={50}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={addCategory} disabled={loading} style={{ flexShrink: 0 }}>
            {loading && <Loader2 size={13} className="spin" />}
            Add
          </button>
        </div>
        {error && <div className="err-box" style={{ marginTop: 10 }}>{error}</div>}
        {success && (
          <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "var(--green)", fontSize: 13 }}>
            ✓ {success}
          </div>
        )}
      </div>

      <div className="surface" style={{ padding: 20 }}>
        <p className="section-title"><Layers size={14} color="var(--ac)" />All Categories ({categories.length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.map((cat, i) => (
            <span key={cat} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "var(--sf2)", border: "1px solid var(--b1)", color: "var(--tx2)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "analysis" | "manage">("overview");
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses/wallet");
      const data = await res.json();
      if (data.success) setWallet(data.wallet);
    } catch {}
    finally { setWalletLoading(false); }
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
    { key: "manage" as const, label: "Categories", icon: Tag },
  ];

  return (
    <>
      <Styles />
      <div className="exp-root">
        <AddMoneyModal
          open={addMoneyOpen}
          onClose={() => setAddMoneyOpen(false)}
          onSuccess={(w) => { setWallet(w); setAddMoneyOpen(false); }}
        />
        <AddExpenseModal
          open={addExpenseOpen}
          onClose={() => setAddExpenseOpen(false)}
          onSuccess={(w) => { setWallet(w); setAddExpenseOpen(false); }}
          categories={categories}
          wallet={wallet}
        />

        <div className="exp-page">
          <div className="page-header">
            <div>
              <h1 className="page-title">Expense Tracker</h1>
              <p className="page-sub">Manage your wallet and track spending</p>
            </div>
            <div className="page-header-actions">
              <button className="btn btn-green" onClick={() => setAddMoneyOpen(true)}>
                <PlusCircle size={14} />
                Add Money
              </button>
              <button className="btn btn-primary" onClick={() => setAddExpenseOpen(true)}>
                <MinusCircle size={14} />
                Add Expense
              </button>
            </div>
          </div>

          <WalletCards wallet={wallet} loading={walletLoading} />

          <div style={{ marginBottom: 20, overflowX: "auto" }}>
            <div className="tab-nav">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={`tab-btn${activeTab === key ? " active" : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fade-in" key={activeTab}>
            {activeTab === "overview" && <OverviewTab wallet={wallet} onGoToTransactions={() => setActiveTab("transactions")} />}
            {activeTab === "transactions" && <TransactionsTab categories={categories} wallet={wallet} onWalletUpdate={setWallet} />}
            {activeTab === "analysis" && <AnalysisTab />}
            {activeTab === "manage" && <ManageTab categories={categories} onCategoriesUpdate={fetchCategories} />}
          </div>
        </div>
      </div>
    </>
  );
}