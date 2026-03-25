import heroImageModel from "../models/heroImageModel.js";
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
    console.error("Failed to delete hero image file:", e.message);
  }
};

// GET /api/hero — public, returns ordered list
export const listHeroImages = async (req, res) => {
  try {
    const images = await heroImageModel.find({}).sort({ order: 1, createdAt: 1 });
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/add — admin only
export const addHeroImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image file is required" });
    }
    const url = buildFileUrl(req, req.file.filename);
    const count = await heroImageModel.countDocuments();
    const image = await heroImageModel.create({
      url,
      filename: req.file.filename,
      order: count,
    });
    res.json({ success: true, image });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/remove — admin only
export const removeHeroImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await heroImageModel.findById(id);
    if (!image) return res.status(404).json({ success: false, message: "Image not found" });
    deleteFile(image.url);
    await heroImageModel.findByIdAndDelete(id);
    res.json({ success: true, message: "Hero image removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/reorder — admin only, body: { ids: [...] }
export const reorderHeroImages = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, message: "ids array required" });
    await Promise.all(ids.map((id, index) => heroImageModel.findByIdAndUpdate(id, { order: index })));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
