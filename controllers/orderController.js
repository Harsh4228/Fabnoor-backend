import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import productModel from "../models/productModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";

import { sendOrderEmail, sendInvoiceEmail } from "../config/emailService.js";
import { generateInvoice } from "../config/invoiceGenerator.js";

/* =========================
   DEDUCT STOCK ON ORDER
========================= */
const deductStock = async (items) => {
  if (!Array.isArray(items) || !items.length) return;

  for (const item of items) {
    try {
      const pid = item.productId?.toString();
      const qty = Number(item.quantity || 1);
      const code = (item.code || "").trim();
      const color = (item.color || "").trim().toLowerCase();
      const fabric = (item.fabric || item.type || "").trim().toLowerCase();

      if (!pid) {
        console.warn("[stock] skipping item - no productId");
        continue;
      }

      // Use .lean() to get RAW MongoDB document — bypasses Mongoose strict mode.
      // This means ALL fields are visible (including old `type` field on legacy products).
      const product = await productModel.findById(pid).lean();

      if (!product || !product.variants?.length) {
        console.warn(`[stock] product not found or no variants: ${pid}`);
        continue;
      }

      // Find variant index with priority fallbacks
      let idx = -1;

      // 1. Exact code match (most reliable — code is unique per variant)
      if (code) {
        idx = product.variants.findIndex(
          (v) => (v.code || "").trim() === code
        );
      }

      // 2. color + fabric match (new schema)
      if (idx === -1 && (color || fabric)) {
        idx = product.variants.findIndex((v) => {
          const vColor = (v.color || "").trim().toLowerCase();
          const vFabric = (v.fabric || "").trim().toLowerCase();
          return vColor === color && vFabric === fabric;
        });
      }

      // 3. color + type match (OLD schema — type field was before rename)
      if (idx === -1 && (color || fabric)) {
        idx = product.variants.findIndex((v) => {
          const vColor = (v.color || "").trim().toLowerCase();
          const vType = (v.type || "").trim().toLowerCase();
          return vColor === color && vType === fabric;
        });
      }

      // 4. color-only match (last resort for simple products)
      if (idx === -1 && color) {
        idx = product.variants.findIndex(
          (v) => (v.color || "").trim().toLowerCase() === color
        );
      }

      // 5. Just use first variant if all else fails
      if (idx === -1) {
        console.warn(`[stock] no variant match for product ${pid} (code=${code}, color=${color}, fabric=${fabric}), using first variant`);
        idx = 0;
      }

      const currentStock = Number(product.variants[idx].stock ?? 0);
      const newStock = Math.max(0, currentStock - qty);

      // Direct index-based $set — bypasses ALL subdoc change-detection issues
      const updateRes = await productModel.updateOne(
        { _id: pid },
        { $set: { [`variants.${idx}.stock`]: newStock } }
      );

      if (updateRes.modifiedCount > 0) {
        console.log(
          `[stock] ✅ product=${pid} variant[${idx}] (${product.variants[idx].color}) stock: ${currentStock} → ${newStock} (deducted ${qty})`
        );
      } else {
        console.warn(`[stock] ⚠️ updateOne matched 0 docs for product ${pid}`);
      }
    } catch (err) {
      console.error(`[stock] ❌ error for product ${item?.productId}:`, err.message);
    }
  }
};

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

    // Prevent accidental duplicate orders in quick succession
    const recent = await orderModel.findOne({
      userId: req.user._id,
      amount,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
    });

    if (recent) {
      return res.status(409).json({ success: false, message: "Duplicate order detected. If this was not intended, please check your orders." });
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

    // ✅ Deduct stock (foreground — so failures are visible, not silent)
    try {
      await deductStock(items);
    } catch (err) {
      // Non-fatal — order is placed, just log the issue
      console.error("[stock] deductStock error (COD):", err.message);
    }

    // ✅ Send email
    if (req.user.email) {
      // schedule order confirmation email in background to avoid blocking response
      setImmediate(() => {
        sendOrderEmail(req.user.email, items, amount).catch((err) => {
          console.error("Background sendOrderEmail error:", err);
        });
      });
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

    // Prevent accidental duplicate orders in quick succession
    const recent = await orderModel.findOne({
      userId: req.user._id,
      amount,
      createdAt: { $gte: new Date(Date.now() - 30 * 1000) },
    });

    if (recent) {
      return res.status(409).json({ success: false, message: "Duplicate order detected. If this was not intended, please check your orders." });
    }

    const order = await orderModel.create({
      userId: req.user._id, // ✅ FIX
      items,
      amount,
      address,
      paymentMethod: "Razorpay",
      payment: false,
      status: "Payment Pending",
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

    // ✅ Deduct stock (foreground — so failures are visible)
    try {
      await deductStock(order.items);
    } catch (err) {
      console.error("[stock] deductStock error (Razorpay):", err.message);
    }

    // ✅ Send email
    const user = await userModel.findById(order.userId);
    if (user?.email) {
      // send order email in background
      setImmediate(() => {
        sendOrderEmail(user.email, order.items, order.amount).catch((err) => {
          console.error("Background sendOrderEmail error:", err);
        });
      });
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
      .find({ status: { $ne: "Payment Pending" } })
      .populate("userId", "-password") // ✅ Exclude only password to securely give admin all profile data
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
      .find({ userId: req.user._id, status: { $ne: "Payment Pending" } }) // ✅ FIX
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

    // on delivery, generate and send invoice (background)
    if (status === "Delivered") {
      const user = await userModel.findById(order.userId);
      if (user?.email) {
        setImmediate(async () => {
          try {
            const invoiceBuffer = await generateInvoice(order, user);
            await sendInvoiceEmail(user.email, invoiceBuffer);
          } catch (err) {
            console.error("Background invoice/email error:", err);
          }
        });
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
  getInvoice,
};

/* =========================
   ADMIN: DOWNLOAD INVOICE (PDF)
========================= */
const getInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const user = await userModel.findById(order.userId);
    const pdfBuffer = await generateInvoice(order, user);

    const filename = `invoice-${order.orderNumber || order._id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Get invoice error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};