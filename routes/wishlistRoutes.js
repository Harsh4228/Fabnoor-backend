// routes/wishlistRoutes.js
import express from "express";
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from "../controllers/wishlistController.js";
import authUser from "../middleware/auth.js";

const router = express.Router();

router.post("/add", authUser, addToWishlist);
router.post("/remove", authUser, removeFromWishlist);
router.get("/", authUser, getWishlist);

export default router;
