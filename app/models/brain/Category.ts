// app/models/brain/Category.ts
// ─────────────────────────────────────────────────────────────────────────────
// ROOT of the hierarchy:  Category → Subcategory → Level → Question
//
// CASCADE DELETION:
//   When a Category document is deleted via findByIdAndDelete() the
//   "findOneAndDelete" post-hook fires and deletes all child Subcategories
//   one-by-one, each of which fires its own hook cascading to Levels → Questions.
//
// SLUG:
//   Auto-generated from name on every save if no slug is provided.
//   unique:true is set inline on the field — do NOT add a separate
//   CategorySchema.index({ slug: 1 }) call or Mongoose will warn about
//   a duplicate index.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, Document, Model } from "mongoose";

// ── TypeScript Interface ──────────────────────────────────────────────────────

export interface ICategory extends Document {
  name:         string;
  slug:         string;
  description:  string;
  displayOrder: number;
  status:       "active" | "archived" | "deleted";
  createdAt:    Date;
  updatedAt:    Date;
}

// ── Helper: convert any string to a URL-safe slug ─────────────────────────────

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

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 80,
    },

    slug: {
      type:      String,
      unique:    true,   // ← index declared HERE — no separate schema.index({ slug:1 }) needed
      lowercase: true,
      trim:      true,
    },

    description: {
      type:      String,
      default:   "",
      trim:      true,
      maxlength: 500,
    },

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
// NOTE: slug unique index is already created by `unique: true` on the field above.
//       Do NOT repeat it here — that causes the Mongoose duplicate-index warning.

CategorySchema.index({ status: 1 });
CategorySchema.index({ displayOrder: 1 });
CategorySchema.index({ status: 1, displayOrder: 1 });

// ── Pre-save: auto-generate slug from name ────────────────────────────────────

CategorySchema.pre("save", function () {
  const doc = this as any;
  if (!doc.slug || doc.isModified("name")) {
    doc.slug = toSlug(doc.name);
  }
});

// ── Post findOneAndDelete CASCADE → delete all child Subcategories ────────────
// Fires when findByIdAndDelete() is called from the API route.

CategorySchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  const { Subcategory } = await import("./Subcategory");
  const subcategories = await Subcategory.find({ categoryId: doc._id });
  for (const sub of subcategories) {
    await (sub as any).deleteOne();  // triggers Subcategory's own cascade → Levels → Questions
  }
});

// ── Prevent model overwrite on Next.js hot reload ─────────────────────────────

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ||
  mongoose.model<ICategory>("Category", CategorySchema);

export default Category;