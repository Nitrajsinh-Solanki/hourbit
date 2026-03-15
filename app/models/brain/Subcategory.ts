// app/models/brain/Subcategory.ts
// ─────────────────────────────────────────────────────────────────────────────
// SECOND level of the hierarchy:  Category → Subcategory → Level → Question
//
// FOREIGN KEY:  categoryId → Category._id
//
// CASCADE DELETION:
//   When a Subcategory is deleted its post-hook finds all child Levels
//   and calls deleteOne() on each, triggering Level's own cascade to Questions.
//
// SLUG:
//   Unique within the parent category — compound index on (categoryId, slug).
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document, Model } from "mongoose";

// ── TypeScript Interface ──────────────────────────────────────────────────────

export interface ISubcategory extends Document {
  categoryId:   mongoose.Types.ObjectId;
  name:         string;
  slug:         string;
  displayOrder: number;
  status:       "active" | "archived" | "deleted";
  createdAt:    Date;
  updatedAt:    Date;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Schema ────────────────────────────────────────────────────────────────────

const SubcategorySchema = new Schema<ISubcategory>(
  {
    /* ── Foreign key ── */
    categoryId: {
      type:     Schema.Types.ObjectId,
      ref:      "Category",
      required: true,
      index:    true,
    },

    /* ── Identity ── */
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 80,
    },

    slug: {
      type:      String,
      lowercase: true,
      trim:      true,
    },

    /* ── Ordering & visibility ── */
    displayOrder: {
      type:    Number,
      default: 0,
    },

    status: {
      type:    String,
      enum:    ["active", "archived", "deleted"],
      default: "active",
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Slug is unique WITHIN a category (same slug allowed in different categories)
SubcategorySchema.index({ categoryId: 1, slug: 1 },         { unique: true });
SubcategorySchema.index({ categoryId: 1, displayOrder: 1 });
SubcategorySchema.index({ categoryId: 1, status: 1 });

// ── Pre-save: auto-generate slug ──────────────────────────────────────────────

SubcategorySchema.pre("save", function () {
  const doc = this as any;
  if (!doc.slug || doc.isModified("name")) {
    doc.slug = toSlug(doc.name);
  }
});

// ── Post findOneAndDelete CASCADE → delete all child Levels ──────────────────

SubcategorySchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  const { Level } = await import("./Level");
  const levels = await Level.find({ subcategoryId: doc._id });
  for (const level of levels) {
    await (level as any).deleteOne();  // triggers Level's own cascade → Questions
  }
});

// ── Prevent model overwrite on Next.js hot reload ─────────────────────────────

export const Subcategory: Model<ISubcategory> =
  (mongoose.models.Subcategory as Model<ISubcategory>) ||
  mongoose.model<ISubcategory>("Subcategory", SubcategorySchema);

export default Subcategory;