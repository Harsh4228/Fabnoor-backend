import express from "express";
import {
  listPageImages,
  addPageImage,
  removePageImage,
  listDeletedPageImages,
  restorePageImage,
  permanentlyDeletePageImage,
} from "../controllers/pageImageController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import upload from "../middleware/multer.js";

const pageImageRouter = express.Router();

pageImageRouter.get("/", listPageImages);
pageImageRouter.post(
  "/add",
  authUser,
  adminAuth,
  upload.single("image"),
  addPageImage
);
pageImageRouter.post("/remove", authUser, adminAuth, removePageImage);

// Trash / soft-delete management
pageImageRouter.get("/trash/list", authUser, adminAuth, listDeletedPageImages);
pageImageRouter.post("/trash/restore", authUser, adminAuth, restorePageImage);
pageImageRouter.post("/trash/delete", authUser, adminAuth, permanentlyDeletePageImage);

export default pageImageRouter;
