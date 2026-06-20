import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import userModel from "../models/userModel.js";
import BroadcastLog from "../models/BroadcastLog.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getIO } from "../config/socket.js";
dotenv.config();

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000; // WhatsApp's 24h customer service window

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
    return { success: true, waMessageId: response.data.messages[0].id, formattedMobile: formattedNumber };
  } catch (error) {
    const errData = error.response?.data?.error;
    console.error(`[WA] Failed:`, errData || error.message);
    return { success: false, error: errData?.message || error.message || "Unknown error" };
  }
};

/* ── Template preview text (shown in chat thread) ───────── */
const TEMPLATE_BODY = {
  fabnoor_welcome_offer: (name) =>
    `Hi ${name || "Customer"}, Welcome to Fabnoor! Explore our latest wholesale collection and get exclusive deals. Shop now!`,
  hello_world: () => "Hello World! This is a test message from WhatsApp Business API.",
};

/* ── Save outbound broadcast message to chat history ─────── */
const saveOutboundMessage = async (formattedMobile, name, templateName, waMessageId) => {
  try {
    const body =
      (TEMPLATE_BODY[templateName]?.(name)) ||
      `[Template: ${templateName}]`;

    let conversation = await Conversation.findOne({ mobile: formattedMobile });
    if (!conversation) {
      conversation = await Conversation.create({
        mobile: formattedMobile,
        name: name || "",
        lastMessage: body,
        lastMessageAt: new Date(),
        lastDirection: "out",
      });
    } else {
      conversation.name = conversation.name || name || "";
      conversation.lastMessage = body;
      conversation.lastMessageAt = new Date();
      conversation.lastDirection = "out";
      await conversation.save();
    }

    await Message.create({
      conversation: conversation._id,
      mobile: formattedMobile,
      direction: "out",
      type: "template",
      body,
      waMessageId,
      status: "sent",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[saveOutboundMessage] error:", err.message);
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

/* ── Send a free-form text reply (only valid inside the 24h window) ── */
const sendTextMessage = async (to, body) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) return { success: false, error: "Missing credentials" };

    const cleanNumber = to.replace(/[^0-9]/g, "");
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      { messaging_product: "whatsapp", to: cleanNumber, type: "text", text: { body } },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    return { success: true, waMessageId: response.data.messages[0].id };
  } catch (error) {
    const errData = error.response?.data?.error;
    console.error("[WA] sendTextMessage failed:", errData || error.message);
    return { success: false, error: errData?.message || error.message || "Unknown error" };
  }
};

/* ── Try to resolve a friendly name for an inbound number ──────────── */
const resolveCustomerName = async (mobile, profileName) => {
  if (profileName) return profileName;
  try {
    const last10 = mobile.replace(/[^0-9]/g, "").slice(-10);
    const user = await userModel
      .findOne({ mobile: { $regex: last10 + "$" } })
      .select("name shopName")
      .lean();
    return user?.name || user?.shopName || "";
  } catch {
    return "";
  }
};

/* ── GET /api/whatsapp/webhook — Meta's one-time verification handshake ── */
export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[webhook] Verified successfully by Meta");
    return res.status(200).send(challenge);
  }
  console.warn("[webhook] Verification failed — token mismatch");
  return res.sendStatus(403);
};

/* ── Verify Meta's HMAC signature on incoming webhook payloads ─────── */
const verifySignature = (req) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const signatureHeader = req.headers["x-hub-signature-256"];
  if (!secret || !signatureHeader || !req.rawBody) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false; // length mismatch etc. — treat as invalid
  }
};

/* ── Handle one inbound customer message ────────────────────────────── */
const handleIncomingMessage = async (value, msg) => {
  const mobile = msg.from;
  const type = msg.type;

  let body = "";
  if (type === "text") body = msg.text?.body || "";
  else if (type === "image") body = msg.image?.caption || "[Image]";
  else if (type === "document") body = msg.document?.caption || msg.document?.filename || "[Document]";
  else if (type === "audio") body = "[Audio]";
  else if (type === "video") body = msg.video?.caption || "[Video]";
  else body = `[${type}]`;

  const profileName = value.contacts?.[0]?.profile?.name;
  const now = new Date();

  let conversation = await Conversation.findOne({ mobile });
  if (!conversation) {
    conversation = await Conversation.create({
      mobile,
      name: await resolveCustomerName(mobile, profileName),
    });
  } else if (!conversation.name && profileName) {
    conversation.name = profileName;
  }

  conversation.lastMessage = body;
  conversation.lastMessageAt = now;
  conversation.lastDirection = "in";
  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  conversation.sessionExpiresAt = new Date(now.getTime() + SESSION_WINDOW_MS);
  await conversation.save();

  const message = await Message.create({
    conversation: conversation._id,
    mobile,
    direction: "in",
    type,
    body,
    waMessageId: msg.id,
    status: "received",
    timestamp: new Date(Number(msg.timestamp) * 1000),
    raw: msg,
  });

  getIO()?.emit("whatsapp:new-message", {
    conversationId: conversation._id,
    mobile,
    message,
    unreadCount: conversation.unreadCount,
  });
};

