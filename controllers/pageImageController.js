import pageImageModel from "../models/pageImageModel.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildFileUrl = (req, filename) => {
  const base = process.env.BACKEND_URL
    ? process.env.BACKEND_URL.replace(/\/$/, "")
    : `${req.get("x-forwarded-proto") || req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${filename}`;
};

const deleteFile = (url) => {
  if (!url) return;
  try {
    const parts = url.split("/uploads/");
    if (parts.length < 2) return;
    const filename = parts[parts.length - 1];
    if (!filename) return;
    const filePath = path.join(__dirname, "..", "uploads", filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error("Failed to delete page image file:", e.message);
  }
};

// GET /api/page-images?page=about|contact — public
export const listPageImages = async (req, res) => {
  try {
    const { page } = req.query;
    const filter = page ? { page } : {};
    const images = await pageImageModel.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/page-images/add — admin only
// body field: page ("about" | "contact")
export const addPageImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Image file is required" });
    }
    const { page } = req.body;
    if (!page || !["about", "contact"].includes(page)) {
      return res
        .status(400)
        .json({ success: false, message: 'page must be "about" or "contact"' });
    }

    // Replace existing image for this page
    const existing = await pageImageModel.findOne({ page });
    if (existing) {
      deleteFile(existing.url);
      await pageImageModel.findByIdAndDelete(existing._id);
    }

    const url = buildFileUrl(req, req.file.filename);
    const image = await pageImageModel.create({
      url,
      filename: req.file.filename,
      page,
    });
    res.json({ success: true, image });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/page-images/remove — admin only
export const removePageImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await pageImageModel.findById(id);
    if (!image)
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    deleteFile(image.url);
    await pageImageModel.findByIdAndDelete(id);
    res.json({ success: true, message: "Page image removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
