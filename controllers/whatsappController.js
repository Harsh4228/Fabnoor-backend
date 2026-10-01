import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import userModel from "../models/userModel.js";
import BroadcastLog from "../models/BroadcastLog.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { getIO } from "../config/socket.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import {
  fetchApprovedTemplates,
  findTemplate,
  analyzeTemplate,
  validateParams,
  buildComponents,
  renderTemplateText,
} from "../config/whatsappTemplates.js";
dotenv.config();

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000; // WhatsApp's 24h customer service window

// Normalizes any admin-entered mobile into the same wa_id format Meta reports
// back on inbound webhooks (e.g. "919876543210"). Without this, a broadcast
// sent to a loosely-formatted number (leading 0, missing country code, etc.)
// creates a Conversation under a different `mobile` string than the one the
// customer's reply arrives under — the reply then lands in a brand-new
// conversation instead of the existing thread, so it looks like it "never
// shows up" in the chat the admin is actually looking at.
const normalizeIndianMobile = (raw) => {
  let digits = (raw || "").replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1); // drop a leading trunk "0"
  }
  if (digits.length === 10) {
    digits = `91${digits}`; // bare local number — add the India country code
  }
  return digits;
};

/* ── Send a single template message ────────────────────── */
// `tpl` is the template definition fetched from Meta; `params` are the values
// the admin filled in the panel. The payload is built generically from the
// template itself, so any newly approved template works without code changes.
const sendTemplateMessage = async (to, tpl, params, contact) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) return { success: false, error: "Missing credentials" };

    const formattedNumber = normalizeIndianMobile(to);

    const templatePayload = {
      name: tpl.name,
      language: { code: tpl.language },
    };
    const components = buildComponents(tpl, params, contact);
    if (components.length) templatePayload.components = components;

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
    const detail = errData?.error_data?.details;
    return {
      success: false,
      error: (errData?.message || error.message || "Unknown error") + (detail ? ` — ${detail}` : ""),
    };
  }
};

