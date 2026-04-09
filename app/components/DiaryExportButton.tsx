"use client";
// app/components/DiaryExportButton.tsx
// Beautiful PDF export for diary entries — client-side generation via jsPDF
// Max 3 downloads per date per user (enforced server-side)
// FIX: Removed all emojis from PDF-rendered text — jsPDF built-in fonts don't support them

import React, { useState, useEffect, useCallback } from "react";

interface DiaryExportButtonProps {
  currentDate: string;          // YYYY-MM-DD
  entry: {
    content: string;
    heading?: string;
    mood?: string | null;
    editCount?: number;
  } | null;
  isDark?: boolean;
  canExport?: boolean;          // false if entry has no content
}

const MOODS: Record<string, { label: string }> = {
  happy:      { label: "Happy"      },
  neutral:    { label: "Neutral"    },
  joy:        { label: "Joyful"     },
  wink:       { label: "Winky"      },
  productive: { label: "Productive" },
  tired:      { label: "Tired"      },
  sad:        { label: "Sad"        },
  grateful:   { label: "Grateful"   },
};

// UI-only emojis (rendered in browser, NOT passed to jsPDF)
const MOOD_EMOJI: Record<string, string> = {
  happy: "🙂", neutral: "😊", joy: "😄", wink: "😉",
  productive: "🔥", tired: "😴", sad: "😔", grateful: "🙏",
};

function fmtFull(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function stripHtmlToSegments(html: string): Array<{
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: string;
}> {
  if (typeof window === "undefined") return [{ text: html.replace(/<[^>]+>/g, "") }];

  const div = document.createElement("div");
  div.innerHTML = html;

  const segments: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    align?: string;
  }> = [];

  function walk(
    node: Node,
    bold = false,
    italic = false,
    underline = false,
    color = "#1c1410",
    align = "left"
  ) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) segments.push({ text, bold, italic, underline, color, align });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const style = el.getAttribute("style") ?? "";

    let b = bold, i = italic, u = underline, c = color, a = align;
    if (tag === "b" || tag === "strong") b = true;
    if (tag === "i" || tag === "em")     i = true;
    if (tag === "u")                     u = true;

    const colorMatch = style.match(/color\s*:\s*([^;]+)/i);
    if (colorMatch) c = colorMatch[1].trim();
    const alignMatch = style.match(/text-align\s*:\s*([^;]+)/i);
    if (alignMatch) a = alignMatch[1].trim();

    if (tag === "br") {
      segments.push({ text: "\n", bold: b, italic: i, underline: u, color: c, align: a });
      return;
    }
    if (tag === "div" || tag === "p") {
      for (const child of Array.from(el.childNodes)) walk(child, b, i, u, c, a);
      segments.push({ text: "\n", bold: b, italic: i, underline: u, color: c, align: a });
      return;
    }
    for (const child of Array.from(el.childNodes)) walk(child, b, i, u, c, a);
  }

  for (const child of Array.from(div.childNodes)) walk(child);
  return segments;
}