/* ── Handle a delivery/read/failed status update for a message we sent ── */
const handleStatusUpdate = async (status) => {
  await Message.updateOne({ waMessageId: status.id }, { $set: { status: status.status } });
  getIO()?.emit("whatsapp:status-update", { waMessageId: status.id, status: status.status });
};

/* ── POST /api/whatsapp/webhook — receives replies + status updates ── */
export const receiveWebhook = async (req, res) => {
  const secretConfigured = !!process.env.WHATSAPP_APP_SECRET;
  if (secretConfigured && !verifySignature(req)) {
    console.warn("[webhook] Invalid signature — rejecting payload");
    return res.sendStatus(401);
  }
  if (!secretConfigured) {
    console.warn("[webhook] WHATSAPP_APP_SECRET not set — signature verification skipped!");
  }

  // Acknowledge immediately; Meta retries aggressively on slow/non-200 responses.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;
        for (const msg of value.messages || []) {
          await handleIncomingMessage(value, msg);
        }
        for (const status of value.statuses || []) {
          await handleStatusUpdate(status);
        }
      }
    }
  } catch (error) {
    console.error("[webhook] processing error:", error);
  }
};

/* ── GET /api/whatsapp/conversations ────────────────────────────────── */
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ lastMessageAt: -1 }).lean();
    return res.json({ success: true, conversations });
  } catch (error) {
    console.error("[getConversations] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── GET /api/whatsapp/conversations/:mobile/messages ───────────────── */
export const getMessages = async (req, res) => {
  try {
    const { mobile } = req.params;
    const conversation = await Conversation.findOne({ mobile }).lean();
    if (!conversation) return res.json({ success: true, conversation: null, messages: [] });

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ success: true, conversation, messages });
  } catch (error) {
    console.error("[getMessages] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── POST /api/whatsapp/conversations/:mobile/send ───────────────────── */
export const sendChatMessage = async (req, res) => {
  try {
    const { mobile } = req.params;
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: "Message body required" });
    }

    const conversation = await Conversation.findOne({ mobile });
    const withinWindow = conversation?.sessionExpiresAt && conversation.sessionExpiresAt > new Date();
    if (!withinWindow) {
      return res.status(409).json({
        success: false,
        sessionExpired: true,
        message: "24-hour reply window has closed. Send a template message via Broadcast instead.",
      });
    }

    const result = await sendTextMessage(mobile, body.trim());
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error });
    }

    const message = await Message.create({
      conversation: conversation._id,
      mobile,
      direction: "out",
      type: "text",
      body: body.trim(),
      waMessageId: result.waMessageId,
      status: "sent",
      timestamp: new Date(),
    });

    conversation.lastMessage = body.trim();
    conversation.lastMessageAt = new Date();
    conversation.lastDirection = "out";
    await conversation.save();

    getIO()?.emit("whatsapp:new-message", {
      conversationId: conversation._id,
      mobile,
      message,
    });

    return res.json({ success: true, message });
  } catch (error) {
    console.error("[sendChatMessage] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── POST /api/whatsapp/conversations/:mobile/read ───────────────────── */
export const markConversationRead = async (req, res) => {
  try {
    const { mobile } = req.params;
    await Conversation.updateOne({ mobile }, { $set: { unreadCount: 0 } });
    return res.json({ success: true });
  } catch (error) {
    console.error("[markConversationRead] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
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
        await saveOutboundMessage(result.formattedMobile, name || "Customer", templateName, result.waMessageId);
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
      if (result.success) {
        sent.push({ name: name || "Customer", mobile: mobile.trim() });
        await saveOutboundMessage(result.formattedMobile, name || "Customer", templateName, result.waMessageId);
      } else {
        failed.push({ name: name || "Customer", mobile: mobile.trim(), error: result.error });
      }
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
