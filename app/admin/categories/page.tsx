// app/admin/categories/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Tag,
  AlertTriangle,
  Loader2,
  RefreshCw,
  GripVertical,
  CheckCircle,
  Archive,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  _id:          string;
  name:         string;
  slug:         string;
  description:  string;
  displayOrder: number;
  status:       "active" | "archived" | "deleted";
  createdAt:    string;
}

type StatusFilter = "all" | "active" | "archived" | "deleted";

// ── Shared style helpers ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        "100%",
  background:   "var(--bg)",
  border:       "1px solid var(--border2)",
  borderRadius: "10px",
  padding:      "9px 13px",
  fontSize:     "13.5px",
  color:        "var(--text)",
  outline:      "none",
};

const labelStyle: React.CSSProperties = {
  display:       "block",
  fontSize:      "11px",
  fontWeight:    600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color:         "var(--text3)",
  marginBottom:  "6px",
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Category["status"] }) {
  const map = {
    active:   { color: "var(--green)",  bg: "rgba(34,211,160,0.10)",  label: "Active"   },
    archived: { color: "var(--amber)",  bg: "rgba(245,158,11,0.10)",  label: "Archived" },
    deleted:  { color: "var(--danger)", bg: "rgba(248,113,113,0.10)", label: "Deleted"  },
  };
  const s = map[status] ?? map.active;
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "5px",
        padding:      "3px 10px",
        borderRadius: "999px",
        fontSize:     "11.5px",
        fontWeight:   600,
        color:        s.color,
        background:   s.bg,
        border:       `1px solid ${s.color}30`,
        whiteSpace:   "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  category,
  onConfirm,
  onCancel,
  loading,
}: {
  category: Category;
  onConfirm: () => void;
  onCancel:  () => void;
  loading:   boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(248,113,113,0.13)" }}
          >
            <AlertTriangle size={22} style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>
              Delete Category
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              You are about to delete{" "}
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                &quot;{category.name}&quot;
              </span>
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 text-[13px] leading-relaxed"
          style={{
            background: "rgba(248,113,113,0.07)",
            border:     "1px solid rgba(248,113,113,0.22)",
            color:      "var(--danger)",
          }}
        >
          ⚠️{" "}
          <strong>This action is permanent and cannot be undone.</strong> Deleting this category will
          automatically remove all related subcategories, levels, and questions from the system.
        </div>

        <div className="flex gap-3 justify-end flex-wrap">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
            style={{ background: "var(--danger)", color: "#fff", opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Deleting…" : "Yes, Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  category,
  onSave,
  onClose,
  loading,
}: {
  category: Category;
  onSave:   (id: string, data: Partial<Category>) => void;
  onClose:  () => void;
  loading:  boolean;
}) {
  const [name,         setName]         = useState(category.name);
  const [description,  setDescription]  = useState(category.description);
  const [displayOrder, setDisplayOrder] = useState(String(category.displayOrder));
  const [status,       setStatus]       = useState<Category["status"]>(category.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())             { toast.error("Name is required");             return; }
    if (name.trim().length > 80)  { toast.error("Name max 80 characters");       return; }
    if (description.length > 500) { toast.error("Description max 500 characters"); return; }
    onSave(category._id, {
      name:         name.trim(),
      description:  description.trim(),
      displayOrder: Number(displayOrder) || 0,
      status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: "var(--surface)",
          border:     "1px solid var(--border2)",
          maxHeight:  "90vh",
          overflowY:  "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(232,67,147,0.13)" }}
            >
              <Pencil size={15} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>Edit Category</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          {/* Slug read-only */}
          <div>
            <label style={labelStyle}>Slug (auto-generated)</label>
            <div
              className="rounded-xl px-3 py-2.5 text-[13px] font-mono break-all"
              style={{
                background: "var(--surface2)",
                border:     "1px solid var(--border)",
                color:      "var(--text3)",
              }}
            >
              {category.slug}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              Slug regenerates automatically when you change the name.
            </p>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>
              Category Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Logic Puzzles"
              maxLength={80}
              required
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
              {name.length}/80
            </p>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description…"
              maxLength={500}
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
              {description.length}/500
            </p>
          </div>

          {/* Order + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Display Order</label>
              <input
                type="number"
                style={inputStyle}
                value={displayOrder}
                onChange={e => setDisplayOrder(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={status}
                onChange={e => setStatus(e.target.value as Category["status"])}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
              style={{ background: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Mobile Category Card ──────────────────────────────────────────────────────
// Shown on small screens instead of the table row

function CategoryCard({
  cat,
  idx,
  onEdit,
  onDelete,
  onQuickStatusToggle,
  onOrderBlur,
  onOrderChange,
}: {
  cat:                Category;
  idx:                number;
  onEdit:             (c: Category) => void;
  onDelete:           (c: Category) => void;
  onQuickStatusToggle:(c: Category) => void;
  onOrderBlur:        (id: string, v: number) => void;
  onOrderChange:      (id: string, v: number) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background:   "var(--surface)",
        border:       "1px solid var(--border2)",
      }}
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
            {cat.name}
          </p>
          <span
            className="text-[12px] font-mono mt-1 inline-block px-2 py-0.5 rounded-lg break-all"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            {cat.slug}
          </span>
        </div>
        <StatusBadge status={cat.status} />
      </div>

      {/* Description */}
      {cat.description && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
          {cat.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
            Order
          </span>
          <input
            type="number"
            value={cat.displayOrder}
            onChange={e => onOrderChange(cat._id, Number(e.target.value))}
            onBlur={e  => onOrderBlur(cat._id, Number(e.target.value))}
            className="w-12 text-center rounded-lg border-none text-[13px] font-mono py-1"
            style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
          />
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--text4)" }}>
          {new Date(cat.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center gap-2 pt-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Quick archive/activate */}
        <button
          onClick={() => onQuickStatusToggle(cat)}
          title={cat.status === "active" ? "Archive" : "Activate"}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{
            background: cat.status === "active"
              ? "rgba(245,158,11,0.10)"
              : "rgba(34,211,160,0.10)",
            color: cat.status === "active"
              ? "var(--amber)"
              : "var(--green)",
          }}
        >
          {cat.status === "active"
            ? <><Archive size={13} /> Archive</>
            : <><CheckCircle size={13} /> Activate</>}
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit(cat)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
        >
          <Pencil size={13} /> Edit
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(cat)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {

  // ── Data state ────────────────────────────────────────────────────────────
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const LIMIT = 50;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [fetchLoading, setFetchLoading] = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── Add form state ────────────────────────────────────────────────────────
  const [addName,         setAddName]         = useState("");
  const [addDescription,  setAddDescription]  = useState("");
  const [addDisplayOrder, setAddDisplayOrder] = useState("");
  const [addStatus,       setAddStatus]       = useState<"active" | "archived">("active");
  const [addLoading,      setAddLoading]       = useState(false);
  const [addOpen,         setAddOpen]          = useState(false);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editTarget,  setEditTarget]  = useState<Category | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deleteTarget,  setDeleteTarget]  = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"displayOrder" | "name" | "createdAt">("displayOrder");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);

  // ── Debounced search ──────────────────────────────────────────────────────
  const searchTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async (pg = page) => {
    setFetchLoading(true);
    try {
      const p = new URLSearchParams({
        status: statusFilter,
        search: debouncedSearch,
        page:   String(pg),
        limit:  String(LIMIT),
      });
      const res  = await fetch(`/api/admin/categories?${p}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "Failed to load"); return; }
      setCategories(data.categories);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Network error");
    } finally {
      setFetchLoading(false);
    }
  }, [statusFilter, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchCategories(page);
  }, [statusFilter, debouncedSearch, page]); // eslint-disable-line

  // ── Add ───────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim())             { toast.error("Name is required");             return; }
    if (addName.trim().length > 80)  { toast.error("Name max 80 characters");       return; }
    if (addDescription.length > 500) { toast.error("Description max 500 characters"); return; }

    setAddLoading(true);
    try {
      const res  = await fetch("/api/admin/categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:         addName.trim(),
          description:  addDescription.trim(),
          displayOrder: Number(addDisplayOrder) || 0,
          status:       addStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(`Category "${data.category.name}" created!`);
      setAddName(""); setAddDescription(""); setAddDisplayOrder(""); setAddStatus("active");
      setAddOpen(false);
      fetchCategories(1);
      setPage(1);
    } catch {
      toast.error("Failed to create category");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit (called from modal with id + data) ───────────────────────────────
  // FIX: accepts id directly so it can be called from both the modal AND
  // inline quick-actions without relying on editTarget state being set first.

  const saveCategory = async (id: string, data: Partial<Category>) => {
    setEditLoading(true);
    try {
      const res  = await fetch(`/api/admin/categories/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("Category updated!");
      setEditTarget(null);
      // Update local state immediately so UI refreshes without full re-fetch
      setCategories(prev =>
        prev.map(c => c._id === id ? { ...c, ...data } : c)
      );
    } catch {
      toast.error("Failed to update category");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Quick status toggle (archive / activate) ──────────────────────────────
  // FIX: calls saveCategory directly — does NOT touch editTarget state at all.

  const handleQuickStatusToggle = (cat: Category) => {
    const newStatus = cat.status === "active" ? "archived" : "active";
    saveCategory(cat._id, { status: newStatus });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res  = await fetch(`/api/admin/categories/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success(`"${deleteTarget.name}" and all child data deleted.`);
      setDeleteTarget(null);
      fetchCategories(page);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Inline display-order edit (onBlur) ────────────────────────────────────

  const handleOrderBlur = async (id: string, newOrder: number) => {
    try {
      await fetch("/api/admin/categories", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates: [{ id, displayOrder: newOrder }] }),
      });
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleOrderChange = (id: string, v: number) => {
    setCategories(prev => prev.map(c => c._id === id ? { ...c, displayOrder: v } : c));
  };

  // ── Drag-and-drop reorder ─────────────────────────────────────────────────

  const onDragStart = (idx: number) => { dragIdx.current = idx; };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const reordered = [...categories];
    const [moved]   = reordered.splice(dragIdx.current, 1);
    reordered.splice(idx, 0, moved);
    dragIdx.current  = idx;
    setCategories(reordered.map((c, i) => ({ ...c, displayOrder: i })));
  };

  const onDragEnd = async () => {
    dragIdx.current = null;
    try {
      await fetch("/api/admin/categories", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          updates: categories.map(c => ({ id: c._id, displayOrder: c.displayOrder })),
        }),
      });
      toast.success("Order saved");
    } catch {
      toast.error("Failed to save order");
    }
  };

  // ── Client-side sort ──────────────────────────────────────────────────────

  const sorted = [...categories].sort((a, b) => {
    let va: string | number = a[sortField] as string | number;
    let vb: string | number = b[sortField] as string | number;
    if (sortField === "name") { va = (va as string).toLowerCase(); vb = (vb as string).toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 :  1;
    if (va > vb) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField !== field
      ? <ChevronUp   size={12} style={{ opacity: 0.3 }} />
      : sortDir === "asc"
        ? <ChevronUp   size={12} style={{ color: "var(--accent)" }} />
        : <ChevronDown size={12} style={{ color: "var(--accent)" }} />;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",      label: "All"      },
    { key: "active",   label: "Active"   },
    { key: "archived", label: "Archived" },
    { key: "deleted",  label: "Deleted"  },
  ];

  // ── Slug preview for Add form ─────────────────────────────────────────────

  const slugPreview = addName
    ? addName.toLowerCase().trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Modals ── */}
      {editTarget && (
        <EditModal
          category={editTarget}
          onSave={saveCategory}
          onClose={() => setEditTarget(null)}
          loading={editLoading}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          category={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="flex flex-col gap-5">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(232,67,147,0.13)" }}
              >
                <Tag size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-bold" style={{ color: "var(--text)" }}>
                Categories Management
              </h1>
            </div>
            <p className="text-[13px] ml-10" style={{ color: "var(--text3)" }}>
              Root of the content hierarchy → Subcategory → Level → Question
            </p>
          </div>

          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <button
              onClick={() => fetchCategories(page)}
              disabled={fetchLoading}
              className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer shrink-0"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
              title="Refresh"
            >
              <RefreshCw size={15} className={fetchLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setAddOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-semibold border-none cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {addOpen ? <X size={15} /> : <Plus size={15} />}
              <span>{addOpen ? "Cancel" : "Add Category"}</span>
            </button>
          </div>
        </div>

        {/* ── Add Category Form ── */}
        {addOpen && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h2 className="text-[14px] font-bold mb-5 flex items-center gap-2" style={{ color: "var(--text)" }}>
              <Plus size={15} style={{ color: "var(--accent)" }} />
              New Category
            </h2>

            <form onSubmit={handleAdd} className="flex flex-col gap-4">

              {/* Name + Slug preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>
                    Category Name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="e.g. Logic Puzzles"
                    maxLength={80}
                    required
                  />
                  <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
                    {addName.length}/80
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Slug Preview (auto)</label>
                  <div
                    className="rounded-xl px-3 py-2.5 text-[13px] font-mono min-h-[41px] break-all"
                    style={{
                      background: "var(--surface2)",
                      border:     "1px solid var(--border)",
                      color:      slugPreview ? "var(--text3)" : "var(--text4)",
                    }}
                  >
                    {slugPreview || "generated on save…"}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: "72px" }}
                  value={addDescription}
                  onChange={e => setAddDescription(e.target.value)}
                  placeholder="Optional description for this category…"
                  maxLength={500}
                />
                <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
                  {addDescription.length}/500
                </p>
              </div>

              {/* Order + Status + Submit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label style={labelStyle}>Display Order</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={addDisplayOrder}
                    onChange={e => setAddDisplayOrder(e.target.value)}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={addStatus}
                    onChange={e => setAddStatus(e.target.value as "active" | "archived")}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="w-full py-[9px] rounded-xl text-[13.5px] font-semibold border-none cursor-pointer flex items-center justify-center gap-2"
                    style={{ background: "var(--accent)", color: "#fff", opacity: addLoading ? 0.7 : 1 }}
                  >
                    {addLoading && <Loader2 size={14} className="animate-spin" />}
                    {addLoading ? "Creating…" : "Create Category"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text4)" }}
            />
            <input
              style={{ ...inputStyle, paddingLeft: "36px", paddingRight: search ? "36px" : "13px" }}
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 border-none cursor-pointer bg-transparent p-0"
                style={{ color: "var(--text4)" }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)", flexShrink: 0 }}
          >
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium border-none cursor-pointer whitespace-nowrap"
                style={{
                  background: statusFilter === tab.key ? "var(--accent)" : "transparent",
                  color:      statusFilter === tab.key ? "#fff"          : "var(--text3)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div
          className="rounded-xl px-4 py-2.5 flex items-center gap-4 flex-wrap"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span className="text-[12px]" style={{ color: "var(--text3)" }}>
            <strong style={{ color: "var(--text)" }}>{categories.length}</strong> of{" "}
            <strong style={{ color: "var(--text)" }}>{total}</strong> shown
          </span>
          <span className="hidden sm:inline text-[12px]" style={{ color: "var(--text3)" }}>
            Drag <GripVertical size={12} className="inline" /> to reorder
          </span>
          {totalPages > 1 && (
            <span className="text-[12px]" style={{ color: "var(--text3)" }}>
              Page <strong style={{ color: "var(--text)" }}>{page}</strong> /{" "}
              <strong style={{ color: "var(--text)" }}>{totalPages}</strong>
            </span>
          )}
        </div>

        {/* ── Loading ── */}
        {fetchLoading && (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--text3)" }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading categories…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!fetchLoading && sorted.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface2)" }}
            >
              <Tag size={24} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              {search ? "No categories match your search" : "No categories found"}
            </p>
            {!search && (
              <button
                onClick={() => setAddOpen(true)}
                className="text-[13px] font-medium border-none cursor-pointer bg-transparent"
                style={{ color: "var(--accent)" }}
              >
                + Create your first category
              </button>
            )}
          </div>
        )}

        {/* ── MOBILE CARDS (< md) ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map((cat, idx) => (
              <CategoryCard
                key={cat._id}
                cat={cat}
                idx={idx}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                onQuickStatusToggle={handleQuickStatusToggle}
                onOrderBlur={handleOrderBlur}
                onOrderChange={handleOrderChange}
              />
            ))}
          </div>
        )}

        {/* ── DESKTOP TABLE (≥ md) ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden hidden md:block"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            {/* Header */}
            <div
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: "36px 56px 1.4fr 1fr 1.4fr 100px 108px 116px",
                background:   "var(--surface2)",
                borderBottom: "1px solid var(--border2)",
              }}
            >
              {[
                { label: "",          field: null             },
                { label: "#",         field: "displayOrder"   },
                { label: "Name",      field: "name"           },
                { label: "Slug",      field: null             },
                { label: "Desc",      field: null             },
                { label: "Status",    field: null             },
                { label: "Created",   field: "createdAt"      },
                { label: "Actions",   field: null             },
              ].map(({ label, field }, i) => (
                <div key={i}>
                  {field ? (
                    <button
                      onClick={() => toggleSort(field as typeof sortField)}
                      className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                      style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
                    >
                      {label} <SortIcon field={field as typeof sortField} />
                    </button>
                  ) : (
                    <span style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((cat, idx) => (
              <div
                key={cat._id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                className="grid items-center px-4 py-3 transition-colors"
                style={{
                  gridTemplateColumns: "36px 56px 1.4fr 1fr 1.4fr 100px 108px 116px",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Drag handle */}
                <div
                  className="flex items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{ color: "var(--text4)" }}
                >
                  <GripVertical size={16} />
                </div>

                {/* Order */}
                <div>
                  <input
                    type="number"
                    value={cat.displayOrder}
                    onChange={e => handleOrderChange(cat._id, Number(e.target.value))}
                    onBlur={e  => handleOrderBlur(cat._id, Number(e.target.value))}
                    className="w-11 text-center rounded-lg border-none text-[12px] font-mono py-1"
                    style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
                  />
                </div>

                {/* Name */}
                <div className="min-w-0 pr-2">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text)" }}>
                    {cat.name}
                  </p>
                </div>

                {/* Slug */}
                <div className="min-w-0 pr-2">
                  <span
                    className="text-[11.5px] font-mono px-2 py-1 rounded-lg inline-block max-w-full truncate"
                    style={{ background: "var(--surface2)", color: "var(--text3)" }}
                    title={cat.slug}
                  >
                    {cat.slug}
                  </span>
                </div>

                {/* Description */}
                <div className="min-w-0 pr-2">
                  <p
                    className="text-[12.5px] truncate"
                    style={{ color: "var(--text3)" }}
                    title={cat.description}
                  >
                    {cat.description || <span style={{ color: "var(--text4)" }}>—</span>}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={cat.status} />
                </div>

                {/* Created */}
                <div>
                  <span className="text-[12px]" style={{ color: "var(--text4)" }}>
                    {formatDate(cat.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {/* Quick archive/activate — FIX: calls handleQuickStatusToggle, not handleEdit */}
                  <button
                    onClick={() => handleQuickStatusToggle(cat)}
                    title={cat.status === "active" ? "Archive" : "Activate"}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{
                      background: cat.status === "active"
                        ? "rgba(245,158,11,0.10)"
                        : "rgba(34,211,160,0.10)",
                      color: cat.status === "active"
                        ? "var(--amber)"
                        : "var(--green)",
                    }}
                  >
                    {cat.status === "active"
                      ? <Archive     size={14} />
                      : <CheckCircle size={14} />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setEditTarget(cat)}
                    title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    title="Delete"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-9 h-9 rounded-xl text-[13px] font-medium border-none cursor-pointer"
                  style={{
                    background: page === p ? "var(--accent)" : "var(--surface)",
                    color:      page === p ? "#fff"          : "var(--text2)",
                    border:     "1px solid var(--border2)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}