import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";

import { sendOrderEmail, sendInvoiceEmail } from "../config/emailService.js";
import { generateInvoice } from "../config/invoiceGenerator.js";

/* =========================
   GLOBAL CONFIG
========================= */
const currency = "INR";

let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.log("Razorpay not configured: skipping initialization");
}

/* =========================
   PLACE ORDER (COD)
========================= */
const placeOrder = async (req, res) => {
  try {
    const { items, amount, address } = req.body;

    // If we are running in limited debug mode, fail fast with a clear status so callers
    // don't misinterpret the problem as an auth issue (401). This avoids confusion when
    // SKIP_DB=true is used to run the server without DB services.
    if (process.env.SKIP_DB === "true") {
      console.warn('[order] Attempt to place COD order while SKIP_DB=true - DB disabled for limited checks');
      return res.status(503).json({
        success: false,
        message: "Server running in limited debug mode (SKIP_DB=true); order placement is disabled. Enable DB to perform order operations.",
      });
    }

    // Log whether an Authorization header was present (mask not logged here to avoid leaking tokens)
    console.log('[order] placeOrder called - Authorization header present:', !!req.headers?.authorization);

    if (!req.user || !req.user._id) {
      console.warn('[order] User not authenticated - request headers:', {
        authHeaderPresent: !!req.headers?.authorization,
        ip: req.ip || req.connection?.remoteAddress,
      });
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const order = await orderModel.create({
      userId: req.user._id, // ✅ FIX
      items,
      amount,
      address,
      paymentMethod: "COD",
      payment: false,
      status: "Order Placed",
    });

    // ✅ Clear cart
    await userModel.findByIdAndUpdate(req.user._id, {
      cartData: {},
    });

    // ✅ Send email
    if (req.user.email) {
      await sendOrderEmail(req.user.email, items, amount);
    }

    res.json({
      success: true,
      message: "Order placed successfully (COD)",
      order,
    });
  } catch (error) {
    console.error("COD order error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   PLACE ORDER (RAZORPAY)
========================= */
const placeOrderRazorpay = async (req, res) => {
  try {
    const { items, amount, address } = req.body;

    if (process.env.SKIP_DB === "true") {
      console.warn('[order] Attempt to create Razorpay order while SKIP_DB=true - DB disabled for limited checks');
      return res.status(503).json({
        success: false,
        message: "Server running in limited debug mode (SKIP_DB=true); razorpay order creation is disabled. Enable DB to perform order operations.",
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const order = await orderModel.create({
      userId: req.user._id, // ✅ FIX
      items,
      amount,
      address,
      paymentMethod: "Razorpay",
      payment: false,
      status: "Order Placed",
    });

    if (!razorpayInstance) {
      return res.status(501).json({ success: false, message: "Razorpay not configured" });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: amount * 100,
      currency,
      receipt: order._id.toString(),
    });

    res.json({
      success: true,
      order: razorpayOrder,
    });
  } catch (error) {
    console.error("Razorpay order error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   VERIFY RAZORPAY PAYMENT
========================= */
const verifyRazorpay = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (process.env.SKIP_DB === "true") {
      console.warn('[order] Attempt to verify Razorpay payment while SKIP_DB=true - DB disabled for limited checks');
      return res.status(503).json({
        success: false,
        message: "Server running in limited debug mode (SKIP_DB=true); payment verification is disabled. Enable DB to perform order operations.",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.json({
        success: false,
        message: "Payment verification failed",
      });
    }

    if (!razorpayInstance) {
      return res.status(501).json({ success: false, message: "Razorpay not configured" });
    }

    const razorpayOrder = await razorpayInstance.orders.fetch(
      razorpay_order_id
    );

    const order = await orderModel.findByIdAndUpdate(
      razorpayOrder.receipt,
      {
        payment: true,
        paymentId: razorpay_payment_id,
        status: "Order Placed",
      },
      { new: true }
    );

    // ✅ Clear cart
    await userModel.findByIdAndUpdate(order.userId, {
      cartData: {},
    });

    // ✅ Send email
    const user = await userModel.findById(order.userId);
    if (user?.email) {
      await sendOrderEmail(user.email, order.items, order.amount);
    }

    res.json({
      success: true,
      message: "Payment successful",
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================
   ADMIN: ALL ORDERS
========================= */
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({})
      .populate("userId", "email name")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   USER ORDERS
========================= */
const userOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({ userId: req.user._id }) // ✅ FIX
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   ADMIN: UPDATE STATUS
========================= */
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const allowedStatuses = [
      "Order Placed",
      "Dispatched",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.status = status;
    await order.save();

    // on delivery, generate and send invoice
    if (status === "Delivered") {
      const user = await userModel.findById(order.userId);
      if (user?.email) {
        const invoiceBuffer = await generateInvoice(order);
        await sendInvoiceEmail(user.email, invoiceBuffer);
      }
    }

    res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   ADMIN: UPDATE PAYMENT
========================= */
const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId, payment } = req.body;

    const order = await orderModel.findByIdAndUpdate(
      orderId,
      { payment },
      { new: true }
    );

    res.json({
      success: true,
      message: "Payment status updated",
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




export {
  placeOrder,
  placeOrderRazorpay,
  verifyRazorpay,
  allOrders,
  userOrders,
  updateStatus,
  updatePaymentStatus,
};