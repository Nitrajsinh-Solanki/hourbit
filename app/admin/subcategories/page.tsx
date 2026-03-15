// app/admin/subcategories/page.tsx
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
  Layers,
  AlertTriangle,
  Loader2,
  RefreshCw,
  GripVertical,
  CheckCircle,
  Archive,
  Tag,
  ChevronDown as SelectArrow,
  FolderOpen,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Category {
  _id:         string;
  name:        string;
  slug:        string;
  status:      string;
  displayOrder: number;
}

interface Subcategory {
  _id:          string;
  categoryId:   string;
  name:         string;
  slug:         string;
  displayOrder: number;
  status:       "active" | "archived" | "deleted";
  createdAt:    string;
}

type StatusFilter = "all" | "active" | "archived" | "deleted";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLE HELPERS  (identical to categories page)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Subcategory["status"] }) {
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
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: s.color, flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({
  sub,
  onConfirm,
  onCancel,
  loading,
}: {
  sub:       Subcategory;
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
        {/* Icon + title */}
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(248,113,113,0.13)" }}
          >
            <AlertTriangle size={22} style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>
              Delete Subcategory
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              You are about to delete{" "}
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                &quot;{sub.name}&quot;
              </span>
            </p>
          </div>
        </div>

        {/* Warning */}
        <div
          className="rounded-xl p-4 text-[13px] leading-relaxed"
          style={{
            background: "rgba(248,113,113,0.07)",
            border:     "1px solid rgba(248,113,113,0.22)",
            color:      "var(--danger)",
          }}
        >
          ⚠️{" "}
          <strong>This action is permanent and cannot be undone.</strong> Deleting this subcategory
          will automatically remove all related levels and questions from the system.
        </div>

        {/* Buttons */}
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

// ─────────────────────────────────────────────────────────────────────────────
// EDIT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function EditModal({
  sub,
  categories,
  onSave,
  onClose,
  loading,
}: {
  sub:        Subcategory;
  categories: Category[];
  onSave:     (id: string, data: Partial<Subcategory> & { categoryId?: string }) => void;
  onClose:    () => void;
  loading:    boolean;
}) {
  const [name,         setName]         = useState(sub.name);
  const [categoryId,   setCategoryId]   = useState(sub.categoryId);
  const [displayOrder, setDisplayOrder] = useState(String(sub.displayOrder));
  const [status,       setStatus]       = useState<Subcategory["status"]>(sub.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())            { toast.error("Name is required");          return; }
    if (name.trim().length > 80) { toast.error("Name max 80 characters");    return; }
    if (!categoryId)             { toast.error("Select a parent category");  return; }
    onSave(sub._id, {
      name:         name.trim(),
      categoryId,
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
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", zIndex: 1 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(232,67,147,0.13)" }}
            >
              <Pencil size={15} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
              Edit Subcategory
            </h2>
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
              {sub.slug}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              Slug regenerates automatically when you change the name.
            </p>
          </div>

          {/* Parent Category */}
          <div>
            <label style={labelStyle}>
              Parent Category <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              required
            >
              <option value="">— Select Category —</option>
              {categories.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              Changing category will move this subcategory under the new parent.
            </p>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>
              Subcategory Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Verbal Reasoning"
              maxLength={80}
              required
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
              {name.length}/80
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
                onChange={e => setStatus(e.target.value as Subcategory["status"])}
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

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ─────────────────────────────────────────────────────────────────────────────

function SubcategoryCard({
  sub,
  onEdit,
  onDelete,
  onQuickStatusToggle,
  onOrderBlur,
  onOrderChange,
}: {
  sub:                 Subcategory;
  onEdit:              (s: Subcategory) => void;
  onDelete:            (s: Subcategory) => void;
  onQuickStatusToggle: (s: Subcategory) => void;
  onOrderBlur:         (id: string, v: number) => void;
  onOrderChange:       (id: string, v: number) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      {/* Name + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
            {sub.name}
          </p>
          <span
            className="text-[12px] font-mono mt-1 inline-block px-2 py-0.5 rounded-lg break-all"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            {sub.slug}
          </span>
        </div>
        <StatusBadge status={sub.status} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text4)" }}
          >
            Order
          </span>
          <input
            type="number"
            value={sub.displayOrder}
            onChange={e => onOrderChange(sub._id, Number(e.target.value))}
            onBlur={e  => onOrderBlur(sub._id,   Number(e.target.value))}
            className="w-12 text-center rounded-lg border-none text-[13px] font-mono py-1"
            style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
          />
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--text4)" }}>
          {new Date(sub.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </span>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 pt-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={() => onQuickStatusToggle(sub)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{
            background: sub.status === "active" ? "rgba(245,158,11,0.10)" : "rgba(34,211,160,0.10)",
            color:      sub.status === "active" ? "var(--amber)"          : "var(--green)",
          }}
        >
          {sub.status === "active"
            ? <><Archive size={13} /> Archive</>
            : <><CheckCircle size={13} /> Activate</>}
        </button>
        <button
          onClick={() => onEdit(sub)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => onDelete(sub)}
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

export default function SubcategoriesPage() {

  // ── Categories list (for selector + edit modal) ────────────────────────────
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [catsLoading,    setCatsLoading]    = useState(true);
  const [selectedCatId,  setSelectedCatId]  = useState<string>("");

  // Selected category display name
  const selectedCat = categories.find(c => c._id === selectedCatId) ?? null;

  // ── Subcategories data ─────────────────────────────────────────────────────
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const LIMIT = 50;

  // ── UI state ───────────────────────────────────────────────────────────────
  const [fetchLoading,  setFetchLoading]  = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");

  // ── Add form ───────────────────────────────────────────────────────────────
  const [addName,         setAddName]         = useState("");
  const [addCategoryId,   setAddCategoryId]   = useState("");
  const [addDisplayOrder, setAddDisplayOrder] = useState("");
  const [addStatus,       setAddStatus]       = useState<"active" | "archived">("active");
  const [addLoading,      setAddLoading]      = useState(false);
  const [addOpen,         setAddOpen]         = useState(false);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editTarget,  setEditTarget]  = useState<Subcategory | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteTarget,  setDeleteTarget]  = useState<Subcategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"displayOrder" | "name" | "createdAt">("displayOrder");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");

  // ── Drag state ─────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);

  // ── Debounced search ───────────────────────────────────────────────────────
  const searchTimer                           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Fetch all active categories for dropdowns ──────────────────────────────

  useEffect(() => {
    const fetchCats = async () => {
      setCatsLoading(true);
      try {
        const res  = await fetch("/api/admin/categories?status=active&limit=200");
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories);
          // Pre-select first active category if none selected
          if (!selectedCatId && data.categories.length > 0) {
            setSelectedCatId(data.categories[0]._id);
            setAddCategoryId(data.categories[0]._id);
          }
        }
      } catch {
        toast.error("Failed to load categories");
      } finally {
        setCatsLoading(false);
      }
    };
    fetchCats();
  }, []); // eslint-disable-line

  // ── Fetch subcategories whenever filter or category changes ────────────────

  const fetchSubcategories = useCallback(async (pg = page) => {
    if (!selectedCatId) { setSubcategories([]); setTotal(0); return; }
    setFetchLoading(true);
    try {
      const p = new URLSearchParams({
        categoryId: selectedCatId,
        status:     statusFilter,
        search:     debouncedSearch,
        page:       String(pg),
        limit:      String(LIMIT),
      });
      const res  = await fetch(`/api/admin/subcategories?${p}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "Failed to load"); return; }
      setSubcategories(data.subcategories);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Network error");
    } finally {
      setFetchLoading(false);
    }
  }, [selectedCatId, statusFilter, debouncedSearch, page]);

  // Reset page on filter/category/search change
  useEffect(() => { setPage(1); }, [selectedCatId, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchSubcategories(page);
  }, [selectedCatId, statusFilter, debouncedSearch, page]); // eslint-disable-line

  // ── Slug preview helper ────────────────────────────────────────────────────

  const toSlug = (str: string) =>
    str.toLowerCase().trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-+|-+$/g, "");

  // ── Add ────────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const catId = addCategoryId || selectedCatId;
    if (!catId)              { toast.error("Select a parent category"); return; }
    if (!addName.trim())     { toast.error("Name is required");         return; }
    if (addName.trim().length > 80) { toast.error("Name max 80 characters"); return; }

    setAddLoading(true);
    try {
      const res  = await fetch("/api/admin/subcategories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          categoryId:   catId,
          name:         addName.trim(),
          displayOrder: Number(addDisplayOrder) || 0,
          status:       addStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(`Subcategory "${data.subcategory.name}" created!`);
      setAddName(""); setAddDisplayOrder(""); setAddStatus("active");
      setAddOpen(false);
      // If the new sub belongs to currently selected cat, refresh
      if (catId === selectedCatId) { fetchSubcategories(1); setPage(1); }
    } catch {
      toast.error("Failed to create subcategory");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Save (from edit modal) ─────────────────────────────────────────────────

  const saveSubcategory = async (
    id:   string,
    data: Partial<Subcategory> & { categoryId?: string }
  ) => {
    setEditLoading(true);
    try {
      const res  = await fetch(`/api/admin/subcategories/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("Subcategory updated!");
      setEditTarget(null);
      // If category was moved away from current view, remove from list
      // otherwise update in-place
      if (data.categoryId && data.categoryId !== selectedCatId) {
        setSubcategories(prev => prev.filter(s => s._id !== id));
        setTotal(t => t - 1);
      } else {
        setSubcategories(prev =>
          prev.map(s => s._id === id ? { ...s, ...data } : s)
        );
      }
    } catch {
      toast.error("Failed to update subcategory");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Quick status toggle ────────────────────────────────────────────────────

  const handleQuickStatusToggle = (sub: Subcategory) => {
    const newStatus = sub.status === "active" ? "archived" : "active";
    saveSubcategory(sub._id, { status: newStatus });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res  = await fetch(`/api/admin/subcategories/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success(`"${deleteTarget.name}" and all child data deleted.`);
      setDeleteTarget(null);
      fetchSubcategories(page);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Inline order ───────────────────────────────────────────────────────────

  const handleOrderBlur = async (id: string, newOrder: number) => {
    try {
      await fetch("/api/admin/subcategories", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates: [{ id, displayOrder: newOrder }] }),
      });
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleOrderChange = (id: string, v: number) => {
    setSubcategories(prev => prev.map(s => s._id === id ? { ...s, displayOrder: v } : s));
  };

  // ── Drag reorder ───────────────────────────────────────────────────────────

  const onDragStart = (idx: number) => { dragIdx.current = idx; };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const reordered  = [...subcategories];
    const [moved]    = reordered.splice(dragIdx.current, 1);
    reordered.splice(idx, 0, moved);
    dragIdx.current  = idx;
    setSubcategories(reordered.map((s, i) => ({ ...s, displayOrder: i })));
  };

  const onDragEnd = async () => {
    dragIdx.current = null;
    try {
      await fetch("/api/admin/subcategories", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          updates: subcategories.map(s => ({ id: s._id, displayOrder: s.displayOrder })),
        }),
      });
      toast.success("Order saved");
    } catch {
      toast.error("Failed to save order");
    }
  };

  // ── Sort ───────────────────────────────────────────────────────────────────

  const sorted = [...subcategories].sort((a, b) => {
    let va: string | number = a[sortField] as string | number;
    let vb: string | number = b[sortField] as string | number;
    if (sortField === "name") {
      va = (va as string).toLowerCase();
      vb = (vb as string).toLowerCase();
    }
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

  const slugPreview = toSlug(addName);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Modals ── */}
      {editTarget && (
        <EditModal
          sub={editTarget}
          categories={categories}
          onSave={saveSubcategory}
          onClose={() => setEditTarget(null)}
          loading={editLoading}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          sub={deleteTarget}
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
                <Layers size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-bold" style={{ color: "var(--text)" }}>
                Subcategories Management
              </h1>
            </div>
            <p className="text-[13px] ml-10" style={{ color: "var(--text3)" }}>
              Category → <strong style={{ color: "var(--accent)" }}>Subcategory</strong> → Level → Question
            </p>
          </div>

          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <button
              onClick={() => fetchSubcategories(page)}
              disabled={fetchLoading || !selectedCatId}
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
              <span>{addOpen ? "Cancel" : "Add Subcategory"}</span>
            </button>
          </div>
        </div>

        {/* ── Category Selector ── */}
        <div
          className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Tag size={15} style={{ color: "var(--accent)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--text2)" }}>
              Filter by Category
            </span>
          </div>

          <div className="flex-1 w-full sm:max-w-xs">
            {catsLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--text3)" }}>
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[13px]">Loading categories…</span>
              </div>
            ) : categories.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--danger)" }}>
                No active categories found. Create a category first.
              </p>
            ) : (
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={selectedCatId}
                onChange={e => {
                  setSelectedCatId(e.target.value);
                  setAddCategoryId(e.target.value);
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                <option value="">— Select a category —</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Active category chip */}
          {selectedCat && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-semibold shrink-0"
              style={{
                background: "rgba(232,67,147,0.10)",
                border:     "1px solid rgba(232,67,147,0.25)",
                color:      "var(--accent)",
              }}
            >
              <FolderOpen size={13} />
              {selectedCat.name}
            </div>
          )}
        </div>

        {/* ── Add Subcategory Form ── */}
        {addOpen && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h2
              className="text-[14px] font-bold mb-5 flex items-center gap-2"
              style={{ color: "var(--text)" }}
            >
              <Plus size={15} style={{ color: "var(--accent)" }} />
              New Subcategory
            </h2>

            <form onSubmit={handleAdd} className="flex flex-col gap-4">

              {/* Parent category + Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>
                    Parent Category <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={addCategoryId}
                    onChange={e => setAddCategoryId(e.target.value)}
                    required
                  >
                    <option value="">— Select Category —</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Subcategory Name <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="e.g. Verbal Reasoning"
                    maxLength={80}
                    required
                  />
                  <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
                    {addName.length}/80
                  </p>
                </div>
              </div>

              {/* Slug preview */}
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
                    {addLoading ? "Creating…" : "Create Subcategory"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── No Category Selected State ── */}
        {!selectedCatId && !catsLoading && (
          <div
            className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface2)" }}
            >
              <FolderOpen size={26} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              Select a category above to manage its subcategories
            </p>
          </div>
        )}

        {/* ── Search + Filter (only shown when a category is selected) ── */}
        {selectedCatId && (
          <>
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
                  placeholder="Search subcategories by name…"
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

              {/* Status filter tabs */}
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

            {/* Stats bar */}
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-4 flex-wrap"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                <strong style={{ color: "var(--text)" }}>{subcategories.length}</strong> of{" "}
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
          </>
        )}

        {/* ── Loading ── */}
        {fetchLoading && (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--text3)" }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading subcategories…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!fetchLoading && selectedCatId && sorted.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--surface2)" }}
            >
              <Layers size={24} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              {search
                ? "No subcategories match your search"
                : `No subcategories in "${selectedCat?.name ?? ""}"`}
            </p>
            {!search && (
              <button
                onClick={() => setAddOpen(true)}
                className="text-[13px] font-medium border-none cursor-pointer bg-transparent"
                style={{ color: "var(--accent)" }}
              >
                + Create the first subcategory
              </button>
            )}
          </div>
        )}

        {/* ── MOBILE CARDS (< md) ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map(sub => (
              <SubcategoryCard
                key={sub._id}
                sub={sub}
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
                gridTemplateColumns: "36px 56px 1.6fr 1fr 100px 108px 116px",
                background:          "var(--surface2)",
                borderBottom:        "1px solid var(--border2)",
              }}
            >
              {([
                { label: "",        field: null           },
                { label: "#",       field: "displayOrder" },
                { label: "Name",    field: "name"         },
                { label: "Slug",    field: null           },
                { label: "Status",  field: null           },
                { label: "Created", field: "createdAt"    },
                { label: "Actions", field: null           },
              ] as { label: string; field: string | null }[]).map(({ label, field }, i) => (
                <div key={i}>
                  {field ? (
                    <button
                      onClick={() => toggleSort(field as typeof sortField)}
                      className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                      style={{
                        color:         "var(--text4)",
                        fontSize:      "11px",
                        fontWeight:    700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {label} <SortIcon field={field as typeof sortField} />
                    </button>
                  ) : (
                    <span
                      style={{
                        color:         "var(--text4)",
                        fontSize:      "11px",
                        fontWeight:    700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((sub, idx) => (
              <div
                key={sub._id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                className="grid items-center px-4 py-3 transition-colors"
                style={{
                  gridTemplateColumns: "36px 56px 1.6fr 1fr 100px 108px 116px",
                  borderBottom:        "1px solid var(--border)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent";     }}
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
                    value={sub.displayOrder}
                    onChange={e => handleOrderChange(sub._id, Number(e.target.value))}
                    onBlur={e  => handleOrderBlur(sub._id,   Number(e.target.value))}
                    className="w-11 text-center rounded-lg border-none text-[12px] font-mono py-1"
                    style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
                  />
                </div>

                {/* Name */}
                <div className="min-w-0 pr-2">
                  <p className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text)" }}>
                    {sub.name}
                  </p>
                </div>

                {/* Slug */}
                <div className="min-w-0 pr-2">
                  <span
                    className="text-[11.5px] font-mono px-2 py-1 rounded-lg inline-block max-w-full truncate"
                    style={{ background: "var(--surface2)", color: "var(--text3)" }}
                    title={sub.slug}
                  >
                    {sub.slug}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={sub.status} />
                </div>

                {/* Created */}
                <div>
                  <span className="text-[12px]" style={{ color: "var(--text4)" }}>
                    {formatDate(sub.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {/* Quick archive / activate */}
                  <button
                    onClick={() => handleQuickStatusToggle(sub)}
                    title={sub.status === "active" ? "Archive" : "Activate"}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{
                      background: sub.status === "active"
                        ? "rgba(245,158,11,0.10)"
                        : "rgba(34,211,160,0.10)",
                      color: sub.status === "active"
                        ? "var(--amber)"
                        : "var(--green)",
                    }}
                  >
                    {sub.status === "active"
                      ? <Archive     size={14} />
                      : <CheckCircle size={14} />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => setEditTarget(sub)}
                    title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(sub)}
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