export default function DiaryExportButton({
  currentDate,
  entry,
  isDark,
  canExport,
}: DiaryExportButtonProps) {
  const [exportsLeft, setExportsLeft] = useState<number | null>(null);
  const [exportCount, setExportCount] = useState(0);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isChecking,  setIsChecking]  = useState(true);
  const [msg,         setMsg]         = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!currentDate) return;
    setIsChecking(true);
    try {
      const r = await fetch(`/api/diary/export?date=${currentDate}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (r.ok) {
        const data = await r.json();
        setExportsLeft(data.exportsLeft ?? 0);
        setExportCount(data.exportCount ?? 0);
      }
    } finally {
      setIsChecking(false);
    }
  }, [currentDate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const hasContent  = !!(entry?.content?.trim());
  const canDownload = hasContent && (exportsLeft ?? 0) > 0 && canExport !== false;

  function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace("#", "");
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16),
      ];
    }
    if (clean.length === 6) {
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }
    return [28, 20, 8];
  }

  async function generatePDF() {
    if (!entry || !canDownload) return;
    setIsLoading(true);
    setShowConfirm(false);
    setMsg("");

    try {
      // 1. Increment on server first
      const r = await fetch("/api/diary/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: currentDate }),
      });

      if (!r.ok) {
        const err = await r.json();
        setMsg(err.error ?? "Export failed.");
        setTimeout(() => setMsg(""), 4000);
        setIsLoading(false);
        return;
      }

      const data = await r.json();
      setExportsLeft(data.exportsLeft ?? 0);
      setExportCount(data.exportCount ?? 0);

      // 2. Dynamically import jsPDF
      const { jsPDF } = await import("jspdf");

      const PAGE_W    = 210;   // A4 mm
      const PAGE_H    = 297;
      const MARGIN    = 18;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      // ── Helper: draw the page background (called for every page) ──────────
      function drawPageBackground() {
        // Cream base
        doc.setFillColor(250, 243, 228);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");

        // Left spine — dark brown
        doc.setFillColor(107, 74, 46);
        doc.rect(0, 0, 8, PAGE_H, "F");
        // Spine highlight strip
        doc.setFillColor(139, 94, 60);
        doc.rect(8, 0, 3, PAGE_H, "F");

        // Top & bottom decorative strips
        doc.setFillColor(107, 74, 46);
        doc.rect(0, 0, PAGE_W, 7, "F");
        doc.rect(0, PAGE_H - 7, PAGE_W, 7, "F");

        // Ruled horizontal lines
        doc.setDrawColor(226, 204, 168);
        doc.setLineWidth(0.18);
        for (let y = 60; y < PAGE_H - 12; y += 7.5) {
          doc.line(MARGIN + 2, y, PAGE_W - MARGIN, y);
        }

        // Red margin line
        doc.setDrawColor(200, 100, 80);
        doc.setLineWidth(0.4);
        doc.line(MARGIN + 16, 12, MARGIN + 16, PAGE_H - 10);
      }

      // ── PAGE 1 ────────────────────────────────────────────────────────────
      drawPageBackground();

      let curY = 14;

      // Date stamp box (top right) — NO emoji, plain text only
      const dateStr = fmtFull(currentDate);
      doc.setFontSize(8.5);
      doc.setTextColor(107, 74, 46);
      doc.setFont("helvetica", "italic");
      const dateW = doc.getTextWidth(dateStr);
      const stampX = PAGE_W - MARGIN - dateW - 12;
      doc.setFillColor(238, 223, 192);
      doc.roundedRect(stampX, curY - 4, dateW + 12, 9, 2, 2, "F");
      doc.setDrawColor(196, 168, 130);
      doc.setLineWidth(0.3);
      doc.roundedRect(stampX, curY - 4, dateW + 12, 9, 2, 2, "S");
      doc.text(dateStr, PAGE_W - MARGIN - 6, curY + 1.5, { align: "right" });

      // ── HEADING ───────────────────────────────────────────────────────────
      if (entry.heading) {
        curY = 16;
        doc.setFontSize(16);
        doc.setTextColor(139, 37, 0);
        doc.setFont("helvetica", "bolditalic");
        // Word-wrap heading if long
        const headingLines = doc.splitTextToSize(entry.heading, CONTENT_W - 20);
        doc.text(headingLines, MARGIN + 18, curY + 9);
        curY += 9 + headingLines.length * 7.5 + 2;
      } else {
        curY = 24;
      }

      // ── MOOD BADGE — text only, no emoji ─────────────────────────────────
      if (entry.mood && MOODS[entry.mood]) {
        const moodLabel = `Mood: ${MOODS[entry.mood].label}`;
        doc.setFontSize(8);
        doc.setTextColor(107, 74, 46);
        doc.setFont("helvetica", "bold");
        const moodW = doc.getTextWidth(moodLabel) + 12;
        doc.setFillColor(238, 223, 192);
        doc.roundedRect(MARGIN + 18, curY, moodW, 7, 3, 3, "F");
        doc.setDrawColor(196, 168, 130);
        doc.setLineWidth(0.25);
        doc.roundedRect(MARGIN + 18, curY, moodW, 7, 3, 3, "S");
        doc.text(moodLabel, MARGIN + 18 + moodW / 2, curY + 4.5, { align: "center" });
        curY += 11;
      } else {
        curY += 4;
      }

      // ── DIVIDER ───────────────────────────────────────────────────────────
      doc.setDrawColor(212, 184, 150);
      doc.setLineWidth(0.5);
      doc.line(MARGIN + 18, curY, PAGE_W - MARGIN, curY);
      curY += 8;

      // ── CONTENT — parse HTML segments, word-wrap, render ─────────────────
      const segments = stripHtmlToSegments(entry.content);
      const lineHeight = 7.5;
      const fontSize   = 11;

      type Seg = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; color?: string };
      let lineBuffer: Seg[] = [];
      let lineAlign  = "left";

      function newPage() {
        doc.addPage();
        drawPageBackground();
        curY = 18;
      }

      function flushLine() {
        if (!lineBuffer.length) { curY += lineHeight * 0.45; return; }

        if (curY > PAGE_H - 18) newPage();

        // Measure total width for alignment
        let totalW = 0;
        for (const seg of lineBuffer) {
          const fStyle = seg.bold && seg.italic
            ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(fontSize);
          totalW += doc.getTextWidth(seg.text);
        }

        let x = MARGIN + 18;
        if (lineAlign === "center") x = (PAGE_W / 2) - totalW / 2;
        else if (lineAlign === "right") x = PAGE_W - MARGIN - totalW;

        for (const seg of lineBuffer) {
          const fStyle = seg.bold && seg.italic
            ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
          doc.setFont("helvetica", fStyle);
          doc.setFontSize(fontSize);
          const rgb = hexToRgb(seg.color ?? "#1c1410");
          doc.setTextColor(...rgb);
          doc.text(seg.text, x, curY);
          const w = doc.getTextWidth(seg.text);
          if (seg.underline) {
            doc.setDrawColor(...rgb);
            doc.setLineWidth(0.25);
            doc.line(x, curY + 0.9, x + w, curY + 0.9);
          }
          x += w;
        }

        curY += lineHeight;
        lineBuffer = [];
        lineAlign  = "left";
      }

      for (const seg of segments) {
        if (seg.text === "\n") { flushLine(); continue; }
        if (seg.align) lineAlign = seg.align;

        const fStyle = seg.bold && seg.italic
          ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal";
        doc.setFont("helvetica", fStyle);
        doc.setFontSize(fontSize);

        // Word-wrap
        const words = seg.text.split(/(\s+)/);
        let accum = "";
        for (const w of words) {
          const test = accum + w;
          const testW = doc.getTextWidth(test);
          if (testW > CONTENT_W - 22 && accum.trim()) {
            lineBuffer.push({ ...seg, text: accum });
            flushLine();
            accum = w.trimStart();
          } else {
            accum = test;
          }
        }
        if (accum) lineBuffer.push({ ...seg, text: accum });
      }
      flushLine();

      // ── FOOTER on every page — plain text, NO emojis ──────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);

        // Thin line above footer
        doc.setDrawColor(196, 168, 130);
        doc.setLineWidth(0.25);
        doc.line(MARGIN + 18, PAGE_H - 9, PAGE_W - MARGIN, PAGE_H - 9);

        // Left: "My Diary  |  <date>"  — NO emoji
        doc.setFontSize(7.5);
        doc.setTextColor(168, 137, 106);
        doc.setFont("helvetica", "italic");
        doc.text(`My Diary  |  ${fmtFull(currentDate)}`, MARGIN + 18, PAGE_H - 5);

        // Center: download count
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(196, 168, 130);
        doc.text(`Download ${data.exportCount} of 3`, PAGE_W / 2, PAGE_H - 5, { align: "center" });

        // Right: page number
        doc.setFontSize(7.5);
        doc.setTextColor(168, 137, 106);
        doc.setFont("helvetica", "italic");
        doc.text(`${p} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
      }

      // ── SAVE FILE ─────────────────────────────────────────────────────────
      doc.save(`diary-${currentDate}.pdf`);
      setMsg(`Downloaded! ${data.exportsLeft} left`);
      setTimeout(() => setMsg(""), 4000);

    } catch (e) {
      console.error(e);
      setMsg("Export failed. Try again.");
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setIsLoading(false);
    }
  }

  const buttonDisabled = isLoading || isChecking || !canDownload;

  return (
    <>
      <style>{`
        .export-btn {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; padding: 6px 12px;
          border-radius: 10px; cursor: pointer; border: none;
          transition: all .15s; user-select: none; white-space: nowrap;
          background: linear-gradient(135deg, #8b5e3c, #6b4a2e);
          color: #fff; box-shadow: 0 2px 8px rgba(107,74,46,.3);
        }
        .export-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #7a5234, #5c3d25);
          box-shadow: 0 3px 12px rgba(107,74,46,.4);
          transform: translateY(-1px);
        }
        .export-btn:active:not(:disabled) { transform: scale(.97); }
        .export-btn:disabled {
          opacity: .4; cursor: not-allowed; transform: none; box-shadow: none;
        }
        .export-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%; font-size: 9px;
          font-weight: 800; background: rgba(255,255,255,.25); color: #fff;
        }
        .export-badge.warn { background: #ef4444; }

        .export-confirm-overlay {
          position: fixed; inset: 0; z-index: 70;
          background: rgba(0,0,0,.55); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .export-confirm-modal {
          background: var(--d-modal, #fdf5e6);
          border: 2px solid var(--d-border2, #c4a882);
          border-radius: 20px; padding: 28px 22px; max-width: 340px; width: 100%;
          box-shadow: 0 20px 60px rgba(80,40,10,.35);
        }

        @keyframes exportSpin { to { transform: rotate(360deg); } }
        .export-spinner {
          display: inline-block; width: 11px; height: 11px;
          border: 2px solid rgba(255,255,255,.4);
          border-top-color: #fff; border-radius: 50%;
          animation: exportSpin .7s linear infinite;
        }
      `}</style>

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div className="export-confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="export-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
              <h2 style={{
                fontFamily: "'Lora', Georgia, serif", fontStyle: "italic",
                fontSize: 17, fontWeight: 700,
                color: "var(--d-text, #2c1a08)", marginBottom: 8,
              }}>
                Export This Page?
              </h2>
              <p style={{ fontSize: 13, color: "var(--d-text2, #4a3520)", lineHeight: 1.5 }}>
                A beautiful PDF of <strong>{fmtFull(currentDate)}</strong> will be downloaded.
              </p>
              <div style={{
                marginTop: 12, padding: "8px 14px", borderRadius: 12,
                background: "var(--d-stamp, #eedfc0)",
                border: "1px solid var(--d-border2, #c4a882)",
              }}>
                <p style={{
                  fontSize: 12, fontWeight: 700,
                  color: exportsLeft === 1 ? "#ef4444" : "var(--d-accent, #8b5e3c)",
                }}>
                  ⚠️ {exportCount}/3 exports used — {exportsLeft} remaining for this date
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13,
                  fontWeight: 600, border: "1px solid var(--d-border2, #c4a882)",
                  background: "var(--d-hover, #eedabf)",
                  color: "var(--d-text2, #4a3520)", cursor: "pointer",
                }}>
                Cancel
              </button>
              <button
                onClick={generatePDF}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13,
                  fontWeight: 700, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #8b5e3c, #6b4a2e)", color: "#fff",
                }}>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Button Row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {msg && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: msg.startsWith("Export failed") ? "#ef4444" : "#22c55e",
          }}>
            {msg}
          </span>
        )}

        <button
          className="export-btn"
          disabled={buttonDisabled}
          onClick={() => { if (!canDownload) return; setShowConfirm(true); }}
          title={
            !hasContent        ? "No content to export" :
            exportsLeft === 0  ? "Export limit reached (3/3)" :
            `Export as PDF (${exportsLeft} remaining)`
          }
        >
          {isLoading ? (
            <><span className="export-spinner" /> Generating…</>
          ) : isChecking ? (
            <><span className="export-spinner" /></>
          ) : (
            <>
              📥
              <span className="hidden sm:inline">Export PDF</span>
              {exportsLeft !== null && (
                <span className={`export-badge${exportsLeft <= 1 ? " warn" : ""}`}>
                  {exportsLeft}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </>
  );
}