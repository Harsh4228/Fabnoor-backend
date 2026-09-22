import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import { uploadBufferToCloudinary, deleteFromCloudinaryByUrl } from "../config/cloudinary.js";

/* Canonical size order — used to normalise sizes before saving */
const SIZE_ORDER = ["S","M","L","XL","XXL","XXXL","4XL","5XL","6XL","7XL","Free Size"];
const sortSizes = (sizes) =>
  [...(sizes || [])].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

// Uploads a set of in-memory files (from multer memoryStorage) to Cloudinary
// and returns their secure URLs.
const uploadVariantImages = (files) =>
  Promise.all(
    files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: "fabnoor/products",
      });
      return result.secure_url;
    })
  );

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

    if (!name || !description || !variants) {
      return res.status(400).json({
        success: false,
        message: "Name, description and variants are required",
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

        const images = await uploadVariantImages(files);

        return {
          color,
          code,
          fabric,
          images,
          sizes: sortSizes(sizes),
          price,
          stock,
          date: Date.now(),
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
    // Aggregation bypasses the soft-delete query hook, so exclude explicitly.
    pipeline.push({ $match: { isDeleted: { $ne: true } } });
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
    } else if (sortType === "old-new") {
      pipeline.push({
        $addFields: {
          latestVariantDate: {
            $max: {
              $map: {
                input: "$variants",
                as: "v",
                in: { $ifNull: ["$$v.date", "$date"] }
              }
            }
          }
        }
      });
      pipeline.push({ $sort: { latestVariantDate: 1 } });
    } else {
      // "new-old" and default "relevant" — sort by most recently added/updated variant
      pipeline.push({
        $addFields: {
          latestVariantDate: {
            $max: {
              $map: {
                input: "$variants",
                as: "v",
                in: { $ifNull: ["$$v.date", "$date"] }
              }
            }
          }
        }
      });
      pipeline.push({ $sort: { latestVariantDate: -1 } });
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

    // Strip hidden variants from each product after facet (skip for admin users)
    const isAdmin = req.user && req.user.role === "admin";
    if (!isAdmin) {
      const filterHiddenStage = {
        $project: {
          data: {
            $map: {
              input: "$data",
              as: "product",
              in: {
                $mergeObjects: [
                  "$$product",
                  {
                    variants: {
                      $filter: {
                        input: "$$product.variants",
                        as: "v",
                        cond: { $ne: ["$$v.hidden", true] },
                      },
                    },
                  },
                ],
              },
            },
          },
          metadata: 1,
        },
      };
      pipeline.push(filterHiddenStage);
    }

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
    const product = await productModel.findById(req.params.id).lean();
    if (!product)
      return res.status(404).json({ success: false, message: "Not found" });
    // Strip hidden variants for public view
    const filtered = {
      ...product,
      variants: (product.variants || []).filter((v) => !v.hidden),
    };
    res.json({ success: true, product: filtered });
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
    const categoriesDoc = await categoryModel.find({}).sort({ sequence: 1, name: 1 });
    const categories = categoriesDoc.map(c => ({ name: c.name, sequence: c.sequence || 1 }));
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
 * REMOVE PRODUCT (SOFT DELETE)
 * =========================
 */
const removeProduct = async (req, res) => {
  try {
    const { id } = req.body;
    const product = await productModel.findById(id);

    if (product) {
      // Cloudinary images are kept so the product can be fully restored later;
      // they're only cleaned up on permanent delete.
      await product.softDelete(req.user?._id);
    }

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
 * TRASH: LIST DELETED PRODUCTS (ADMIN)
 * =========================
 */
const listDeletedProducts = async (req, res) => {
  try {
    const products = await productModel
      .find({ isDeleted: true })
      .sort({ deletedAt: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * TRASH: RESTORE PRODUCT (ADMIN)
 * =========================
 */
const restoreProduct = async (req, res) => {
  try {
    const { id } = req.body;
    const product = await productModel.findOne({ _id: id, isDeleted: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found in trash" });
    }
    await product.restore();
    res.json({ success: true, message: "Product restored", product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * TRASH: PERMANENTLY DELETE PRODUCT (ADMIN)
 * =========================
 */
const permanentlyDeleteProduct = async (req, res) => {
  try {
    const { id } = req.body;
    const product = await productModel.findOne({ _id: id, isDeleted: true });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found in trash" });
    }

    for (const variant of product.variants || []) {
      for (const imageUrl of variant.images || []) {
        await deleteFromCloudinaryByUrl(imageUrl, "image");
      }
    }
    await product.deleteOne();

    res.json({ success: true, message: "Product permanently deleted" });
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

        const keepImages = Array.isArray(existingImages) ? [...existingImages] : [];

        // Delete old images that were removed by the admin
        const oldVariant = product.variants.find((v) => v.code === code);
        for (const oldUrl of (oldVariant?.images || [])) {
          if (!keepImages.includes(oldUrl)) {
            await deleteFromCloudinaryByUrl(oldUrl, "image");
          }
        }

        let images = keepImages;
        if (newFiles.length) {
          const newUploadedImages = await uploadVariantImages(newFiles);
          images = [...images, ...newUploadedImages];
        }

        const isNewVariant = !product.variants.find((v) => v.code === code);

        return {
          color,
          code,
          fabric,
          images,
          sizes: sortSizes(sizes),
          price,
          stock,
          hidden: oldVariant?.hidden || false,
          date: isNewVariant ? Date.now() : (oldVariant?.date || product.date || Date.now()),
        };
      })
    );

    product.name = name ?? product.name;
    product.description = description ?? product.description;
    product.category = finalCategory;
    product.subCategory = finalSubCategory;
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

/**
 * =========================
 * QUICK UPDATE (PRICE/STOCK)
 * =========================
 */
const updateVariantQuick = async (req, res) => {
  try {
    const { id, variantUpdates } = req.body; // variantUpdates: [{ code, price, stock }]
    const product = await productModel.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Not found" });

    variantUpdates.forEach(update => {
      const idx = product.variants.findIndex(v => v.code === update.code);
      if (idx !== -1) {
        if (update.price !== undefined) product.variants[idx].price = Number(update.price);
        if (update.stock !== undefined) product.variants[idx].stock = Number(update.stock);
      }
    });

    await product.save();
    res.json({ success: true, message: "Quick update successful", product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * TOGGLE VARIANT HIDDEN (ADMIN)
 * =========================
 */
const toggleVariantHidden = async (req, res) => {
  try {
    const { id, variantCode } = req.body;
    if (!id || !variantCode)
      return res.status(400).json({ success: false, message: "id and variantCode required" });

    const product = await productModel.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Not found" });

    const idx = product.variants.findIndex((v) => v.code === variantCode);
    if (idx === -1)
      return res.status(404).json({ success: false, message: "Variant not found" });

    product.variants[idx].hidden = !product.variants[idx].hidden;
    await product.save();

    res.json({
      success: true,
      hidden: product.variants[idx].hidden,
      message: product.variants[idx].hidden ? "Variant hidden from website" : "Variant visible on website",
    });
  } catch (error) {
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
  updateVariantQuick,
  toggleVariantHidden,
  listDeletedProducts,
  restoreProduct,
  permanentlyDeleteProduct,
};

