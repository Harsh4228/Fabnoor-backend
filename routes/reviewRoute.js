import express from "express";
import {
    submitReview,
    getProductReviews,
    getAdminReviews,
    getAllProductsWithReviews,
    deleteReview,
} from "../controllers/reviewController.js";

import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const reviewRouter = express.Router();

/* ================= PUBLIC ================= */
// Get all reviews for a product (optionally filter by variantCode or variantColor query param)
reviewRouter.get("/product/:productId", getProductReviews);

/* ================= USER ================= */
// Submit a new review
reviewRouter.post("/submit", authUser, submitReview);

/* ================= ADMIN ================= */
// Get all products that have reviews
reviewRouter.get("/admin/all", authUser, adminAuth, getAllProductsWithReviews);
// Get reviews for a specific product (grouped by variant)
reviewRouter.get("/admin/:productId", authUser, adminAuth, getAdminReviews);
// Delete a specific review
reviewRouter.delete("/admin/:productId/:reviewId", authUser, adminAuth, deleteReview);

export default reviewRouter;
