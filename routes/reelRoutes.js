import express from "express";
import {
  uploadReel,
  getAllReels,
  toggleLikeReel,
  deleteReel,
} from "../controllers/reelController.js";

import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import { uploadVideo } from "../middleware/multerVideo.js";

const router = express.Router();

// Public
router.get("/", getAllReels);

// Admin upload
router.post(
  "/",
  authUser,
  adminAuth,
  uploadVideo.single("video"),
  uploadReel
);

// ✅ Users can like/unlike
router.put("/like/:id", authUser, toggleLikeReel);

// Admin delete
router.delete("/:id", authUser, adminAuth, deleteReel);

export default router;
