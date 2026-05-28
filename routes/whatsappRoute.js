import express from "express";
import {
  broadcastMessage,
  broadcastStream,
  getCustomers,
  getBroadcastHistory,
  getBroadcastHistoryDetail,
} from "../controllers/whatsappController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const whatsappRouter = express.Router();

whatsappRouter.get("/customers", authUser, adminAuth, getCustomers);
whatsappRouter.get("/history", authUser, adminAuth, getBroadcastHistory);
whatsappRouter.get("/history/:id", authUser, adminAuth, getBroadcastHistoryDetail);
whatsappRouter.post("/broadcast", authUser, adminAuth, broadcastMessage);
whatsappRouter.post("/broadcast-stream", authUser, adminAuth, broadcastStream);

export default whatsappRouter;
