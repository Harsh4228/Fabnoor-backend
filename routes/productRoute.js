import express from "express";
import {
  addProduct,
  editProduct,
  listProducts,
  singleProduct,
  removeProduct,
  getProductsByIds,
  getProductMetadata,
  updateVariantQuick,
  toggleVariantHidden,
} from "../controllers/productController.js";

import upload from "../middleware/multer.js";
import authUser, { optionalAuth } from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const productRouter = express.Router();

/**
 * =========================
 * ADMIN ROUTES
 * =========================
 */
productRouter.post(
  "/add",
  authUser,      // ✅ REQUIRED (sets req.user)
  adminAuth,     // ✅ checks role === admin
  upload.any(),  // ✅ dynamic color image fields
  addProduct
);

productRouter.post(
  "/edit",
  authUser,
  adminAuth,
  upload.any(),
  editProduct
);

productRouter.post(
  "/remove",
  authUser,
  adminAuth,
  removeProduct
);

productRouter.post(
  "/update-quick",
  authUser,
  adminAuth,
  updateVariantQuick
);

productRouter.post(
  "/toggle-variant-hidden",
  authUser,
  adminAuth,
  toggleVariantHidden
);

/**
 * =========================
 * PUBLIC ROUTES
 * =========================
 */
productRouter.get("/list", optionalAuth, listProducts);
productRouter.get("/metadata", getProductMetadata);
productRouter.post("/by-ids", optionalAuth, getProductsByIds);
productRouter.get("/:id", optionalAuth, singleProduct);

export default productRouter;
