import mongoose from "mongoose";

/**
 * Size-wise price & stock
 */
const sizeSchema = new mongoose.Schema(
  {
    size: {
      type: String, // S, M, L, XL
      required: true,
    },
    price: {
      type: Number, // price for this size
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
);

/**
 * Color Variant Schema
 */
const colorVariantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: true, // Black, Blue, Red
    },
    images: {
      type: [String],
      required: true, // images for this color
    },
    sizes: {
      type: [sizeSchema],
      required: true,
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
