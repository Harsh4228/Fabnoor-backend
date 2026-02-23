import express from "express";
import {
  placeOrder,
  placeOrderRazorpay,
  allOrders,
  userOrders,
  updateStatus,
  updatePaymentStatus,
  getInvoice,
  verifyRazorpay,
} from "../controllers/orderController.js";

import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const orderRouter = express.Router();

/* ================= ADMIN FEATURES ================= */

// ✅ FIXED ORDER
orderRouter.post("/list", authUser, adminAuth, allOrders);
orderRouter.post("/status", authUser, adminAuth, updateStatus);
orderRouter.post("/paymentstatus", authUser, adminAuth, updatePaymentStatus);
orderRouter.get("/invoice/:orderId", authUser, adminAuth, getInvoice);

/* ================= USER FEATURES ================= */

// ❌ adminAuth REMOVED (users can place orders)
orderRouter.post("/place", authUser, placeOrder);
orderRouter.post("/razorpay", authUser, placeOrderRazorpay);
orderRouter.post("/userorders", authUser, userOrders);

/* ================= PAYMENT VERIFY ================= */

orderRouter.post("/verifyRazorpay", authUser, verifyRazorpay);

export default orderRouter;
