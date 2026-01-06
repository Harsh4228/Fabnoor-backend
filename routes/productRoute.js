import express from "express";
import {
  addProduct,
  editProduct,
  listProducts,
  singleProduct,
  removeProduct,
} from "../controllers/productController.js";

import upload from "../middleware/multer.js";
import authUser from "../middleware/auth.js";
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

/**
 * =========================
 * PUBLIC ROUTES
 * =========================
 */
productRouter.get("/list", listProducts);
productRouter.get("/:id", singleProduct);

export default productRouter;
