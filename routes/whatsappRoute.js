import express from "express";
import { broadcastMessage } from "../controllers/whatsappController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const whatsappRouter = express.Router();

whatsappRouter.post("/broadcast", authUser, adminAuth, broadcastMessage);

export default whatsappRouter;
