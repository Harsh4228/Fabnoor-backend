import mongoose from "mongoose";
import counterModel from "./counterModel.js";

/**
 * =========================
 * ORDER ITEM (PRODUCT SNAPSHOT)
 * =========================
 */
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "product",
      required: true,
    },

    name: {
      type: String,
      required: true, // product name at time of order
    },

    // variant code snapshot (if available)
    code: {
      type: String,
    },

    // fabric/type for variant identification (used by stock deduction)
    fabric: {
      type: String,
      default: "",
    },

    // kept for backward compat with old orders
    type: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      required: true, // snapshot image
    },

    color: {
      type: String,
      required: true,
    },

    size: {
      type: [String],
      required: true,
    },

    price: {
      type: Number,
      required: true, // price at time of order
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

/**
 * =========================
 * SHIPPING ADDRESS
 * =========================
 */
const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    pincode: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    addressLine: { type: String, required: true },
    landmark: { type: String },
  },
  { _id: false }
);

/**
 * =========================
 * MAIN ORDER SCHEMA
 * =========================
 */
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    address: {
      type: addressSchema,
      required: true,
    },

    // Human-friendly order number (auto-generated if missing)
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "Order Placed",
        "Dispatched",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Order Placed",
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay", "Stripe", "UPI", "Card", "WhatsApp"],
      required: true,
    },

    payment: {
      type: Boolean,
      default: false,
    },

    paymentId: {
      type: String, // gateway payment ID
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    // Tracks reviewed items: "productId_variantCode" or "productId_variantColor"
    reviewedItems: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Auto-generate a sequential human-friendly orderNumber if not present
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    try {
      const counter = await counterModel.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const padded = String(counter.seq).padStart(5, "0");
      this.orderNumber = `FBN-${padded}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

/**
 * =========================
 * PREVENT MODEL OVERWRITE
 * =========================
 */
const orderModel =
  mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
