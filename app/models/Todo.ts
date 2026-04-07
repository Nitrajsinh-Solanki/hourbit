// app/models/Todo.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITodoTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface ITodo extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // "YYYY-MM-DD" — one document per user per day
  tasks: ITodoTask[];
  allCompletedToastShown: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TodoTaskSchema = new Schema<ITodoTask>(
  {
    id:          { type: String, required: true },
    text:        { type: String, required: true, maxlength: 150 },
    completed:   { type: Boolean, default: false },
    createdAt:   { type: Date,   default: Date.now },
    completedAt: { type: Date,   default: null },
  },
  { _id: false }
);

const TodoSchema = new Schema<ITodo>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    date: {
      type:     String,
      required: true,
      index:    true,
      // ISO date string YYYY-MM-DD
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    tasks: {
      type:    [TodoTaskSchema],
      default: [],
    },
    allCompletedToastShown: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Composite unique index — one doc per user per day
TodoSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Todo: Model<ITodo> =
  (mongoose.models.Todo as Model<ITodo>) ||
  mongoose.model<ITodo>("Todo", TodoSchema);

export default Todo;