import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

/**
 * Review Schema
 */
const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    userName: {
      type: String,
      default: "Anonymous",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
    },
    // variant identification
    variantCode: {
      type: String,
      default: "",
    },
    variantColor: {
      type: String,
      default: "",
    },
    // track which order this came from (to prevent double-reviews)
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "order",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // Soft delete — reviews are subdocuments, so they're filtered manually
    // in controllers rather than via the query-hook plugin.
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

/**
 * Size-wise price & stock
 */


/**
 * Color Variant Schema
 */
const colorVariantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: true,
    },
    // NEW field name (from rename)
    fabric: {
      type: String,
      default: "",
    },
    // KEPT for backward compat with older products
    type: {
      type: String,
      default: "",
    },
    // variant code — not required so old products without codes still work
    code: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      required: true,
    },
    sizes: {
      type: [String],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

/**
 * Main Product Schema
 */
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
    required: true,
  },

  category: {
    type: [String],
    required: true,
  },

  subCategory: {
    type: [String],
    required: true,
  },


  variants: {
    type: [colorVariantSchema],
    required: true,
  },

  bestseller: {
    type: Boolean,
    default: false,
  },

  date: {
    type: Number,
    required: true,
  },

  // Embedded reviews
  reviews: {
    type: [reviewSchema],
    default: [],
  },

  discount: {
    type: Number,
    default: 0,
  },
});

productSchema.plugin(softDeletePlugin);

/**
 * Prevent OverwriteModelError
 */
const productModel =
  mongoose.models.product || mongoose.model("product", productSchema);

export default productModel;