/* ── Save outbound broadcast message to chat history ─────── */
const saveOutboundMessage = async (formattedMobile, name, body, waMessageId) => {
  try {
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

/* ── Load + validate the template a broadcast/test asks for ── */
// Returns { tpl } or { error }. Validating once up front means a missing
// value fails the whole send instead of producing 500 identical Meta errors.
const loadTemplateForSend = async ({ templateName, language, params }) => {
  if (!templateName) return { error: "Template name is required" };
  let tpl;
  try {
    tpl = await findTemplate(templateName, language);
  } catch (err) {
    return { error: `Could not load templates from Meta: ${err.response?.data?.error?.message || err.message}` };
  }
  if (!tpl) return { error: `Template "${templateName}" (${language || "any language"}) is not approved on Meta` };
  const problem = validateParams(analyzeTemplate(tpl), params || {});
  if (problem) return { error: problem };
  return { tpl };
};

/* ── Send to one contact + record it in chat history ── */
const sendToContact = async (tpl, params, contact) => {
  const name = contact.name || "Customer";
  const mobile = (contact.mobile || "").trim();
  if (!mobile) return { success: false, name: contact.name || "Unknown", mobile: "", error: "Missing mobile number" };

  const result = await sendTemplateMessage(mobile, tpl, params, { name, mobile });
  if (result.success) {
    const body = renderTemplateText(tpl, params, { name, mobile });
    await saveOutboundMessage(result.formattedMobile, name, body, result.waMessageId);
  }
  return { ...result, name, mobile };
};

/* ── Deduplicate by mobile number ───────────────────────── */
const deduplicateContacts = (contacts) => {
  const seen = new Set();
  return contacts.filter((c) => {
    const key = normalizeIndianMobile(c.mobile);
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

  // Meta retries webhook delivery aggressively on any slow/non-200 response —
  // without this guard a retry would insert the same message twice and
  // double-count unreadCount.
  const alreadyProcessed = await Message.findOne({ waMessageId: msg.id }).select("_id").lean();
  if (alreadyProcessed) {
    console.log(`[webhook] duplicate delivery for waMessageId=${msg.id} — skipping`);
    return;
  }

  let body = "";
  if (type === "text") body = msg.text?.body || "";
  else if (type === "image") body = msg.image?.caption || "[Image]";
  else if (type === "document") body = msg.document?.caption || msg.document?.filename || "[Document]";
  else if (type === "audio") body = "[Audio]";
  else if (type === "video") body = msg.video?.caption || "[Video]";
  else body = `[${type}]`;

  const profileName = value.contacts?.[0]?.profile?.name;
  const now = new Date();

  // Upsert atomically — two near-simultaneous first messages from the same
  // new contact would otherwise both try to `create()` and collide on the
  // unique `mobile` index.
  let conversation = await Conversation.findOneAndUpdate(
    { mobile },
    { $setOnInsert: { mobile, name: await resolveCustomerName(mobile, profileName) } },
    { new: true, upsert: true }
  );

  if (!conversation.name && profileName) {
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

  console.log(
    `[webhook] saved inbound message from ${mobile} (conversation ${conversation._id}), ` +
    `socket clients notified: ${getIO()?.engine?.clientsCount ?? "io not initialized"}`
  );
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
    console.warn(
      "[webhook] Invalid signature — rejecting payload. " +
      `(x-hub-signature-256 header present: ${!!req.headers["x-hub-signature-256"]}, ` +
      `rawBody captured: ${!!req.rawBody}). If this happens for every webhook call, ` +
      "WHATSAPP_APP_SECRET likely doesn't match the Meta App Secret currently in use."
    );
    return res.sendStatus(401);
  }
  if (!secretConfigured) {
    console.warn("[webhook] WHATSAPP_APP_SECRET not set — signature verification skipped!");
  }

  // Acknowledge immediately; Meta retries aggressively on slow/non-200 responses.
  res.sendStatus(200);

  try {
    const entries = req.body?.entry || [];
    if (!entries.length) {
      console.warn("[webhook] received payload with no entries:", JSON.stringify(req.body));
    }
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

/* ── GET /api/whatsapp/templates — approved templates + the inputs each needs ── */
export const getTemplates = async (req, res) => {
  try {
    const raw = await fetchApprovedTemplates({ refresh: req.query.refresh === "1" });
    const templates = raw.map(analyzeTemplate).sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ success: true, templates });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.error("[getTemplates] error:", msg);
    return res.status(502).json({ success: false, message: msg });
  }
};

/* ── POST /api/whatsapp/template-media — upload a header image/video/PDF ── */
export const uploadTemplateMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const mime = req.file.mimetype;
    // PDFs go up as "raw": Cloudinary blocks PDF delivery from the image pipeline by default.
    const resourceType = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "raw";
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      resource_type: resourceType,
      folder: "whatsapp_templates",
      ...(resourceType === "raw"
        ? { public_id: `${Date.now()}_${req.file.originalname.replace(/[^A-Za-z0-9._-]/g, "_")}` }
        : {}),
    });
    return res.json({ success: true, url: result.secure_url, filename: req.file.originalname });
  } catch (error) {
    console.error("[uploadTemplateMedia] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── POST /api/whatsapp/test-send — send the template to one number first ── */
export const testSendTemplate = async (req, res) => {
  try {
    const { templateName, language, params, mobile, name } = req.body;
    if (!mobile) return res.status(400).json({ success: false, message: "Test mobile number is required" });

    const { tpl, error } = await loadTemplateForSend({ templateName, language, params });
    if (error) return res.status(400).json({ success: false, message: error });

    const result = await sendToContact(tpl, params, { name: name || "Test", mobile });
    if (!result.success) return res.status(502).json({ success: false, message: result.error });
    return res.json({ success: true, message: `Test sent to ${result.formattedMobile}` });
  } catch (error) {
    console.error("[testSendTemplate] error:", error);
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
    const { contacts, templateName, language, params } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      sendEvent({ type: "error", message: "No contacts provided" });
      return res.end();
    }

    const { tpl, error } = await loadTemplateForSend({ templateName, language, params });
    if (error) {
      sendEvent({ type: "error", message: error });
      return res.end();
    }

    const list = deduplicateContacts(contacts);
    sendEvent({ type: "start", total: list.length });

    const sent = [];
    const failed = [];

    for (let i = 0; i < list.length; i++) {
      const result = await sendToContact(tpl, params, list[i]);
      const label = list[i].name || result.mobile || "Unknown";

      if (result.success) {
        sent.push({ name: result.name, mobile: result.mobile });
        sendEvent({ type: "progress", progress: i + 1, total: list.length, status: "sent", contact: label });
      } else {
        failed.push({ name: result.name, mobile: result.mobile, error: result.error });
        sendEvent({ type: "progress", progress: i + 1, total: list.length, status: "failed", contact: label, error: result.error });
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
    const { contacts, templateName, language, params } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0)
      return res.json({ success: false, message: "No contacts provided" });

    const { tpl, error } = await loadTemplateForSend({ templateName, language, params });
    if (error) return res.json({ success: false, message: error });

    const list = deduplicateContacts(contacts);
    const sent = [];
    const failed = [];

    for (const contact of list) {
      const result = await sendToContact(tpl, params, contact);
      if (result.success) sent.push({ name: result.name, mobile: result.mobile });
      else failed.push({ name: result.name, mobile: result.mobile, error: result.error });
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
