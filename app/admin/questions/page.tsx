// app/admin/questions/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Search, X,
  ChevronUp, ChevronDown, HelpCircle,
  AlertTriangle, Loader2, RefreshCw,
  GripVertical, CheckCircle, Eye,
  Tag, Layers, BarChart3, Shield,
  Zap, Lightbulb, FileText, BookOpen,
  ToggleLeft, ToggleRight, Type, List, Upload,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Category    { _id: string; name: string; status: string; }
interface Subcategory { _id: string; categoryId: string; name: string; status: string; }
interface LevelItem   {
  _id: string; subcategoryId: string;
  levelNumber: number; name: string;
  difficulty: string; status: string;
}

interface Question {
  _id:             string;
  levelId:         string;
  subcategoryId:   string;
  categoryId:      string;
  questionType:    "option" | "text";
  questionContent: string;
  optionA:         string;
  optionB:         string;
  optionC:         string;
  optionD:         string;
  correctOption:   "A" | "B" | "C" | "D" | "";
  acceptedAnswers: string[];
  hintText:        string;
  hintXpPenalty:   number;
  explanation:     string;
  displayOrder:    number;
  status:          "draft" | "published";
  createdAt:       string;
}

type QStatusFilter = "all" | "draft" | "published";
type QTypeFilter   = "all" | "option" | "text";
type HintFilter    = "all" | "with" | "without";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg)",
  border: "1px solid var(--border2)", borderRadius: "10px",
  padding: "9px 13px", fontSize: "13.5px",
  color: "var(--text)", outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: "vertical", minHeight: "100px", lineHeight: "1.6",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.07em", textTransform: "uppercase",
  color: "var(--text3)", marginBottom: "6px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--accent)", marginBottom: "10px",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER BADGES
// ─────────────────────────────────────────────────────────────────────────────

function QTypeBadge({ type }: { type: "option" | "text" }) {
  const isOption = type === "option";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 600,
      color:      isOption ? "#60a5fa"              : "#a78bfa",
      background: isOption ? "rgba(96,165,250,0.10)" : "rgba(167,139,250,0.10)",
      border:     isOption ? "1px solid rgba(96,165,250,0.25)" : "1px solid rgba(167,139,250,0.25)",
      whiteSpace: "nowrap",
    }}>
      {isOption ? <List size={11} /> : <Type size={11} />}
      {isOption ? "Option" : "Text"}
    </span>
  );
}

