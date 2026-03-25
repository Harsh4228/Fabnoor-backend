import express from "express";
import {
  listHeroImages,
  addHeroImage,
  removeHeroImage,
  reorderHeroImages,
} from "../controllers/heroImageController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import upload from "../middleware/multer.js";

const heroRouter = express.Router();

heroRouter.get("/", listHeroImages);
heroRouter.post("/add", authUser, adminAuth, upload.single("image"), addHeroImage);
heroRouter.post("/remove", authUser, adminAuth, removeHeroImage);
heroRouter.post("/reorder", authUser, adminAuth, reorderHeroImages);

export default heroRouter;
