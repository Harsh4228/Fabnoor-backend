import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";

/**
 * =========================
 * ADD PRODUCT (ADMIN)
 * =========================
 */
const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subCategory,
      bestseller,
      variants,
    } = req.body;

    if (!name || !description || !category || !subCategory || !variants) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled",
      });
    }

    // ✅ SAFE JSON PARSE
    let parsedVariants;
    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid variants format",
      });
    }

    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Variants are required",
      });
    }

    /**
     * =========================
     * GROUP FILES BY FIELDNAME
     * =========================
     */
    const imageMap = {};
    (req.files || []).forEach((file) => {
      if (!imageMap[file.fieldname]) {
        imageMap[file.fieldname] = [];
      }
      imageMap[file.fieldname].push(file);
    });

    /**
     * =========================
     * BUILD VARIANTS
     * =========================
     */
    const finalVariants = await Promise.all(
      parsedVariants.map(async (variant) => {
        const { color, colorKey, sizes } = variant;

        if (!color || !colorKey || !Array.isArray(sizes) || sizes.length === 0) {
          throw new Error(`Invalid variant data for color: ${color}`);
        }

        const files = imageMap[`${colorKey}_images`] || [];
        if (!files.length) {
          throw new Error(`Images required for color: ${color}`);
        }

        const imageUrls = await Promise.all(
          files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "products",
            });
            return result.secure_url;
          })
        );

        const finalSizes = sizes.map((s) => ({
          size: s.size,
          price: Number(s.price),
          stock: Number(s.stock),
        }));

        return {
          color,
          images: imageUrls,
          sizes: finalSizes,
        };
      })
    );

    /**
     * =========================
     * ⭐ MAIN IMAGE FIX ⭐
     * =========================
     * Frontend depends on this
     */
    const mainImages =
      finalVariants[0]?.images?.length > 0
        ? finalVariants[0].images
        : [];

    const product = await productModel.create({
      name,
      description,
      category,
      subCategory,
      variants: finalVariants,
      image: mainImages, // ✅ FIXED
      bestseller: bestseller === "true" || bestseller === true,
      date: Date.now(),
    });

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Add product error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * LIST ALL PRODUCTS (PUBLIC)
 * =========================
 */
const listProducts = async (req, res) => {
  try {
    const products = await productModel.find({}).sort({ date: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * GET SINGLE PRODUCT (PUBLIC)
 * =========================
 */
const singleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * REMOVE PRODUCT (ADMIN)
 * =========================
 */
const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await productModel.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * EDIT PRODUCT (ADMIN)
 * =========================
 */
const editProduct = async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      category,
      subCategory,
      bestseller,
      variants,
    } = req.body;

    if (!id || !variants) {
      return res.status(400).json({
        success: false,
        message: "Product ID and variants are required",
      });
    }

    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let parsedVariants;
    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid variants format",
      });
    }

    const imageMap = {};
    (req.files || []).forEach((file) => {
      if (!imageMap[file.fieldname]) {
        imageMap[file.fieldname] = [];
      }
      imageMap[file.fieldname].push(file);
    });

    const updatedVariants = await Promise.all(
      parsedVariants.map(async (variant) => {
        const { color, colorKey, sizes, existingImages = [] } = variant;

        let images = existingImages;

        const newFiles = imageMap[`${colorKey}_images`] || [];
        if (newFiles.length > 0) {
          images = await Promise.all(
            newFiles.map(async (file) => {
              const result = await cloudinary.uploader.upload(file.path, {
                folder: "products",
              });
              return result.secure_url;
            })
          );
        }

        return {
          color,
          images,
          sizes: sizes.map((s) => ({
            size: s.size,
            price: Number(s.price),
            stock: Number(s.stock),
          })),
        };
      })
    );

    product.name = name ?? product.name;
    product.description = description ?? product.description;
    product.category = category ?? product.category;
    product.subCategory = subCategory ?? product.subCategory;
    product.bestseller =
      bestseller === "true" || bestseller === true
        ? true
        : product.bestseller;

    product.variants = updatedVariants;

    // ✅ KEEP image IN SYNC
    product.image =
      updatedVariants[0]?.images?.length > 0
        ? updatedVariants[0].images
        : product.image || [];

    await product.save();

    return res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Edit product error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export {
  addProduct,
  editProduct,
  listProducts,
  singleProduct,
  removeProduct,
};
