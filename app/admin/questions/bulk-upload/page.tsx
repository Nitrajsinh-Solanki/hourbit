// app/admin/questions/bulk-upload/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Upload, FileText, CheckCircle, AlertTriangle,
  X, Loader2, Save, Tag, Layers, BarChart3,
  Shield, ArrowLeft, Trash2, RefreshCw,
  ChevronRight, Info, Download, Table2, Braces,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Category    { _id: string; name: string; }
interface Subcategory { _id: string; categoryId: string; name: string; }
interface LevelItem   {
  _id: string; subcategoryId: string;
  levelNumber: number; name: string;
  questionCount: number; status: string;
}

interface DraftQuestion {
  id:              string;
  questionContent: string;
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  correctOption:   string;
  hintText:        string;
  hintXpPenalty:   string;
  explanation:     string;
  displayOrder:    string;
  status:          "draft" | "published";
  errors:          Record<string, string>;
  isValid:         boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const cellInput: React.CSSProperties = {
  width:        "100%",
  background:   "var(--bg)",
  border:       "1px solid var(--border2)",
  borderRadius: "8px",
  padding:      "7px 10px",
  fontSize:     "13px",
  color:        "var(--text)",
  outline:      "none",
  lineHeight:   "1.5",
};

const cellTextarea: React.CSSProperties = {
  ...cellInput,
  resize:    "vertical",
  minHeight: "72px",
};

const errInput: React.CSSProperties = {
  ...cellInput,
  border:     "1px solid var(--danger)",
  background: "rgba(248,113,113,0.06)",
};

const errTextarea: React.CSSProperties = {
  ...cellTextarea,
  border:     "1px solid var(--danger)",
  background: "rgba(248,113,113,0.06)",
};

const globalInput: React.CSSProperties = {
  width:        "100%",
  background:   "var(--bg)",
  border:       "1px solid var(--border2)",
  borderRadius: "10px",
  padding:      "9px 13px",
  fontSize:     "13.5px",
  color:        "var(--text)",
  outline:      "none",
};

const labelSt: React.CSSProperties = {
  display:       "block",
  fontSize:      "11px",
  fontWeight:    600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color:         "var(--text3)",
  marginBottom:  "6px",
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// question_content must be a real question (not just a number, min 10 chars,
// should end in "?" or be descriptive text)
// ─────────────────────────────────────────────────────────────────────────────

function validateRow(q: Omit<DraftQuestion, "id" | "errors" | "isValid">): Record<string, string> {
  const errs: Record<string, string> = {};

  // ── Question content ──
  const qc = q.questionContent.trim();
  if (!qc) {
    errs.questionContent = "Question content is required";
  } else if (qc.length < 10) {
    errs.questionContent = "Too short — must be at least 10 characters";
  } else if (qc.length > 2000) {
    errs.questionContent = "Too long — max 2000 characters";
  } else if (/^\d+(\.\d+)?$/.test(qc)) {
    // Pure number is not a valid question
    errs.questionContent = "This looks like a number, not a question. Write a full question sentence.";
  } else if (/^[a-zA-Z]{1,3}$/.test(qc)) {
    // Single letters / abbreviations are not questions
    errs.questionContent = "Question is too short to be meaningful";
  }

  // ── Options ──
  const optionA = q.optionA.trim();
  const optionB = q.optionB.trim();
  const optionC = q.optionC.trim();
  const optionD = q.optionD.trim();

  if (!optionA) errs.optionA = "Required";
  else if (optionA.length > 500) errs.optionA = "Max 500 chars";

  if (!optionB) errs.optionB = "Required";
  else if (optionB.length > 500) errs.optionB = "Max 500 chars";

  if (!optionC) errs.optionC = "Required";
  else if (optionC.length > 500) errs.optionC = "Max 500 chars";

  if (!optionD) errs.optionD = "Required";
  else if (optionD.length > 500) errs.optionD = "Max 500 chars";

  // Check duplicate options
  const opts = [optionA, optionB, optionC, optionD].filter(Boolean);
  const unique = new Set(opts.map(o => o.toLowerCase()));
  if (unique.size < opts.length) {
    errs.optionA = (errs.optionA ? errs.optionA + " | " : "") + "Duplicate options detected";
  }

  // ── Correct option ──
  const co = q.correctOption.trim().toUpperCase();
  if (!co) {
    errs.correctOption = "Required";
  } else if (!["A", "B", "C", "D"].includes(co)) {
    errs.correctOption = "Must be A, B, C, or D";
  } else {
    // Correct option must match a non-empty option
    const map: Record<string, string> = { A: optionA, B: optionB, C: optionC, D: optionD };
    if (!map[co]) {
      errs.correctOption = `Option ${co} is empty`;
    }
  }

  // ── Hint XP penalty ──
  if (q.hintXpPenalty.trim()) {
    const v = Number(q.hintXpPenalty);
    if (isNaN(v)) errs.hintXpPenalty = "Must be a number";
    else if (v < 0) errs.hintXpPenalty = "Cannot be negative";
    else if (v > 1000) errs.hintXpPenalty = "Max 1000";
  }

  // ── Display order ──
  if (q.displayOrder.trim()) {
    const v = Number(q.displayOrder);
    if (isNaN(v) || v < 0 || !Number.isInteger(v)) {
      errs.displayOrder = "Must be a non-negative integer";
    }
  }

  return errs;
}

function applyValidation(d: DraftQuestion): DraftQuestion {
  const errors = validateRow(d);
  return { ...d, errors, isValid: Object.keys(errors).length === 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER  (handles quoted fields)
// ─────────────────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  const splitRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { result.push(cur); cur = ""; }
      else cur += c;
    }
    result.push(cur);
    return result.map(s => s.trim().replace(/^"|"$/g, ""));
  };

  const headers = splitRow(lines[0]).map(h =>
    h.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  return lines.slice(1)
    .filter(l => l.trim() && l.trim() !== ",".repeat(headers.length - 1))
    .map(l => {
      const vals = splitRow(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
      return row;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseJSON(text: string): Record<string, string>[] {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error("JSON root must be an array of objects");
  if (raw.length === 0) throw new Error("JSON array is empty");
  return raw.map((item: unknown) => {
    if (typeof item !== "object" || item === null) throw new Error("Each JSON item must be an object");
    const row: Record<string, string> = {};
    Object.entries(item as Record<string, unknown>).forEach(([k, v]) => {
      row[k.toLowerCase().trim().replace(/\s+/g, "_")] = String(v ?? "").trim();
    });
    return row;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW → DRAFT MAPPING
// Accepts many common column name variants
// ─────────────────────────────────────────────────────────────────────────────

function rowToDraft(row: Record<string, string>, idx: number): DraftQuestion {
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const val = row[k];
      if (val !== undefined && val !== "") return val.trim();
    }
    return "";
  };

  const rawStatus = get("status").toLowerCase();
  const status = rawStatus === "published" ? "published" : "draft";

  const rawCorrect = get(
    "correct_option", "correct", "answer", "correct_answer",
    "correctoption", "correctanswer"
  ).toUpperCase().replace(/^OPTION\s*/i, "").trim();

  const draft: Omit<DraftQuestion, "id" | "errors" | "isValid"> = {
    questionContent: get(
      "question_content", "question", "q", "content",
      "questioncontent", "question_text", "questiontext"
    ),
    optionA: get("option_a", "optiona", "a", "option1", "opt_a", "choice_a"),
    optionB: get("option_b", "optionb", "b", "option2", "opt_b", "choice_b"),
    optionC: get("option_c", "optionc", "c", "option3", "opt_c", "choice_c"),
    optionD: get("option_d", "optiond", "d", "option4", "opt_d", "choice_d"),
    correctOption:  rawCorrect,
    hintText:       get("hint_text", "hint", "hinttext"),
    hintXpPenalty:  get("hint_xp_penalty", "hint_penalty", "xp_penalty", "hintxppenalty") || "0",
    explanation:    get("explanation", "explain", "solution"),
    displayOrder:   get("display_order", "order", "displayorder") || String(idx + 1),
    status,
  };

  const errors = validateRow(draft);
  return {
    ...draft,
    id:      `draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}`,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEETJS LOADER  (lazy, CDN)
// ─────────────────────────────────────────────────────────────────────────────

async function loadSheetJS(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX;
  return new Promise((resolve, reject) => {
    const script   = document.createElement("script");
    script.src     = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload  = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Failed to load SheetJS from CDN"));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE DOWNLOADS
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_ROWS = [
  {
    question_content:  "What is the value of 5 squared?",
    option_a:          "20",
    option_b:          "25",
    option_c:          "30",
    option_d:          "15",
    correct_option:    "B",
    hint_text:         "Think about multiplying a number by itself",
    hint_xp_penalty:   "5",
    explanation:       "5 squared means 5 × 5 = 25",
    display_order:     "1",
    status:            "draft",
  },
  {
    question_content:  "Which planet is closest to the Sun?",
    option_a:          "Venus",
    option_b:          "Earth",
    option_c:          "Mercury",
    option_d:          "Mars",
    correct_option:    "C",
    hint_text:         "It is the smallest planet in the solar system",
    hint_xp_penalty:   "10",
    explanation:       "Mercury is the closest planet to the Sun in our solar system",
    display_order:     "2",
    status:            "published",
  },
  {
    question_content:  "What is the chemical symbol for water?",
    option_a:          "HO",
    option_b:          "H2O",
    option_c:          "OH2",
    option_d:          "H3O",
    correct_option:    "B",
    hint_text:         "It contains 2 hydrogen atoms and 1 oxygen atom",
    hint_xp_penalty:   "8",
    explanation:       "Water is composed of 2 hydrogen atoms bonded to 1 oxygen atom, giving it the formula H2O",
    display_order:     "3",
    status:            "draft",
  },
];

const HEADERS = [
  "question_content", "option_a", "option_b", "option_c", "option_d",
  "correct_option", "hint_text", "hint_xp_penalty", "explanation",
  "display_order", "status",
];

function downloadCSV() {
  const headerRow = HEADERS.join(",");
  const dataRows  = TEMPLATE_ROWS.map(row =>
    HEADERS.map(h => {
      const val = (row as any)[h] ?? "";
      // Wrap in quotes if contains comma, newline, or quote
      return val.includes(",") || val.includes("\n") || val.includes('"')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(",")
  );
  const csv  = [headerRow, ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "questions_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON() {
  const json = JSON.stringify(TEMPLATE_ROWS, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "questions_template.json"; a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel() {
  const XLSX = await loadSheetJS().catch(() => null);
  if (!XLSX) {
    toast.error("Could not load Excel library. Try CSV instead.");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, { header: HEADERS });

  // Auto column widths
  const colWidths = HEADERS.map(h => {
    const maxLen = Math.max(
      h.length,
      ...TEMPLATE_ROWS.map(r => String((r as any)[h] ?? "").length)
    );
    return { wch: Math.min(60, maxLen + 4) };
  });
  ws["!cols"] = colWidths;

  // Header row style hint (xlsx doesn't support rich formatting without pro,
  // so we just make the first row obvious via column widths)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  XLSX.writeFile(wb, "questions_template.xlsx");
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION COLORS
// ─────────────────────────────────────────────────────────────────────────────

const OPT_COLORS: Record<string, string> = {
  A: "#60a5fa", B: "#34d399", C: "#f59e0b", D: "#f472b6",
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION ROW COMPONENT  (full-width card style, one per question)
// ─────────────────────────────────────────────────────────────────────────────

function QuestionReviewCard({
  draft,
  index,
  onChange,
  onRemove,
}: {
  draft:    DraftQuestion;
  index:    number;
  onChange: (id: string, field: keyof DraftQuestion, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const e = draft.errors;

  const field = (
    key: keyof DraftQuestion,
    label: string,
    required = false,
    multiline = false,
    half = false,
  ) => (
    <div style={{ gridColumn: half ? "span 1" : undefined }}>
      <label style={{ ...labelSt }}>
        {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {multiline ? (
        <textarea
          style={e[key] ? errTextarea : cellTextarea}
          value={String(draft[key])}
          onChange={ev => onChange(draft.id, key, ev.target.value)}
          rows={3}
        />
      ) : (
        <input
          style={e[key] ? errInput : cellInput}
          value={String(draft[key])}
          onChange={ev => onChange(draft.id, key, ev.target.value)}
        />
      )}
      {e[key] && (
        <p className="text-[11.5px] mt-1 flex items-center gap-1" style={{ color: "var(--danger)" }}>
          <AlertTriangle size={11} /> {e[key]}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border:     `1.5px solid ${draft.isValid ? "var(--border2)" : "rgba(248,113,113,0.45)"}`,
        background: "var(--surface)",
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          background:   draft.isValid ? "var(--surface2)" : "rgba(248,113,113,0.08)",
          borderBottom: `1px solid ${draft.isValid ? "var(--border)" : "rgba(248,113,113,0.30)"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
            style={{
              background: draft.isValid ? "rgba(34,211,160,0.12)" : "rgba(248,113,113,0.12)",
              color:      draft.isValid ? "var(--green)"           : "var(--danger)",
            }}
          >
            {index + 1}
          </span>
          {draft.isValid ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--green)" }}>
              <CheckCircle size={14} /> Valid
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>
              <AlertTriangle size={14} />
              {Object.keys(draft.errors).length} error{Object.keys(draft.errors).length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status toggle */}
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "var(--bg)", border: "1px solid var(--border2)" }}>
            {(["draft", "published"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(draft.id, "status", s)}
                className="px-3 py-1 rounded-md text-[12px] font-medium border-none cursor-pointer"
                style={{
                  background: draft.status === s
                    ? s === "published" ? "var(--green)" : "var(--amber)"
                    : "transparent",
                  color: draft.status === s ? "#fff" : "var(--text4)",
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(draft.id)}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
            title="Remove this question"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col gap-4">

        {/* Question content — full width */}
        {field("questionContent", "Question Content", true, true)}

        {/* Options — 2×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as const).map(letter => {
            const key = `option${letter}` as keyof DraftQuestion;
            const color = OPT_COLORS[letter];
            const isCorrect = draft.correctOption.toUpperCase() === letter;
            return (
              <div key={letter}>
                <div className="flex items-center gap-2 mb-1.5">
                  {/* Radio-style correct selector */}
                  <button
                    type="button"
                    onClick={() => onChange(draft.id, "correctOption", letter)}
                    title={`Mark ${letter} as correct`}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 border-none cursor-pointer"
                    style={{
                      borderColor: isCorrect ? color : "var(--border2)",
                      background:  isCorrect ? color : "var(--surface2)",
                      border:      `2px solid ${isCorrect ? color : "var(--border2)"}`,
                    }}
                  >
                    {isCorrect && <CheckCircle size={11} color="#fff" />}
                  </button>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: `${color}22`, color }}
                  >
                    {letter}
                  </span>
                  <label style={{ ...labelSt, marginBottom: 0, flex: 1 }}>
                    Option {letter}<span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                </div>
                <input
                  style={draft.errors[key] ? errInput : cellInput}
                  value={String(draft[key])}
                  onChange={ev => onChange(draft.id, key, ev.target.value)}
                  placeholder={`Option ${letter}`}
                />
                {draft.errors[key] && (
                  <p className="text-[11.5px] mt-1 flex items-center gap-1" style={{ color: "var(--danger)" }}>
                    <AlertTriangle size={11} /> {draft.errors[key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Correct option error */}
        {draft.errors.correctOption && (
          <div
            className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-[13px]"
            style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)" }}
          >
            <AlertTriangle size={14} />
            <strong>Correct Option:</strong> {draft.errors.correctOption}
            &nbsp;— click the circle next to the correct option above to mark it
          </div>
        )}

        {/* Hint + penalty + order row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label style={labelSt}>Hint Text (optional)</label>
            <input
              style={cellInput}
              value={draft.hintText}
              onChange={ev => onChange(draft.id, "hintText", ev.target.value)}
              placeholder="Optional hint shown to users on request"
            />
          </div>
          <div>
            <label style={labelSt}>
              Hint XP Penalty
              {draft.errors.hintXpPenalty && <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>}
            </label>
            <input
              type="number"
              style={draft.errors.hintXpPenalty ? errInput : cellInput}
              value={draft.hintXpPenalty}
              onChange={ev => onChange(draft.id, "hintXpPenalty", ev.target.value)}
              placeholder="0"
              min={0}
            />
            {draft.errors.hintXpPenalty && (
              <p className="text-[11.5px] mt-1 flex items-center gap-1" style={{ color: "var(--danger)" }}>
                <AlertTriangle size={11} /> {draft.errors.hintXpPenalty}
              </p>
            )}
          </div>
        </div>

        {/* Explanation + display order */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-3">
            <label style={labelSt}>Explanation (shown after level completion)</label>
            <textarea
              style={cellTextarea}
              value={draft.explanation}
              onChange={ev => onChange(draft.id, "explanation", ev.target.value)}
              placeholder="Explain the correct answer in detail…"
              rows={3}
            />
          </div>
          <div>
            <label style={labelSt}>
              Display Order
              {draft.errors.displayOrder && <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>}
            </label>
            <input
              type="number"
              style={draft.errors.displayOrder ? errInput : cellInput}
              value={draft.displayOrder}
              onChange={ev => onChange(draft.id, "displayOrder", ev.target.value)}
              min={0}
              placeholder="1"
            />
            {draft.errors.displayOrder && (
              <p className="text-[11.5px] mt-1 flex items-center gap-1" style={{ color: "var(--danger)" }}>
                <AlertTriangle size={11} /> {draft.errors.displayOrder}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {

  // ── Hierarchy ──────────────────────────────────────────────────────────────
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [levelsList,    setLevelsList]    = useState<LevelItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [selectedLvlId, setSelectedLvlId] = useState("");
  const [catsLoading,   setCatsLoading]   = useState(true);
  const [subsLoading,   setSubsLoading]   = useState(false);
  const [lvlsLoading,   setLvlsLoading]   = useState(false);

  const [existingCount, setExistingCount] = useState(0);
  const selectedLevel   = levelsList.find(l => l._id === selectedLvlId) ?? null;
  const slotsLeft       = selectedLevel
    ? Math.max(0, selectedLevel.questionCount - existingCount)
    : 0;

  // ── Upload ─────────────────────────────────────────────────────────────────
  const fileRef           = useRef<HTMLInputElement>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [parsing,   setParsing]   = useState(false);

  // ── Drafts ─────────────────────────────────────────────────────────────────
  const [drafts,      setDrafts]      = useState<DraftQuestion[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [saveResult,  setSaveResult]  = useState<{ saved: number; slots: number } | null>(null);

  const totalValid   = drafts.filter(d => d.isValid).length;
  const totalInvalid = drafts.length - totalValid;
  const canSave      = drafts.length > 0 && totalInvalid === 0
    && drafts.length <= slotsLeft && slotsLeft > 0;

  // ── Hierarchy fetching ─────────────────────────────────────────────────────

  useEffect(() => {
    setCatsLoading(true);
    fetch("/api/admin/categories?status=active&limit=200")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCategories(d.categories);
          if (d.categories.length > 0) setSelectedCatId(d.categories[0]._id);
        }
      })
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setCatsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCatId) { setSubcategories([]); setSelectedSubId(""); return; }
    setSubsLoading(true);
    setSelectedSubId(""); setLevelsList([]); setSelectedLvlId("");
    fetch(`/api/admin/subcategories?categoryId=${selectedCatId}&status=active&limit=200`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSubcategories(d.subcategories);
          if (d.subcategories.length > 0) setSelectedSubId(d.subcategories[0]._id);
        }
      })
      .catch(() => toast.error("Failed to load subcategories"))
      .finally(() => setSubsLoading(false));
  }, [selectedCatId]);

  useEffect(() => {
    if (!selectedSubId) { setLevelsList([]); setSelectedLvlId(""); return; }
    setLvlsLoading(true);
    setSelectedLvlId("");
    fetch(`/api/admin/levels?subcategoryId=${selectedSubId}&status=active&limit=200`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setLevelsList(d.levels);
          if (d.levels.length > 0) setSelectedLvlId(d.levels[0]._id);
        }
      })
      .catch(() => toast.error("Failed to load levels"))
      .finally(() => setLvlsLoading(false));
  }, [selectedSubId]);

  useEffect(() => {
    if (!selectedLvlId) { setExistingCount(0); return; }
    fetch(`/api/admin/questions?levelId=${selectedLvlId}&status=all&limit=1`)
      .then(r => r.json())
      .then(d => { if (d.success) setExistingCount(d.pagination.total); })
      .catch(() => {});
  }, [selectedLvlId]);

  useEffect(() => {
    setDrafts([]); setSaveResult(null);
  }, [selectedLvlId]);

  // ── File processing ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!selectedLvlId) { toast.error("Select a level first"); return; }

    const name  = file.name.toLowerCase();
    const isCSV  = name.endsWith(".csv");
    const isJSON = name.endsWith(".json");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (!isCSV && !isJSON && !isXLSX) {
      toast.error("Only .csv, .json, .xlsx, .xls files are supported");
      return;
    }

    setParsing(true);
    setSaveResult(null);

    try {
      let rows: Record<string, string>[] = [];

      if (isCSV) {
        rows = parseCSV(await file.text());
      } else if (isJSON) {
        rows = parseJSON(await file.text());
      } else {
        const XLSX = await loadSheetJS();
        const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length < 2) throw new Error("Excel file appears to be empty");
        const headers = (raw[0] as string[]).map(h =>
          String(h ?? "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
        );
        rows = raw.slice(1)
          .filter((r: any[]) => r.some(c => String(c ?? "").trim() !== ""))
          .map((r: any[]) => {
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = String(r[i] ?? "").trim(); });
            return row;
          });
      }

      if (rows.length === 0) {
        toast.error("No data rows found. Check your file has data below the header row.");
        return;
      }

      const parsed  = rows.map((row, i) => rowToDraft(row, i));
      setDrafts(parsed);

      const valid   = parsed.filter(d => d.isValid).length;
      const invalid = parsed.length - valid;
      toast.success(
        invalid === 0
          ? `✓ Parsed ${parsed.length} question(s) — all valid`
          : `Parsed ${parsed.length} question(s): ${valid} valid, ${invalid} need fixing`
      );
    } catch (err: any) {
      toast.error(`Parse error: ${err.message ?? "Unknown error"}`);
    } finally {
      setParsing(false);
    }
  }, [selectedLvlId]);

  // ── Draft editing ──────────────────────────────────────────────────────────

  const updateDraft = useCallback((id: string, field: keyof DraftQuestion, val: string) => {
    setDrafts(prev => prev.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, [field]: val };
      return applyValidation(updated);
    }));
  }, []);

  const removeDraft  = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));
  const clearAll     = () => { setDrafts([]); setSaveResult(null); if (fileRef.current) fileRef.current.value = ""; };
  const revalidate   = () => { setDrafts(prev => prev.map(applyValidation)); toast.success("Re-validated all questions"); };

  // ── Save all ───────────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = drafts.map(d => ({
        questionContent: d.questionContent.trim(),
        optionA:         d.optionA.trim(),
        optionB:         d.optionB.trim(),
        optionC:         d.optionC.trim(),
        optionD:         d.optionD.trim(),
        correctOption:   d.correctOption.trim().toUpperCase(),
        hintText:        d.hintText.trim(),
        hintXpPenalty:   Number(d.hintXpPenalty) || 0,
        explanation:     d.explanation.trim(),
        displayOrder:    Number(d.displayOrder)   || 0,
        status:          d.status,
      }));

      const res  = await fetch("/api/admin/questions/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          levelId:       selectedLvlId,
          subcategoryId: selectedSubId,
          categoryId:    selectedCatId,
          questions:     payload,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        // Map backend per-row errors back onto drafts
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          const errMap: Record<number, Record<string, string>> = {};
          data.errors.forEach((e: { row: number; field: string; message: string }) => {
            if (!errMap[e.row - 1]) errMap[e.row - 1] = {};
            errMap[e.row - 1][e.field] = e.message;
          });
          setDrafts(prev => prev.map((d, i) => ({
            ...d,
            errors:  errMap[i] ?? d.errors,
            isValid: Object.keys(errMap[i] ?? d.errors).length === 0,
          })));
        }
        toast.error(data.message);
        return;
      }

      setSaveResult({ saved: data.savedCount, slots: data.slotsRemaining });
      setExistingCount(data.existingCount);
      setDrafts([]);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(`${data.savedCount} question(s) saved!`);
    } catch {
      toast.error("Save failed — check your network");
    } finally {
      setSaving(false);
    }
  };

  // ── Selected entities ──────────────────────────────────────────────────────

  const selectedCat = categories.find(c    => c._id === selectedCatId) ?? null;
  const selectedSub = subcategories.find(s  => s._id === selectedSubId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/questions"
            className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer no-underline shrink-0 mt-0.5"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,67,147,0.13)" }}>
                <Upload size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
                Bulk Upload Questions
              </h1>
            </div>
            <p className="text-[13px] ml-10" style={{ color: "var(--text3)" }}>
              Option-based questions only · Upload CSV, Excel, or JSON · Review and edit before saving
            </p>
          </div>
        </div>

        {/* Template downloads */}
        <div className="flex flex-col gap-2 shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
            Download Templates
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text2)" }}
            >
              <Download size={13} style={{ color: "#34d399" }} />
              CSV Template
            </button>
            <button
              onClick={downloadJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text2)" }}
            >
              <Download size={13} style={{ color: "#60a5fa" }} />
              JSON Template
            </button>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
              style={{ background: "var(--surface)", border: "1px solid var(--border2)", color: "var(--text2)" }}
            >
              <Download size={13} style={{ color: "#a78bfa" }} />
              Excel Template
            </button>
          </div>
        </div>
      </div>

      {/* ── Column format guide ── */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.22)" }}
      >
        <div className="flex items-center gap-2">
          <Info size={15} style={{ color: "#60a5fa", flexShrink: 0 }} />
          <p className="text-[13px] font-semibold" style={{ color: "#60a5fa" }}>
            File Format — Required and Optional Columns
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text4)" }}>
              Required Columns
            </p>
            <div className="flex flex-col gap-1">
              {[
                { col: "question_content", desc: "The full question sentence (min 10 chars, not just a number)" },
                { col: "option_a",         desc: "Text for option A" },
                { col: "option_b",         desc: "Text for option B" },
                { col: "option_c",         desc: "Text for option C" },
                { col: "option_d",         desc: "Text for option D" },
                { col: "correct_option",   desc: "Must be exactly: A, B, C, or D" },
              ].map(({ col, desc }) => (
                <div key={col} className="flex items-start gap-2">
                  <code
                    className="text-[11px] px-1.5 py-0.5 rounded shrink-0 font-mono"
                    style={{ background: "rgba(96,165,250,0.14)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
                  >
                    {col}
                  </code>
                  <span className="text-[12px]" style={{ color: "var(--text3)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text4)" }}>
              Optional Columns
            </p>
            <div className="flex flex-col gap-1">
              {[
                { col: "hint_text",        desc: "Optional hint shown to users on request" },
                { col: "hint_xp_penalty",  desc: "XP deducted when hint is used (number, default 0)" },
                { col: "explanation",      desc: "Shown after level completion or exhaustion" },
                { col: "display_order",    desc: "Integer sort order (default = row number)" },
                { col: "status",           desc: "draft or published (default: draft)" },
              ].map(({ col, desc }) => (
                <div key={col} className="flex items-start gap-2">
                  <code
                    className="text-[11px] px-1.5 py-0.5 rounded shrink-0 font-mono"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.22)" }}
                  >
                    {col}
                  </code>
                  <span className="text-[12px]" style={{ color: "var(--text3)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text4)" }}>
          ⚠️ question_content must be a real question — a bare number or single word will be rejected by validation.
        </p>
      </div>

      {/* ── Hierarchy Selector ── */}
      <div
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
      >
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: "var(--accent)" }} />
          <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            Target Level — Questions will be saved here
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Category */}
          <div>
            <label style={labelSt}><Tag size={11} className="inline mr-1" /> Category</label>
            {catsLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--text3)" }}>
                <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
              </div>
            ) : (
              <select style={{ ...globalInput, cursor: "pointer" }} value={selectedCatId}
                onChange={e => setSelectedCatId(e.target.value)}>
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Subcategory */}
          <div>
            <label style={labelSt}><Layers size={11} className="inline mr-1" /> Subcategory</label>
            {subsLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--text3)" }}>
                <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
              </div>
            ) : !selectedCatId ? (
              <div className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text4)" }}>
                Select a category first
              </div>
            ) : (
              <select style={{ ...globalInput, cursor: "pointer" }} value={selectedSubId}
                onChange={e => setSelectedSubId(e.target.value)}>
                <option value="">— Select Subcategory —</option>
                {subcategories.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Level */}
          <div>
            <label style={labelSt}><BarChart3 size={11} className="inline mr-1" /> Level</label>
            {lvlsLoading ? (
              <div className="flex items-center gap-2" style={{ color: "var(--text3)" }}>
                <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
              </div>
            ) : !selectedSubId ? (
              <div className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text4)" }}>
                Select subcategory first
              </div>
            ) : (
              <select style={{ ...globalInput, cursor: "pointer" }} value={selectedLvlId}
                onChange={e => setSelectedLvlId(e.target.value)}>
                <option value="">— Select Level —</option>
                {levelsList.map(l => (
                  <option key={l._id} value={l._id}>
                    Level {l.levelNumber}{l.name ? ` — ${l.name}` : ""} · max {l.questionCount} questions
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Breadcrumb + capacity */}
        {selectedLevel && (
          <div className="flex flex-col gap-3">
            {/* Breadcrumb chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCat && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(232,67,147,0.10)", border: "1px solid rgba(232,67,147,0.25)", color: "var(--accent)" }}>
                  <Tag size={10} />{selectedCat.name}
                </span>
              )}
              {selectedSub && (
                <>
                  <ChevronRight size={13} style={{ color: "var(--text4)" }} />
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>
                    <Layers size={10} />{selectedSub.name}
                  </span>
                </>
              )}
              {selectedLevel && (
                <>
                  <ChevronRight size={13} style={{ color: "var(--text4)" }} />
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.25)", color: "var(--green)" }}>
                    <BarChart3 size={10} />Level {selectedLevel.levelNumber}
                  </span>
                </>
              )}
            </div>

            {/* Capacity bar */}
            <div
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: "var(--text2)" }}>
                  Level Capacity
                </span>
                <span className="text-[13px] font-mono font-bold" style={{ color: "var(--text)" }}>
                  {existingCount} existing + {drafts.length} queued = {existingCount + drafts.length} / {selectedLevel.questionCount}
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--border2)" }}>
                <div className="h-full rounded-full flex overflow-hidden">
                  {/* Existing */}
                  <div
                    style={{
                      width:      `${Math.min(100, (existingCount / selectedLevel.questionCount) * 100)}%`,
                      background: "var(--text4)",
                    }}
                  />
                  {/* Queued */}
                  <div
                    style={{
                      width:      `${Math.min(100 - (existingCount / selectedLevel.questionCount) * 100, (drafts.length / selectedLevel.questionCount) * 100)}%`,
                      background: drafts.length > slotsLeft ? "var(--danger)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text4)" }}>
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "var(--text4)" }} />
                  {existingCount} already saved
                </span>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: drafts.length > slotsLeft ? "var(--danger)" : "var(--accent)" }}>
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: drafts.length > slotsLeft ? "var(--danger)" : "var(--accent)" }} />
                  {drafts.length} queued in review
                </span>
                <span
                  className="ml-auto text-[12.5px] font-semibold px-3 py-1 rounded-full"
                  style={{
                    background: slotsLeft === 0 ? "rgba(248,113,113,0.12)" : "rgba(34,211,160,0.12)",
                    color:      slotsLeft === 0 ? "var(--danger)"           : "var(--green)",
                    border:     `1px solid ${slotsLeft === 0 ? "rgba(248,113,113,0.25)" : "rgba(34,211,160,0.25)"}`,
                  }}
                >
                  {slotsLeft === 0 ? "⛔ Level is Full" : `${slotsLeft} slot(s) available`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Drop Zone ── */}
      {selectedLvlId && slotsLeft > 0 && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all"
          style={{
            minHeight:  "200px",
            padding:    "40px 32px",
            border:     `2px dashed ${dragOver ? "var(--accent)" : "var(--border2)"}`,
            background: dragOver ? "rgba(232,67,147,0.05)" : "var(--surface)",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true);  }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />

          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-[15px] font-medium" style={{ color: "var(--text3)" }}>Parsing file…</p>
            </div>
          ) : (
            <>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all"
                style={{ background: dragOver ? "rgba(232,67,147,0.13)" : "var(--surface2)" }}
              >
                <Upload size={28} style={{ color: dragOver ? "var(--accent)" : "var(--text4)" }} />
              </div>
              <div className="text-center">
                <p className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
                  Drop your file here, or click to browse
                </p>
                <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
                  Supports <strong>.csv</strong> · <strong>.xlsx</strong> / <strong>.xls</strong> · <strong>.json</strong>
                </p>
              </div>
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text4)" }}>
                  <Table2 size={15} /> Excel (.xlsx)
                </span>
                <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text4)" }}>
                  <FileText size={15} /> CSV
                </span>
                <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text4)" }}>
                  <Braces size={15} /> JSON
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Level full ── */}
      {selectedLvlId && slotsLeft === 0 && drafts.length === 0 && (
        <div className="rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.22)" }}>
          <AlertTriangle size={28} style={{ color: "var(--danger)" }} />
          <p className="text-[14px] font-semibold" style={{ color: "var(--danger)" }}>
            This level is full ({existingCount}/{selectedLevel?.questionCount})
          </p>
          <p className="text-[13px]" style={{ color: "var(--text3)" }}>
            Delete existing questions or increase the level&apos;s question count from Levels Management.
          </p>
        </div>
      )}

      {/* ── Save success ── */}
      {saveResult && (
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)" }}>
          <CheckCircle size={24} style={{ color: "var(--green)", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-[15px] font-bold" style={{ color: "var(--green)" }}>
              {saveResult.saved} question(s) saved successfully!
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--text3)" }}>
              {saveResult.slots} slot(s) still available in this level.
            </p>
          </div>
          <Link
            href="/admin/questions"
            className="px-4 py-2 rounded-xl text-[13px] font-semibold no-underline"
            style={{ background: "var(--green)", color: "#fff" }}
          >
            View Questions →
          </Link>
        </div>
      )}

      {/* ── Review Section ── */}
      {drafts.length > 0 && (
        <div className="flex flex-col gap-5">

          {/* Review toolbar */}
          <div
            className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-[64px] z-20"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-bold" style={{ color: "var(--text)" }}>
                Review & Edit — {drafts.length} Question(s)
              </h2>
              <div className="flex items-center gap-4 flex-wrap">
                {totalValid > 0 && (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--green)" }}>
                    <CheckCircle size={13} /> {totalValid} valid
                  </span>
                )}
                {totalInvalid > 0 && (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>
                    <AlertTriangle size={13} /> {totalInvalid} have errors — fix before saving
                  </span>
                )}
                {drafts.length > slotsLeft && (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--amber)" }}>
                    <AlertTriangle size={13} /> {drafts.length - slotsLeft} over slot limit
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={revalidate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
                style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border2)" }}
              >
                <RefreshCw size={13} /> Re-validate All
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-medium border-none cursor-pointer"
                style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.25)" }}
              >
                <X size={13} /> Clear All
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || !canSave}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13.5px] font-bold border-none cursor-pointer"
                style={{
                  background: canSave && !saving ? "var(--accent)" : "var(--surface2)",
                  color:      canSave && !saving ? "#fff"           : "var(--text4)",
                  opacity:    saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><Save size={14} /> Save All ({totalValid} valid)</>}
              </button>
            </div>
          </div>

          {/* Slot over-limit warning */}
          {drafts.length > slotsLeft && slotsLeft > 0 && (
            <div
              className="rounded-xl px-5 py-3 text-[13px]"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)", color: "var(--amber)" }}
            >
              ⚠️ You have <strong>{drafts.length}</strong> question(s) queued but only <strong>{slotsLeft}</strong> slot(s) remain.
              Remove <strong>{drafts.length - slotsLeft}</strong> question(s) using the trash icon on each card.
            </div>
          )}

          {/* Question cards — full width, one per row */}
          <div className="flex flex-col gap-5">
            {drafts.map((d, idx) => (
              <QuestionReviewCard
                key={d.id}
                draft={d}
                index={idx}
                onChange={updateDraft}
                onRemove={removeDraft}
              />
            ))}
          </div>

          {/* Bottom save */}
          <div className="flex justify-end pb-4">
            <button
              onClick={handleSaveAll}
              disabled={saving || !canSave}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-[15px] font-bold border-none cursor-pointer"
              style={{
                background: canSave && !saving ? "var(--accent)" : "var(--surface2)",
                color:      canSave && !saving ? "#fff"           : "var(--text4)",
                opacity:    saving ? 0.7 : 1,
              }}
            >
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <><Save size={16} /> Save All {totalValid} Valid Question(s)</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}