// app/models/ExpenseCategory.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IExpenseCategory extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate category names per user (case-insensitive)
ExpenseCategorySchema.index(
  { userId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const ExpenseCategory: Model<IExpenseCategory> =
  (mongoose.models.ExpenseCategory as Model<IExpenseCategory>) ||
  mongoose.model<IExpenseCategory>("ExpenseCategory", ExpenseCategorySchema);

export default ExpenseCategory;