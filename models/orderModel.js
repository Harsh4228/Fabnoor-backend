import mongoose from "mongoose";

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
      enum: ["COD", "Razorpay", "Stripe", "UPI", "Card"],
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
  },
  { timestamps: true }
);

// Auto-generate a human-friendly orderNumber if not present
orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const short = Math.random().toString(36).slice(2, 8).toUpperCase();
    const time = Date.now().toString().slice(-6);
    this.orderNumber = `ORD-${time}-${short}`;
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
