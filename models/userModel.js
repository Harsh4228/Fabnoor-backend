// models/userModel.js
import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

const wishlistSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },
    color: {
      type: String,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    shopName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    cartData: { type: Object, default: {} },

    wishlist: {
      type: [wishlistSchema],
      default: [],
    },

    dob: { type: String, default: "" },
    gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipcode: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Kept when soft-deleted so the unique index on `email` doesn't block a
    // new signup with the same address while the old account is trashed.
    originalEmail: { type: String, default: undefined },

    resetOtp: { type: String, default: "" },
    resetOtpExpireAt: { type: Number, default: 0 },
  },
  { minimize: false, timestamps: true }
);

userSchema.plugin(softDeletePlugin);

const userModel =
  mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;
