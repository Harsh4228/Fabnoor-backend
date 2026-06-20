import express from "express";
import {
  broadcastMessage,
  broadcastStream,
  getCustomers,
  getBroadcastHistory,
  getBroadcastHistoryDetail,
  verifyWebhook,
  receiveWebhook,
  getConversations,
  getMessages,
  sendChatMessage,
  markConversationRead,
} from "../controllers/whatsappController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const whatsappRouter = express.Router();

/* ── Webhook (called by Meta directly — no JWT auth) ── */
whatsappRouter.get("/webhook", verifyWebhook);
whatsappRouter.post("/webhook", receiveWebhook);

/* ── Broadcast (existing) ── */
whatsappRouter.get("/customers", authUser, adminAuth, getCustomers);
whatsappRouter.get("/history", authUser, adminAuth, getBroadcastHistory);
whatsappRouter.get("/history/:id", authUser, adminAuth, getBroadcastHistoryDetail);
whatsappRouter.post("/broadcast", authUser, adminAuth, broadcastMessage);
whatsappRouter.post("/broadcast-stream", authUser, adminAuth, broadcastStream);

/* ── Two-way chat ── */
whatsappRouter.get("/conversations", authUser, adminAuth, getConversations);
whatsappRouter.get("/conversations/:mobile/messages", authUser, adminAuth, getMessages);
whatsappRouter.post("/conversations/:mobile/send", authUser, adminAuth, sendChatMessage);
whatsappRouter.post("/conversations/:mobile/read", authUser, adminAuth, markConversationRead);

export default whatsappRouter;
