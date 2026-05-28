import axios from "axios";
import dotenv from "dotenv";
import userModel from "../models/userModel.js";
import BroadcastLog from "../models/BroadcastLog.js";
dotenv.config();

/* ── Send a single template message ────────────────────── */
const sendTemplateMessage = async (to, templateName, customerName) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) return { success: false, error: "Missing credentials" };

    const cleanNumber = to.replace(/[^0-9]/g, "");
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;

    const isHelloWorld = templateName === "hello_world";

    const templatePayload = {
      name: templateName,
      language: { code: isHelloWorld ? "en_US" : "en" },
    };

    if (!isHelloWorld) {
      const headerImageUrl = process.env.WHATSAPP_HEADER_IMAGE_URL;
      templatePayload.components = [
        ...(headerImageUrl
          ? [{ type: "header", parameters: [{ type: "image", image: { link: headerImageUrl } }] }]
          : []),
        {
          type: "body",
          parameters: [{ type: "text", parameter_name: "customer_name", text: customerName || "Customer" }],
        },
      ];
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      { messaging_product: "whatsapp", to: formattedNumber, type: "template", template: templatePayload },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    console.log(`[WA] Sent to ${formattedNumber}:`, response.data);
    return { success: true };
  } catch (error) {
    const errData = error.response?.data?.error;
    console.error(`[WA] Failed:`, errData || error.message);
    return { success: false, error: errData?.message || error.message || "Unknown error" };
  }
};

/* ── Deduplicate by mobile number ───────────────────────── */
const deduplicateContacts = (contacts) => {
  const seen = new Set();
  return contacts.filter((c) => {
    const key = c.mobile?.replace(/[^0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* ── GET /api/whatsapp/customers ────────────────────────── */
export const getCustomers = async (req, res) => {
  try {
    const users = await userModel
      .find({ role: "user" }, "name shopName mobile")
      .lean();

    const contacts = users
      .filter((u) => u.mobile && u.mobile.trim())
      .map((u) => ({
        name: u.name || u.shopName || "Customer",
        mobile: u.mobile.trim(),
      }));

    return res.json({ success: true, contacts });
  } catch (error) {
    console.error("[getCustomers] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── GET /api/whatsapp/history ──────────────────────────── */
export const getBroadcastHistory = async (req, res) => {
  try {
    const logs = await BroadcastLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("templateName total sentCount failedCount createdAt")
      .lean();
    return res.json({ success: true, logs });
  } catch (error) {
    console.error("[getBroadcastHistory] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── GET /api/whatsapp/history/:id ──────────────────────── */
export const getBroadcastHistoryDetail = async (req, res) => {
  try {
    const log = await BroadcastLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ success: false, message: "Log not found" });
    return res.json({ success: true, log });
  } catch (error) {
    console.error("[getBroadcastHistoryDetail] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── POST /api/whatsapp/broadcast-stream (SSE) ──────────── */
export const broadcastStream = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { contacts, templateName } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      sendEvent({ type: "error", message: "No contacts provided" });
      return res.end();
    }
    if (!templateName) {
      sendEvent({ type: "error", message: "Template name is required" });
      return res.end();
    }

    const list = deduplicateContacts(contacts);
    sendEvent({ type: "start", total: list.length });

    const sent = [];
    const failed = [];

    for (let i = 0; i < list.length; i++) {
      const { name, mobile } = list[i];

      if (!mobile || mobile.trim() === "") {
        failed.push({ name: name || "Unknown", mobile: mobile || "", error: "Missing mobile number" });
        sendEvent({ type: "progress", progress: i + 1, total: list.length, status: "failed", contact: name || "Unknown" });
        continue;
      }

      const result = await sendTemplateMessage(mobile.trim(), templateName, name || "Customer");

      if (result.success) {
        sent.push({ name: name || "Customer", mobile: mobile.trim() });
        sendEvent({ type: "progress", progress: i + 1, total: list.length, status: "sent", contact: name || mobile.trim() });
      } else {
        failed.push({ name: name || "Customer", mobile: mobile.trim(), error: result.error });
        sendEvent({ type: "progress", progress: i + 1, total: list.length, status: "failed", contact: name || mobile.trim(), error: result.error });
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    // Save to history
    try {
      await BroadcastLog.create({
        templateName,
        total: list.length,
        sentCount: sent.length,
        failedCount: failed.length,
        sent,
        failed,
      });
    } catch (dbErr) {
      console.error("[broadcastStream] DB save error:", dbErr.message);
    }

    sendEvent({ type: "done", results: { sent, failed, total: list.length } });
    res.end();
  } catch (error) {
    console.error("[broadcastStream] error:", error);
    sendEvent({ type: "error", message: error.message });
    res.end();
  }
};

/* ── POST /api/whatsapp/broadcast (non-SSE, kept for compat) */
export const broadcastMessage = async (req, res) => {
  try {
    const { contacts, templateName } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0)
      return res.json({ success: false, message: "No contacts provided" });
    if (!templateName)
      return res.json({ success: false, message: "Template name is required" });

    const list = deduplicateContacts(contacts);
    const sent = [];
    const failed = [];

    for (const contact of list) {
      const { name, mobile } = contact;
      if (!mobile || mobile.trim() === "") {
        failed.push({ name: name || "Unknown", mobile: mobile || "", error: "Missing mobile number" });
        continue;
      }
      const result = await sendTemplateMessage(mobile.trim(), templateName, name || "Customer");
      if (result.success) sent.push({ name: name || "Customer", mobile: mobile.trim() });
      else failed.push({ name: name || "Customer", mobile: mobile.trim(), error: result.error });
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      await BroadcastLog.create({
        templateName,
        total: list.length,
        sentCount: sent.length,
        failedCount: failed.length,
        sent,
        failed,
      });
    } catch (dbErr) {
      console.error("[broadcast] DB save error:", dbErr.message);
    }

    return res.json({ success: true, results: { sent, failed, total: list.length } });
  } catch (error) {
    console.error("[broadcast] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
