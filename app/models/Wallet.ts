

// app/models/Wallet.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  cashBalance: number;
  onlineBalance: number;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    cashBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    onlineBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export const Wallet: Model<IWallet> =
  (mongoose.models.Wallet as Model<IWallet>) ||
  mongoose.model<IWallet>("Wallet", WalletSchema);

export default Wallet;