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

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =========================
   PLACE ORDER (COD)
========================= */
const placeOrder = async (req, res) => {
  try {
    const { items, amount, address } = req.body;

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

    const order = await orderModel.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    if (status === "Delivered") {
      const user = await userModel.findById(order.userId);
      if (user?.email) {
        const invoiceBuffer = await generateInvoice(order);
        await sendInvoiceEmail(user.email, invoiceBuffer);
      }
    }

    res.json({ success: true, message: "Order status updated" });
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