function QStatusBadge({ status }: { status: "draft" | "published" }) {
  const isDraft = status === "draft";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 600,
      color:      isDraft ? "var(--amber)"          : "var(--green)",
      background: isDraft ? "rgba(245,158,11,0.10)" : "rgba(34,211,160,0.10)",
      border:     isDraft ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(34,211,160,0.25)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: isDraft ? "var(--amber)" : "var(--green)" }} />
      {isDraft ? "Draft" : "Published"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTION SELECTOR  (A/B/C/D radio-style)
// ─────────────────────────────────────────────────────────────────────────────

function OptionField({
  letter, value, onChange, isCorrect, onMarkCorrect,
}: {
  letter: "A" | "B" | "C" | "D";
  value: string; onChange: (v: string) => void;
  isCorrect: boolean; onMarkCorrect: () => void;
}) {
  const COLORS = { A: "#60a5fa", B: "#34d399", C: "#f59e0b", D: "#f472b6" };
  const color  = COLORS[letter];
  return (
    <div className="flex items-center gap-2">
      {/* Correct radio */}
      <button
        type="button"
        onClick={onMarkCorrect}
        title={`Mark option ${letter} as correct`}
        className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
        style={{
          borderColor: isCorrect ? color : "var(--border2)",
          background:  isCorrect ? color : "transparent",
        }}
      >
        {isCorrect && <CheckCircle size={12} color="#fff" />}
      </button>
      {/* Option label */}
      <span
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold"
        style={{ background: `${color}20`, color }}
      >
        {letter}
      </span>
      {/* Input */}
      <input
        style={{ ...inputStyle, flex: 1 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Option ${letter}`}
        maxLength={500}
        required
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCEPTED ANSWERS EDITOR  (dynamic list)
// ─────────────────────────────────────────────────────────────────────────────

function AcceptedAnswersEditor({
  answers, onChange,
}: {
  answers: string[]; onChange: (a: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (answers.includes(v)) { toast.error("Answer already added"); return; }
    onChange([...answers, v]);
    setInput("");
  };

  const remove = (i: number) => onChange(answers.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder='Type answer and press Enter or click +'
        />
        <button
          type="button"
          onClick={add}
          className="px-4 rounded-xl border-none cursor-pointer font-semibold text-[13px]"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          +
        </button>
      </div>
      {answers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {answers.map((ans, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12.5px] font-mono"
              style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
            >
              {ans}
              <button
                type="button"
                onClick={() => remove(i)}
                className="border-none cursor-pointer bg-transparent p-0"
                style={{ color: "#a78bfa" }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px]" style={{ color: "var(--text4)" }}>
        Answers are stored lowercase. Any matching answer = correct.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION FORM FIELDS  (shared between Add form and Edit modal)
// ─────────────────────────────────────────────────────────────────────────────

interface QFormState {
  questionType:    "option" | "text";
  questionContent: string;
  optionA: string; optionB: string; optionC: string; optionD: string;
  correctOption:   "A" | "B" | "C" | "D" | "";
  acceptedAnswers: string[];
  hintText:        string;
  hintXpPenalty:   string;
  explanation:     string;
  displayOrder:    string;
  status:          "draft" | "published";
}

const DEFAULT_FORM: QFormState = {
  questionType: "option", questionContent: "",
  optionA: "", optionB: "", optionC: "", optionD: "",
  correctOption: "", acceptedAnswers: [],
  hintText: "", hintXpPenalty: "0",
  explanation: "", displayOrder: "", status: "draft",
};

function QuestionFormFields({
  form, setForm, submitLabel, onSubmit, loading,
}: {
  form:       QFormState;
  setForm:    React.Dispatch<React.SetStateAction<QFormState>>;
  submitLabel: string;
  onSubmit:   (e: React.FormEvent) => void;
  loading:    boolean;
}) {
  const set = (key: keyof QFormState) => (val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">

      {/* ── Question Type toggle ── */}
      <div>
        <p style={sectionLabel}>Question Type</p>
        <div className="flex gap-3">
          {(["option", "text"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set("questionType")(t)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer transition-all"
              style={{
                background: form.questionType === t ? "var(--accent)" : "var(--surface2)",
                color:      form.questionType === t ? "#fff"          : "var(--text3)",
              }}
            >
              {t === "option" ? <List size={14} /> : <Type size={14} />}
              {t === "option" ? "Option-Based" : "Text Answer"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Question Content ── */}
      <div>
        <p style={sectionLabel}>Question Content</p>
        <label style={labelStyle}>
          Question <span style={{ color: "var(--danger)" }}>*</span>
        </label>
        <textarea
          style={textareaStyle}
          value={form.questionContent}
          onChange={e => set("questionContent")(e.target.value)}
          placeholder="Write the full question here…"
          maxLength={2000}
          required
        />
        <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text4)" }}>
          {form.questionContent.length}/2000
        </p>
      </div>

      {/* ── Option-based fields ── */}
      {form.questionType === "option" && (
        <div>
          <p style={sectionLabel}>Options</p>
          <p className="text-[11px] mb-3" style={{ color: "var(--text4)" }}>
            Click the circle next to an option to mark it as the correct answer.
          </p>
          <div className="flex flex-col gap-3">
            {(["A", "B", "C", "D"] as const).map(letter => (
              <OptionField
                key={letter}
                letter={letter}
                value={form[`option${letter}` as "optionA"]}
                onChange={v => set(`option${letter}` as keyof QFormState)(v)}
                isCorrect={form.correctOption === letter}
                onMarkCorrect={() => set("correctOption")(letter)}
              />
            ))}
          </div>
          {!form.correctOption && (
            <p className="text-[11.5px] mt-2" style={{ color: "var(--danger)" }}>
              ⚠️ Mark one option as the correct answer
            </p>
          )}
        </div>
      )}

      {/* ── Text-answer fields ── */}
      {form.questionType === "text" && (
        <div>
          <p style={sectionLabel}>Accepted Answers</p>
          <AcceptedAnswersEditor
            answers={form.acceptedAnswers}
            onChange={v => set("acceptedAnswers")(v)}
          />
        </div>
      )}

      {/* ── Hint ── */}
      <div>
        <p style={sectionLabel}>Hint (Optional)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label style={labelStyle}>Hint Text</label>
            <input
              style={inputStyle}
              value={form.hintText}
              onChange={e => set("hintText")(e.target.value)}
              placeholder="Optional hint shown to users on request…"
              maxLength={500}
            />
          </div>
          <div>
            <label style={labelStyle}>
              <Zap size={11} className="inline mr-1" />
              XP Penalty
            </label>
            <input
              type="number"
              style={inputStyle}
              value={form.hintXpPenalty}
              onChange={e => set("hintXpPenalty")(e.target.value)}
              min={0}
              placeholder="0"
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--text4)" }}>
              XP deducted when hint is revealed
            </p>
          </div>
        </div>
      </div>

      {/* ── Explanation ── */}
      <div>
        <p style={sectionLabel}>Explanation</p>
        <textarea
          style={{ ...textareaStyle, minHeight: "80px" }}
          value={form.explanation}
          onChange={e => set("explanation")(e.target.value)}
          placeholder="Explain the correct answer (shown after level completion or exhaustion)…"
          maxLength={2000}
        />
      </div>

      {/* ── Display Order + Status ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Display Order</label>
          <input
            type="number"
            style={inputStyle}
            value={form.displayOrder}
            onChange={e => set("displayOrder")(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            value={form.status}
            onChange={e => set("status")(e.target.value as "draft" | "published")}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl text-[13.5px] font-semibold border-none cursor-pointer flex items-center gap-2"
          style={{ background: "var(--accent)", color: "#fff", opacity: loading ? 0.7 : 1 }}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function DeleteModal({
  question, onConfirm, onCancel, loading,
}: {
  question: Question; onConfirm: () => void; onCancel: () => void; loading: boolean;
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
              Delete Question
            </h2>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              Are you sure you want to delete this question?
            </p>
          </div>
        </div>
        <div
          className="rounded-xl p-3 text-[12.5px] leading-relaxed"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text3)" }}
        >
          <p className="truncate font-medium" style={{ color: "var(--text)" }}>
            {question.questionContent.slice(0, 120)}{question.questionContent.length > 120 ? "…" : ""}
          </p>
        </div>
        <div
          className="rounded-xl p-3 text-[13px]"
          style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.22)", color: "var(--danger)" }}
        >
          ⚠️ <strong>This cannot be undone.</strong> The question will be permanently deleted.
        </div>
        <div className="flex gap-3 justify-end flex-wrap">
          <button
            onClick={onCancel} disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-medium cursor-pointer border-none"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={loading}
            className="px-5 py-2 rounded-xl text-[13.5px] font-semibold cursor-pointer border-none flex items-center gap-2"
            style={{ background: "var(--danger)", color: "#fff", opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Deleting…" : "Delete"}
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
  question, onSave, onClose, loading,
}: {
  question: Question;
  onSave:   (id: string, data: Partial<Question>) => void;
  onClose:  () => void;
  loading:  boolean;
}) {
  const [form, setForm] = useState<QFormState>({
    questionType:    question.questionType,
    questionContent: question.questionContent,
    optionA:         question.optionA,
    optionB:         question.optionB,
    optionC:         question.optionC,
    optionD:         question.optionD,
    correctOption:   question.correctOption,
    acceptedAnswers: question.acceptedAnswers,
    hintText:        question.hintText,
    hintXpPenalty:   String(question.hintXpPenalty),
    explanation:     question.explanation,
    displayOrder:    String(question.displayOrder),
    status:          question.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.questionContent.trim()) { toast.error("Question content is required"); return; }
    if (form.questionType === "option") {
      if (!form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) {
        toast.error("All four options are required"); return;
      }
      if (!form.correctOption) { toast.error("Mark a correct option"); return; }
    }
    if (form.questionType === "text" && form.acceptedAnswers.length === 0) {
      toast.error("Add at least one accepted answer"); return;
    }
    onSave(question._id, {
      questionType:    form.questionType,
      questionContent: form.questionContent.trim(),
      optionA:         form.optionA,
      optionB:         form.optionB,
      optionC:         form.optionC,
      optionD:         form.optionD,
      correctOption:   form.correctOption,
      acceptedAnswers: form.acceptedAnswers,
      hintText:        form.hintText.trim(),
      hintXpPenalty:   Number(form.hintXpPenalty),
      explanation:     form.explanation.trim(),
      displayOrder:    Number(form.displayOrder) || 0,
      status:          form.status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", zIndex: 1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(232,67,147,0.13)" }}>
              <Pencil size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>Edit Question</h2>
              <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                Type: {question.questionType === "option" ? "Option-Based" : "Text Answer"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6">
          <QuestionFormFields
            form={form}
            setForm={setForm}
            submitLabel="Save Changes"
            onSubmit={handleSubmit}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW MODAL  (read-only view of a question)
// ─────────────────────────────────────────────────────────────────────────────

function PreviewModal({ question, onClose }: { question: Question; onClose: () => void }) {
  const OPTION_COLORS = { A: "#60a5fa", B: "#34d399", C: "#f59e0b", D: "#f472b6" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", zIndex: 1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(96,165,250,0.12)" }}>
              <Eye size={15} style={{ color: "#60a5fa" }} />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "var(--text)" }}>Question Preview</h2>
          </div>
          <div className="flex items-center gap-2">
            <QTypeBadge type={question.questionType} />
            <QStatusBadge status={question.status} />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer ml-1"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Question content */}
          <div>
            <p style={sectionLabel}>Question</p>
            <p className="text-[14px] leading-relaxed" style={{ color: "var(--text)" }}>
              {question.questionContent}
            </p>
          </div>

          {/* Options */}
          {question.questionType === "option" && (
            <div>
              <p style={sectionLabel}>Options</p>
              <div className="flex flex-col gap-2">
                {(["A","B","C","D"] as const).map(letter => {
                  const isCorrect = question.correctOption === letter;
                  const color = OPTION_COLORS[letter];
                  return (
                    <div
                      key={letter}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{
                        background: isCorrect ? `${color}18` : "var(--surface2)",
                        border:     isCorrect ? `1px solid ${color}40` : "1px solid var(--border)",
                      }}
                    >
                      <span
                        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold"
                        style={{ background: `${color}20`, color }}
                      >
                        {letter}
                      </span>
                      <span className="text-[13.5px] flex-1" style={{ color: isCorrect ? color : "var(--text2)" }}>
                        {question[`option${letter}` as "optionA"]}
                      </span>
                      {isCorrect && (
                        <CheckCircle size={15} style={{ color, flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Text answers */}
          {question.questionType === "text" && (
            <div>
              <p style={sectionLabel}>Accepted Answers</p>
              <div className="flex flex-wrap gap-2">
                {question.acceptedAnswers.map((ans, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg text-[12.5px] font-mono"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
                  >
                    {ans}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hint */}
          {question.hintText && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--amber)" }}>
                <Lightbulb size={11} className="inline mr-1" /> Hint
                <span className="ml-2 font-normal normal-case" style={{ color: "var(--text4)" }}>
                  (−{question.hintXpPenalty} XP if revealed)
                </span>
              </p>
              <p className="text-[13px]" style={{ color: "var(--text2)" }}>{question.hintText}</p>
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(34,211,160,0.07)", border: "1px solid rgba(34,211,160,0.22)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--green)" }}>
                <BookOpen size={11} className="inline mr-1" /> Explanation
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text2)" }}>{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE QUESTION CARD
// ─────────────────────────────────────────────────────────────────────────────

function QuestionCard({
  q, onEdit, onDelete, onPreview, onQuickStatusToggle, onOrderBlur, onOrderChange,
}: {
  q: Question;
  onEdit:              (q: Question) => void;
  onDelete:            (q: Question) => void;
  onPreview:           (q: Question) => void;
  onQuickStatusToggle: (q: Question) => void;
  onOrderBlur:         (id: string, v: number) => void;
  onOrderChange:       (id: string, v: number) => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[13.5px] font-medium leading-snug flex-1 min-w-0"
          style={{ color: "var(--text)" }}
        >
          {q.questionContent.slice(0, 100)}{q.questionContent.length > 100 ? "…" : ""}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <QTypeBadge type={q.questionType} />
        <QStatusBadge status={q.status} />
        {q.hintText && (
          <span className="flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.10)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Lightbulb size={10} /> Hint
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
            Order
          </span>
          <input
            type="number"
            value={q.displayOrder}
            onChange={e => onOrderChange(q._id, Number(e.target.value))}
            onBlur={e  => onOrderBlur(q._id,   Number(e.target.value))}
            className="w-12 text-center rounded-lg border-none text-[13px] font-mono py-1"
            style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
          />
        </div>
        <span className="text-[11.5px]" style={{ color: "var(--text4)" }}>
          {new Date(q.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-4 gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => onPreview(q)}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa" }}
        >
          <Eye size={12} /> View
        </button>
        <button
          onClick={() => onQuickStatusToggle(q)}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer"
          style={{
            background: q.status === "draft" ? "rgba(34,211,160,0.10)" : "rgba(245,158,11,0.10)",
            color:      q.status === "draft" ? "var(--green)"           : "var(--amber)",
          }}
        >
          {q.status === "draft" ? <><CheckCircle size={12} /> Pub</> : <><FileText size={12} /> Draft</>}
        </button>
        <button
          onClick={() => onEdit(q)}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={() => onDelete(q)}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer"
          style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}
        >
          <Trash2 size={12} /> Del
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function QuestionsPage() {

  // ── Hierarchy selectors ────────────────────────────────────────────────────
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [levelsList,    setLevelsList]    = useState<LevelItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [selectedLvlId, setSelectedLvlId] = useState("");
  const [catsLoading,   setCatsLoading]   = useState(true);
  const [subsLoading,   setSubsLoading]   = useState(false);
  const [lvlsLoading,   setLvlsLoading]   = useState(false);

  // ── Questions data ─────────────────────────────────────────────────────────
  const [questions,  setQuestions]  = useState<Question[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 50;

  // ── Filters ────────────────────────────────────────────────────────────────
  const [fetchLoading,  setFetchLoading]  = useState(false);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<QStatusFilter>("all");
  const [typeFilter,    setTypeFilter]    = useState<QTypeFilter>("all");
  const [hintFilter,    setHintFilter]    = useState<HintFilter>("all");

  // ── Add form ───────────────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm,    setAddForm]    = useState<QFormState>({ ...DEFAULT_FORM });

  // ── Edit / Delete / Preview ────────────────────────────────────────────────
  const [editTarget,    setEditTarget]    = useState<Question | null>(null);
  const [editLoading,   setEditLoading]   = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<Question | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<Question | null>(null);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"displayOrder" | "createdAt">("displayOrder");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");

  // ── Drag ───────────────────────────────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);

  // ── Debounced search ───────────────────────────────────────────────────────
  const searchTimer                           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // ── Fetch categories ───────────────────────────────────────────────────────
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

  // ── Fetch subcategories when cat changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedCatId) { setSubcategories([]); setSelectedSubId(""); return; }
    setSubsLoading(true);
    setSelectedSubId(""); setLevelsList([]); setSelectedLvlId(""); setQuestions([]);
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

  // ── Fetch levels when sub changes ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedSubId) { setLevelsList([]); setSelectedLvlId(""); return; }
    setLvlsLoading(true);
    setSelectedLvlId(""); setQuestions([]);
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

  // ── Fetch questions ────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async (pg = page) => {
    if (!selectedLvlId) { setQuestions([]); setTotal(0); return; }
    setFetchLoading(true);
    try {
      const p = new URLSearchParams({
        levelId:      selectedLvlId,
        status:       statusFilter,
        search:       debouncedSearch,
        page:         String(pg),
        limit:        String(LIMIT),
      });
      if (typeFilter !== "all") p.set("questionType", typeFilter);
      if (hintFilter === "with")    p.set("hasHint", "true");
      if (hintFilter === "without") p.set("hasHint", "false");

      const res  = await fetch(`/api/admin/questions?${p}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "Failed to load"); return; }
      setQuestions(data.questions);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Network error");
    } finally {
      setFetchLoading(false);
    }
  }, [selectedLvlId, statusFilter, typeFilter, hintFilter, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [selectedLvlId, statusFilter, typeFilter, hintFilter, debouncedSearch]);

  useEffect(() => {
    fetchQuestions(page);
  }, [selectedLvlId, statusFilter, typeFilter, hintFilter, debouncedSearch, page]); // eslint-disable-line

  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLvlId) { toast.error("Select a level first"); return; }
    if (!addForm.questionContent.trim()) { toast.error("Question content is required"); return; }
    if (addForm.questionType === "option") {
      if (!addForm.optionA.trim() || !addForm.optionB.trim() || !addForm.optionC.trim() || !addForm.optionD.trim()) {
        toast.error("All four options are required"); return;
      }
      if (!addForm.correctOption) { toast.error("Mark a correct option"); return; }
    }
    if (addForm.questionType === "text" && addForm.acceptedAnswers.length === 0) {
      toast.error("Add at least one accepted answer"); return;
    }

    setAddLoading(true);
    try {
      // Resolve subcategoryId and categoryId from selected level
      const lvl = levelsList.find(l => l._id === selectedLvlId);
      if (!lvl) { toast.error("Level not found"); return; }

      const res  = await fetch("/api/admin/questions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          levelId:         selectedLvlId,
          subcategoryId:   selectedSubId,
          categoryId:      selectedCatId,
          questionType:    addForm.questionType,
          questionContent: addForm.questionContent.trim(),
          optionA:         addForm.optionA,
          optionB:         addForm.optionB,
          optionC:         addForm.optionC,
          optionD:         addForm.optionD,
          correctOption:   addForm.correctOption,
          acceptedAnswers: addForm.acceptedAnswers,
          hintText:        addForm.hintText.trim(),
          hintXpPenalty:   Number(addForm.hintXpPenalty),
          explanation:     addForm.explanation.trim(),
          displayOrder:    Number(addForm.displayOrder) || 0,
          status:          addForm.status,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success("Question created!");
      setAddForm({ ...DEFAULT_FORM });
      setAddOpen(false);
      fetchQuestions(1); setPage(1);
    } catch {
      toast.error("Failed to create question");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const saveQuestion = async (id: string, data: Partial<Question>) => {
    setEditLoading(true);
    try {
      const res  = await fetch(`/api/admin/questions/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("Question updated!");
      setEditTarget(null);
      setQuestions(prev => prev.map(q => q._id === id ? { ...q, ...data } as Question : q));
    } catch {
      toast.error("Failed to update");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Quick status toggle ────────────────────────────────────────────────────
  const handleQuickStatusToggle = (q: Question) => {
    const newStatus = q.status === "draft" ? "published" : "draft";
    saveQuestion(q._id, { status: newStatus });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res  = await fetch(`/api/admin/questions/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      toast.success("Question deleted.");
      setDeleteTarget(null);
      setQuestions(prev => prev.filter(q => q._id !== deleteTarget._id));
      setTotal(t => t - 1);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Inline order ───────────────────────────────────────────────────────────
  const handleOrderBlur = async (id: string, v: number) => {
    try {
      await fetch("/api/admin/questions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates: [{ id, displayOrder: v }] }),
      });
    } catch { toast.error("Failed to save order"); }
  };

  const handleOrderChange = (id: string, v: number) =>
    setQuestions(prev => prev.map(q => q._id === id ? { ...q, displayOrder: v } : q));

  // ── Drag reorder ───────────────────────────────────────────────────────────
  const onDragStart = (idx: number) => { dragIdx.current = idx; };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const r = [...questions];
    const [m] = r.splice(dragIdx.current, 1);
    r.splice(idx, 0, m);
    dragIdx.current = idx;
    setQuestions(r.map((q, i) => ({ ...q, displayOrder: i })));
  };

  const onDragEnd = async () => {
    dragIdx.current = null;
    try {
      await fetch("/api/admin/questions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ updates: questions.map(q => ({ id: q._id, displayOrder: q.displayOrder })) }),
      });
      toast.success("Order saved");
    } catch { toast.error("Failed to save order"); }
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = [...questions].sort((a, b) => {
    const va = a[sortField] as string | number;
    const vb = b[sortField] as string | number;
    if (va < vb) return sortDir === "asc" ? -1 :  1;
    if (va > vb) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const toggleSort = (f: typeof sortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField !== field
      ? <ChevronUp size={12} style={{ opacity: 0.3 }} />
      : sortDir === "asc"
        ? <ChevronUp   size={12} style={{ color: "var(--accent)" }} />
        : <ChevronDown size={12} style={{ color: "var(--accent)" }} />;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const selectedCat = categories.find(c    => c._id === selectedCatId) ?? null;
  const selectedSub = subcategories.find(s  => s._id === selectedSubId) ?? null;
  const selectedLvl = levelsList.find(l    => l._id === selectedLvlId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modals */}
      {editTarget    && <EditModal    question={editTarget}    onSave={saveQuestion} onClose={() => setEditTarget(null)}    loading={editLoading}   />}
      {deleteTarget  && <DeleteModal  question={deleteTarget}  onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}   loading={deleteLoading} />}
      {previewTarget && <PreviewModal question={previewTarget} onClose={() => setPreviewTarget(null)} />}

      <div className="flex flex-col gap-5">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(232,67,147,0.13)" }}>
                <HelpCircle size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-bold" style={{ color: "var(--text)" }}>
                Questions Management
              </h1>
            </div>
            <p className="text-[13px] ml-10" style={{ color: "var(--text3)" }}>
              Category → Subcategory → Level → <strong style={{ color: "var(--accent)" }}>Question</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 ml-10 sm:ml-0">
            <button
              onClick={() => fetchQuestions(page)}
              disabled={fetchLoading || !selectedLvlId}
              className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer shrink-0"
              style={{ background: "var(--surface2)", color: "var(--text3)" }}
              title="Refresh"
            >
              <RefreshCw size={15} className={fetchLoading ? "animate-spin" : ""} />
            </button>
            <Link
              href="/admin/questions/bulk-upload"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-semibold no-underline"
              style={{ background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }}
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Bulk Upload</span>
            </Link>
            <button
              onClick={() => setAddOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-semibold border-none cursor-pointer"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {addOpen ? <X size={15} /> : <Plus size={15} />}
              <span>{addOpen ? "Cancel" : "Add Question"}</span>
            </button>
          </div>
        </div>

        {/* ── 3-Level Hierarchy Selector ── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: "var(--accent)" }} />
            <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              Select Context
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label style={labelStyle}><Tag size={11} className="inline mr-1" />Category</label>
              {catsLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text3)" }}>
                  <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
                </div>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={selectedCatId}
                  onChange={e => { setSelectedCatId(e.target.value); setSearch(""); setPage(1); }}
                >
                  <option value="">— Select Category —</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Subcategory */}
            <div>
              <label style={labelStyle}><Layers size={11} className="inline mr-1" />Subcategory</label>
              {subsLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text3)" }}>
                  <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
                </div>
              ) : !selectedCatId ? (
                <div className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text4)" }}>
                  Select a category first
                </div>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={selectedSubId}
                  onChange={e => { setSelectedSubId(e.target.value); setSearch(""); setPage(1); }}
                >
                  <option value="">— Select Subcategory —</option>
                  {subcategories.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Level */}
            <div>
              <label style={labelStyle}><BarChart3 size={11} className="inline mr-1" />Level</label>
              {lvlsLoading ? (
                <div className="flex items-center gap-2 py-2" style={{ color: "var(--text3)" }}>
                  <Loader2 size={14} className="animate-spin" /><span className="text-[13px]">Loading…</span>
                </div>
              ) : !selectedSubId ? (
                <div className="rounded-xl px-3 py-2.5 text-[13px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text4)" }}>
                  Select a subcategory first
                </div>
              ) : (
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={selectedLvlId}
                  onChange={e => { setSelectedLvlId(e.target.value); setSearch(""); setPage(1); }}
                >
                  <option value="">— Select Level —</option>
                  {levelsList.map(l => (
                    <option key={l._id} value={l._id}>
                      Level {l.levelNumber}{l.name ? ` — ${l.name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Breadcrumb chips */}
          {(selectedCat || selectedSub || selectedLvl) && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCat && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(232,67,147,0.10)", border: "1px solid rgba(232,67,147,0.25)", color: "var(--accent)" }}>
                  <Tag size={10} /> {selectedCat.name}
                </span>
              )}
              {selectedSub && <ChevronUp size={12} className="rotate-90" style={{ color: "var(--text4)" }} />}
              {selectedSub && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>
                  <Layers size={10} /> {selectedSub.name}
                </span>
              )}
              {selectedLvl && <ChevronUp size={12} className="rotate-90" style={{ color: "var(--text4)" }} />}
              {selectedLvl && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "rgba(34,211,160,0.10)", border: "1px solid rgba(34,211,160,0.25)", color: "var(--green)" }}>
                  <BarChart3 size={10} /> Level {selectedLvl.levelNumber}{selectedLvl.name ? ` — ${selectedLvl.name}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Add Question Form ── */}
        {addOpen && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <h2 className="text-[14px] font-bold mb-5 flex items-center gap-2" style={{ color: "var(--text)" }}>
              <Plus size={15} style={{ color: "var(--accent)" }} />
              New Question
              {selectedLvl && (
                <span className="text-[12px] font-normal ml-1" style={{ color: "var(--text3)" }}>
                  in Level {selectedLvl.levelNumber}
                </span>
              )}
            </h2>

            {!selectedLvlId ? (
              <p className="text-[13px]" style={{ color: "var(--danger)" }}>
                ⚠️ Please select a category, subcategory, and level above before adding a question.
              </p>
            ) : (
              <QuestionFormFields
                form={addForm}
                setForm={setAddForm}
                submitLabel="Create Question"
                onSubmit={handleAdd}
                loading={addLoading}
              />
            )}
          </div>
        )}

        {/* ── No Level Selected ── */}
        {!selectedLvlId && !fetchLoading && (
          <div
            className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
            style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface2)" }}>
              <HelpCircle size={26} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              Select all three hierarchy levels above to manage questions
            </p>
          </div>
        )}

        {/* ── Search + Filters ── */}
        {selectedLvlId && (
          <>
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text4)" }} />
                <input
                  style={{ ...inputStyle, paddingLeft: "36px", paddingRight: search ? "36px" : "13px" }}
                  placeholder="Search question content…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 border-none cursor-pointer bg-transparent p-0" style={{ color: "var(--text4)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap gap-3">
                {/* Status */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
                  {(["all","draft","published"] as QStatusFilter[]).map(f => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium border-none cursor-pointer whitespace-nowrap"
                      style={{ background: statusFilter === f ? "var(--accent)" : "transparent", color: statusFilter === f ? "#fff" : "var(--text3)" }}>
                      {f === "all" ? "All Status" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Type */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
                  {(["all","option","text"] as QTypeFilter[]).map(f => (
                    <button key={f} onClick={() => setTypeFilter(f)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium border-none cursor-pointer whitespace-nowrap"
                      style={{ background: typeFilter === f ? "var(--accent)" : "transparent", color: typeFilter === f ? "#fff" : "var(--text3)" }}>
                      {f === "all" ? "All Types" : f === "option" ? "Option" : "Text"}
                    </button>
                  ))}
                </div>

                {/* Hint */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
                  {(["all","with","without"] as HintFilter[]).map(f => (
                    <button key={f} onClick={() => setHintFilter(f)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium border-none cursor-pointer whitespace-nowrap"
                      style={{ background: hintFilter === f ? "var(--accent)" : "transparent", color: hintFilter === f ? "#fff" : "var(--text3)" }}>
                      {f === "all" ? "All Hints" : f === "with" ? "With Hint" : "No Hint"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-4 flex-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                <strong style={{ color: "var(--text)" }}>{questions.length}</strong> of <strong style={{ color: "var(--text)" }}>{total}</strong> shown
              </span>
              <span className="hidden sm:inline text-[12px]" style={{ color: "var(--text3)" }}>
                Drag <GripVertical size={12} className="inline" /> to reorder
              </span>
              {totalPages > 1 && (
                <span className="text-[12px]" style={{ color: "var(--text3)" }}>
                  Page <strong style={{ color: "var(--text)" }}>{page}</strong> / {totalPages}
                </span>
              )}
            </div>
          </>
        )}

        {/* ── Loading ── */}
        {fetchLoading && (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: "var(--text3)" }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-[13px]">Loading questions…</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!fetchLoading && selectedLvlId && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl" style={{ background: "var(--surface)", border: "1px dashed var(--border2)" }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface2)" }}>
              <HelpCircle size={24} style={{ color: "var(--text4)" }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: "var(--text3)" }}>
              {search || statusFilter !== "all" || typeFilter !== "all" || hintFilter !== "all"
                ? "No questions match your filters"
                : `No questions in Level ${selectedLvl?.levelNumber ?? ""}`}
            </p>
            {!search && statusFilter === "all" && typeFilter === "all" && hintFilter === "all" && (
              <button onClick={() => setAddOpen(true)} className="text-[13px] font-medium border-none cursor-pointer bg-transparent" style={{ color: "var(--accent)" }}>
                + Add the first question
              </button>
            )}
          </div>
        )}

        {/* ── MOBILE CARDS ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map(q => (
              <QuestionCard
                key={q._id} q={q}
                onEdit={setEditTarget} onDelete={setDeleteTarget}
                onPreview={setPreviewTarget}
                onQuickStatusToggle={handleQuickStatusToggle}
                onOrderBlur={handleOrderBlur} onOrderChange={handleOrderChange}
              />
            ))}
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        {!fetchLoading && sorted.length > 0 && (
          <div className="rounded-2xl overflow-hidden hidden md:block" style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            {/* Header */}
            <div
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: "36px 48px 1fr 88px 80px 80px 104px 128px",
                background: "var(--surface2)", borderBottom: "1px solid var(--border2)",
              }}
            >
              {([
                { label: "",        field: null           },
                { label: "#",       field: "displayOrder" },
                { label: "Question",field: null           },
                { label: "Type",    field: null           },
                { label: "Hint",    field: null           },
                { label: "Status",  field: null           },
                { label: "Created", field: "createdAt"    },
                { label: "Actions", field: null           },
              ] as { label: string; field: string | null }[]).map(({ label, field }, i) => (
                <div key={i}>
                  {field ? (
                    <button onClick={() => toggleSort(field as typeof sortField)}
                      className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
                      style={{ color: "var(--text4)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
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
            {sorted.map((q, idx) => (
              <div
                key={q._id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                className="grid items-center px-4 py-3 transition-colors"
                style={{ gridTemplateColumns: "36px 48px 1fr 88px 80px 80px 104px 128px", borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Drag */}
                <div className="flex items-center justify-center cursor-grab" style={{ color: "var(--text4)" }}>
                  <GripVertical size={16} />
                </div>

                {/* Order */}
                <div>
                  <input
                    type="number"
                    value={q.displayOrder}
                    onChange={e => handleOrderChange(q._id, Number(e.target.value))}
                    onBlur={e  => handleOrderBlur(q._id,   Number(e.target.value))}
                    className="w-11 text-center rounded-lg border-none text-[12px] font-mono py-1"
                    style={{ background: "var(--surface2)", color: "var(--text2)", outline: "none" }}
                  />
                </div>

                {/* Question preview */}
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] truncate" style={{ color: "var(--text)" }} title={q.questionContent}>
                    {q.questionContent}
                  </p>
                  {q.hintText && (
                    <span className="text-[11px]" style={{ color: "var(--amber)" }}>
                      <Lightbulb size={10} className="inline mr-0.5" />{q.hintXpPenalty} XP penalty
                    </span>
                  )}
                </div>

                {/* Type */}
                <div><QTypeBadge type={q.questionType} /></div>

                {/* Hint */}
                <div>
                  {q.hintText
                    ? <span className="text-[11.5px]" style={{ color: "var(--amber)" }}><Lightbulb size={12} className="inline mr-1" />Yes</span>
                    : <span className="text-[11.5px]" style={{ color: "var(--text4)" }}>—</span>}
                </div>

                {/* Status */}
                <div><QStatusBadge status={q.status} /></div>

                {/* Created */}
                <div><span className="text-[12px]" style={{ color: "var(--text4)" }}>{formatDate(q.createdAt)}</span></div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPreviewTarget(q)} title="Preview"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa" }}>
                    <Eye size={13} />
                  </button>
                  <button onClick={() => handleQuickStatusToggle(q)}
                    title={q.status === "draft" ? "Publish" : "Revert to Draft"}
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: q.status === "draft" ? "rgba(34,211,160,0.10)" : "rgba(245,158,11,0.10)", color: q.status === "draft" ? "var(--green)" : "var(--amber)" }}>
                    {q.status === "draft" ? <CheckCircle size={13} /> : <FileText size={13} />}
                  </button>
                  <button onClick={() => setEditTarget(q)} title="Edit"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(232,67,147,0.10)", color: "var(--accent)" }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(q)} title="Delete"
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer"
                    style={{ background: "rgba(248,113,113,0.10)", color: "var(--danger)" }}>
                    <Trash2 size={13} />
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
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}>
              ← Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-9 h-9 rounded-xl text-[13px] font-medium border-none cursor-pointer"
                  style={{ background: page === p ? "var(--accent)" : "var(--surface)", color: page === p ? "#fff" : "var(--text2)", border: "1px solid var(--border2)" }}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-xl text-[13px] font-medium border-none cursor-pointer disabled:opacity-40"
              style={{ background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border2)" }}>
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}