import productModel from "../models/productModel.js";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

/* =========================
   SUBMIT REVIEW
   POST /api/review/submit
   Auth: user only
========================= */
const submitReview = async (req, res) => {
    try {
        const { orderId, productId, variantCode, variantColor, rating, comment } = req.body;

        if (!req.user?._id) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        const ratingNum = Number(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
        }

        if (!orderId || !productId) {
            return res.status(400).json({ success: false, message: "orderId and productId are required" });
        }

        // Load order and validate ownership + delivery status
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (order.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Not your order" });
        }
        if (order.status !== "Delivered") {
            return res.status(400).json({ success: false, message: "Can only review delivered orders" });
        }

        // Build the dedupe key (same logic used on frontend)
        const reviewKey = `${productId}_${variantCode || variantColor}`;

        // Safe access: old orders may not have reviewedItems field
        const reviewedItems = order.reviewedItems || [];

        // Check if already reviewed
        if (reviewedItems.includes(reviewKey)) {
            return res.status(409).json({ success: false, message: "You have already reviewed this item" });
        }

        // Verify the item actually belongs to this order
        // Support multiple matching strategies, same as stock deduction
        const productIdStr = String(productId);
        const vc = (variantCode || "").trim();
        const vColor = (variantColor || "").trim().toLowerCase();

        const orderItem = order.items.find((item) => {
            if (item.productId?.toString() !== productIdStr) return false;
            // 1. exact code match
            if (vc && (item.code || "").trim() === vc) return true;
            // 2. color match (fallback — no code or code empty)
            if (vColor && (item.color || "").trim().toLowerCase() === vColor) return true;
            // 3. product ID alone (single-variant products)
            if (!vc && !vColor) return true;
            return false;
        });

        if (!orderItem) {
            return res.status(404).json({ success: false, message: "Item not found in this order" });
        }

        // Load user name
        const user = await userModel.findById(req.user._id).select("name");
        const userName = user?.name || "Anonymous";

        // Push review into product
        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        product.reviews.push({
            userId: req.user._id,
            userName,
            rating: ratingNum,
            comment: (comment || "").trim(),
            variantCode: variantCode || "",
            variantColor: variantColor || "",
            orderId,
        });

        await product.save();

        // Mark order item as reviewed — safely handle legacy docs without reviewedItems
        if (!order.reviewedItems) {
            order.reviewedItems = [reviewKey];
        } else {
            order.reviewedItems.push(reviewKey);
        }
        order.markModified("reviewedItems"); // ensure Mongoose detects the change
        await order.save();

        res.json({ success: true, message: "Review submitted successfully" });
    } catch (error) {
        console.error("submitReview error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* =========================
   GET REVIEWS FOR A PRODUCT
   GET /api/review/:productId
   Public
========================= */
const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantCode, variantColor } = req.query;

        const product = await productModel.findById(productId).select("reviews name");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        let reviews = product.reviews;

        // Optional variant filter
        if (variantCode) {
            reviews = reviews.filter((r) => r.variantCode === variantCode);
        } else if (variantColor) {
            reviews = reviews.filter((r) => r.variantColor === variantColor);
        }

        // Compute average rating
        const avgRating =
            reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : 0;

        res.json({
            success: true,
            reviews: reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            avgRating: Math.round(avgRating * 10) / 10,
            total: reviews.length,
        });
    } catch (error) {
        console.error("getProductReviews error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* =========================
   GET ALL REVIEWS (ADMIN)
   GET /api/review/admin/:productId
   Auth: admin
========================= */
const getAdminReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await productModel.findById(productId).select("reviews name variants");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Group reviews by variant
        const grouped = {};
        for (const review of product.reviews) {
            const key = review.variantCode || review.variantColor || "General";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(review);
        }

        res.json({
            success: true,
            productName: product.name,
            reviews: product.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            grouped,
        });
    } catch (error) {
        console.error("getAdminReviews error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* =========================
   GET ALL PRODUCTS WITH REVIEWS (ADMIN)
   GET /api/review/admin/all
   Auth: admin
========================= */
const getAllProductsWithReviews = async (req, res) => {
    try {
        const products = await productModel
            .find({ "reviews.0": { $exists: true } })
            .select("name reviews variants")
            .lean();

        const result = products.map((p) => {
            const avgRating =
                p.reviews.length > 0
                    ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
                    : 0;
            return {
                _id: p._id,
                name: p.name,
                variants: p.variants,
                reviews: p.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
                avgRating: Math.round(avgRating * 10) / 10,
                total: p.reviews.length,
            };
        });

        res.json({ success: true, products: result });
    } catch (error) {
        console.error("getAllProductsWithReviews error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* =========================
   DELETE A REVIEW (ADMIN)
   DELETE /api/review/:productId/:reviewId
   Auth: admin
========================= */
const deleteReview = async (req, res) => {
    try {
        const { productId, reviewId } = req.params;

        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const before = product.reviews.length;
        product.reviews = product.reviews.filter((r) => r._id.toString() !== reviewId);

        if (product.reviews.length === before) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        await product.save();
        res.json({ success: true, message: "Review deleted" });
    } catch (error) {
        console.error("deleteReview error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export {
    submitReview,
    getProductReviews,
    getAdminReviews,
    getAllProductsWithReviews,
    deleteReview,
};
