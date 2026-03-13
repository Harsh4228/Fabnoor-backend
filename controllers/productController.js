import { v2 as cloudinary } from "cloudinary";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";

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
      discount,
    } = req.body;

    // Helper to parse comma-separated or JSON-stringified arrays
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      return [val];
    };

    const finalCategory = parseArray(category);
    const finalSubCategory = parseArray(subCategory);

    if (!name || !description || !finalCategory.length || !finalSubCategory.length || !variants) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled (including at least one category and subcategory)",
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
        const { color, fabric, sizes, price, stock, code } = variant;

        if (!color || !fabric || !Array.isArray(sizes) || !sizes.length) {
          throw new Error(`Invalid variant data for ${color}`);
        }

        if (!code || typeof code !== "string" || !code.trim()) {
          throw new Error(`Variant code is required for ${color} ${fabric}`);
        }

        const imageKey = `${safeKey(color)}_${safeKey(fabric)}_images`;
        const files = imageMap[imageKey] || [];

        if (!files.length) {
          throw new Error(`Images required for ${color} (${fabric})`);
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
          code,
          fabric,
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
      category: finalCategory,
      subCategory: finalSubCategory,
      variants: finalVariants,
      bestseller: bestseller === "true" || bestseller === true,
      discount: Number(discount) || 0,
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
    const {
      page = 1,
      limit = 0,
      category,
      subCategory,
      search,
      bestseller,
      sortType,
    } = req.query;

    const query = {};

    if (category) {
      const categories = Array.isArray(category) ? category : category.split(",");
      query.category = { $in: categories };
    }

    if (subCategory) {
      const subCategories = Array.isArray(subCategory) ? subCategory : subCategory.split(",");
      query.subCategory = { $in: subCategories };
    }

    if (bestseller === "true") {
      query.bestseller = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { subCategory: { $regex: search, $options: "i" } },
      ];
    }

    let pipeline = [];
    if (Object.keys(query).length > 0) {
      pipeline.push({ $match: query });
    }

    if (sortType === "low-high" || sortType === "high-low") {
      pipeline.push({
        $addFields: {
          minPrice: { $min: "$variants.price" }
        }
      });
      pipeline.push({
        $sort: { minPrice: sortType === "low-high" ? 1 : -1 }
      });
    } else {
      pipeline.push({ $sort: { date: -1 } });
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10);

    const facet = {
      metadata: [{ $count: "totalCount" }],
      data: []
    };

    if (limitNum > 0) {
      facet.data.push({ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum });
    }

    pipeline.push({ $facet: facet });

    const result = await productModel.aggregate(pipeline);
    const products = result[0].data;
    const totalCount = result[0].metadata[0]?.totalCount || 0;

    res.json({ success: true, products, totalCount });
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
 * GET PRODUCTS BY IDS
 * =========================
 */
const getProductsByIds = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: "Array of ids required" });
    }
    const products = await productModel.find({ _id: { $in: ids } }).lean();
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * GET PRODUCT METADATA (Categories)
 * =========================
 */
const getProductMetadata = async (req, res) => {
  try {
    const categoriesDoc = await categoryModel.find({}).sort({ name: 1 });
    const categories = categoriesDoc.map(c => c.name);
    const subCategoriesMap = {};
    
    categoriesDoc.forEach(cat => {
      subCategoriesMap[cat.name] = cat.subCategories;
    });

    res.json({ success: true, categories, subCategoriesMap });
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
    const { id } = req.body;
    await productModel.findByIdAndDelete(id);

    // Cleanup wishlist for all users
    await userModel.updateMany(
      {},
      { $pull: { wishlist: { productId: id } } }
    );

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
      discount,
    } = req.body;

    const product = await productModel.findById(id);
    if (!product)
      return res.status(404).json({ success: false, message: "Not found" });

    // Helper to parse comma-separated or JSON-stringified arrays
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      return [val];
    };

    const finalCategory = parseArray(category);
    const finalSubCategory = parseArray(subCategory);

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

    const imageMap = {};
    (req.files || []).forEach((file) => {
      if (!imageMap[file.fieldname]) imageMap[file.fieldname] = [];
      imageMap[file.fieldname].push(file);
    });

    const updatedVariants = await Promise.all(
      parsedVariants.map(async (variant) => {
        let { color, fabric, sizes, existingImages, price, stock = 0, code } = variant;

        // for legacy products the code may be missing; auto-generate a fallback
        if (!code || typeof code !== "string" || !code.trim()) {
          code = `${safeKey(color)}_${safeKey(fabric)}`;
        }

        const imageKey = `${safeKey(color)}_${safeKey(fabric)}_images`;
        const newFiles = imageMap[imageKey] || [];

        let images = Array.isArray(existingImages) ? [...existingImages] : [];
        if (newFiles.length) {
          const newUploadedImages = await Promise.all(
            newFiles.map(async (file) => {
              const res = await cloudinary.uploader.upload(file.path, {
                folder: "products",
              });
              return res.secure_url;
            })
          );
          images = [...images, ...newUploadedImages];
        }

        return {
          color,
          code,
          fabric,
          images,
          sizes,
          price,
          stock,
        };
      })
    );

    product.name = name ?? product.name;
    product.description = description ?? product.description;
    product.category = finalCategory.length ? finalCategory : product.category;
    product.subCategory = finalSubCategory.length ? finalSubCategory : product.subCategory;
    product.bestseller = bestseller === "true" || bestseller === true;
    product.variants = updatedVariants;
    product.discount = discount !== undefined ? Number(discount) : product.discount;

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
  getProductsByIds,
  getProductMetadata,
};
