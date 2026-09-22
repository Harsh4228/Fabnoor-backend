import express from "express";
import {
  uploadReel,
  getAllReels,
  toggleLikeReel,
  deleteReel,
  listDeletedReels,
  restoreReel,
  permanentlyDeleteReel,
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

// Trash / soft-delete management
router.get("/trash/list", authUser, adminAuth, listDeletedReels);
router.post("/trash/restore/:id", authUser, adminAuth, restoreReel);
router.delete("/trash/:id", authUser, adminAuth, permanentlyDeleteReel);

export default router;
