import { v2 as cloudinary } from "cloudinary";
import productModel from "../models/productModel.js";

/* ================= UTILS ================= */
const safeKey = (val) =>
  val.trim().toLowerCase().replace(/\s+/g, "_");

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

    /* PARSE VARIANTS */
    let parsedVariants;
    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid variants format",
      });
    }

    if (!Array.isArray(parsedVariants) || !parsedVariants.length) {
      return res.status(400).json({
        success: false,
        message: "Variants are required",
      });
    }

    /* GROUP FILES */
    const imageMap = {};
    (req.files || []).forEach((file) => {
      if (!imageMap[file.fieldname]) imageMap[file.fieldname] = [];
      imageMap[file.fieldname].push(file);
    });

    /* BUILD VARIANTS */
    const finalVariants = await Promise.all(
      parsedVariants.map(async (variant) => {
        const { color, type, sizes ,price,stock} = variant;

        if (!color || !type || !Array.isArray(sizes) || !sizes.length) {
          throw new Error(`Invalid variant data for ${color}`);
        }

        const imageKey = `${safeKey(color)}_${safeKey(type)}_images`;
        const files = imageMap[imageKey] || [];

        if (!files.length) {
          throw new Error(`Images required for ${color} (${type})`);
        }

        const images = await Promise.all(
          files.map(async (file) => {
            const res = await cloudinary.uploader.upload(file.path, {
              folder: "products",
            });
            return res.secure_url;
          })
        );

        return {
          color,
          type,
          images,
          sizes,
          price,
          stock,
        };
      })
    );

    /* CREATE PRODUCT */
    const product = await productModel.create({
      name,
      description,
      category,
      subCategory,
      variants: finalVariants,
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
 * LIST PRODUCTS (PUBLIC)
 * =========================
 */
const listProducts = async (req, res) => {
  try {
    const products = await productModel.find({}).sort({ date: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * SINGLE PRODUCT
 * =========================
 */
const singleProduct = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * REMOVE PRODUCT
 * =========================
 */
const removeProduct = async (req, res) => {
  try {
    await productModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, message: "Product removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * EDIT PRODUCT
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

    const product = await productModel.findById(id);
    if (!product)
      return res.status(404).json({ success: false, message: "Not found" });

    const parsedVariants = JSON.parse(variants);

    const imageMap = {};
    (req.files || []).forEach((file) => {
      if (!imageMap[file.fieldname]) imageMap[file.fieldname] = [];
      imageMap[file.fieldname].push(file);
    });

    const updatedVariants = await Promise.all(
      parsedVariants.map(async (variant) => {
        const { color, type, sizes, existingImages, price,stock = [] } = variant;

        const imageKey = `${safeKey(color)}_${safeKey(type)}_images`;
        const newFiles = imageMap[imageKey] || [];

        let images = existingImages;
        if (newFiles.length) {
          images = await Promise.all(
            newFiles.map(async (file) => {
              const res = await cloudinary.uploader.upload(file.path, {
                folder: "products",
              });
              return res.secure_url;
            })
          );
        }

        return {
          color,
          type,
          images,
          sizes,
          price,
          stock,
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

    await product.save();

    res.json({ success: true, product });
  } catch (error) {
    console.error("Edit product error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  addProduct,
  editProduct,
  listProducts,
  singleProduct,
  removeProduct,
};
