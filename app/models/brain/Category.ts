// app/models/brain/Category.ts
// ─────────────────────────────────────────────────────────────────────────────
// ROOT of the hierarchy:  Category → Subcategory → Level → Question
//
// CASCADE DELETION:
//   When a Category document is deleted via findByIdAndDelete() / deleteOne(),
//   its post-hook fires and deletes all child Subcategories one-by-one.
//   Each Subcategory's own post-hook then cascades to Levels → Questions.
//
// SLUG:
//   Auto-generated from name on every save if no slug is provided.
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
      unique:    true,
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

CategorySchema.index({ slug: 1 },                    { unique: true });
CategorySchema.index({ status: 1 });
CategorySchema.index({ displayOrder: 1 });
CategorySchema.index({ status: 1, displayOrder: 1 });

// ── Pre-save: auto-generate slug from name ────────────────────────────────────
// Pattern matches exactly: DiaryEntrySchema.pre("save", function () { ... })

CategorySchema.pre("save", function () {
  const doc = this as any;
  if (!doc.slug || doc.isModified("name")) {
    doc.slug = toSlug(doc.name);
  }
});

// ── Post findOneAndDelete CASCADE → delete all child Subcategories ─────────────
// Uses "findOneAndDelete" which fires when findByIdAndDelete() is called.

CategorySchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  const { Subcategory } = await import("./Subcategory");
  const subcategories = await Subcategory.find({ categoryId: doc._id });
  for (const sub of subcategories) {
    // Call deleteOne() on each document so Subcategory's own cascade hook fires
    await (sub as any).deleteOne();
  }
});

// ── Prevent model overwrite on Next.js hot reload ─────────────────────────────

export const Category: Model<ICategory> =
  (mongoose.models.Category as Model<ICategory>) ||
  mongoose.model<ICategory>("Category", CategorySchema);

export default Category;