import mongoose from "mongoose";

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
    type: String,
    required: true,
  },

  subCategory: {
    type: String,
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
});

/**
 * Prevent OverwriteModelError
 */
const productModel =
  mongoose.models.product || mongoose.model("product", productSchema);

export default productModel;
