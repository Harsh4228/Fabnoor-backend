import express from "express";
import {
  placeOrder,
  placeOrderWhatsApp,
  placeOrderRazorpay,
  allOrders,
  userOrders,
  updateStatus,
  updatePaymentStatus,
  getInvoice,
  verifyRazorpay,
  getWhatsAppSlip,
  getDashboardStats,
  getDeliveredReport,
} from "../controllers/orderController.js";

import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const orderRouter = express.Router();

/* ================= ADMIN FEATURES ================= */

orderRouter.post("/list", authUser, adminAuth, allOrders);
orderRouter.post("/status", authUser, adminAuth, updateStatus);
orderRouter.post("/paymentstatus", authUser, adminAuth, updatePaymentStatus);
orderRouter.get("/invoice/:orderId", authUser, adminAuth, getInvoice);
orderRouter.get("/dashboard-stats", authUser, adminAuth, getDashboardStats);
orderRouter.get("/report", authUser, adminAuth, getDeliveredReport);

/* ================= USER FEATURES ================= */

orderRouter.post("/place", authUser, placeOrder);
orderRouter.post("/whatsapp", authUser, placeOrderWhatsApp);
orderRouter.get("/slip/:orderId", authUser, getWhatsAppSlip);
orderRouter.post("/razorpay", authUser, placeOrderRazorpay);
orderRouter.post("/userorders", authUser, userOrders);

/* ================= PAYMENT VERIFY ================= */

orderRouter.post("/verifyRazorpay", authUser, verifyRazorpay);

export default orderRouter;
