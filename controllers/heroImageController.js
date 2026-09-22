import heroImageModel from "../models/heroImageModel.js";
import { uploadBufferToCloudinary, deleteFromCloudinaryByUrl } from "../config/cloudinary.js";

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
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "fabnoor/hero",
    });
    const count = await heroImageModel.countDocuments();
    const image = await heroImageModel.create({
      url: result.secure_url,
      filename: result.public_id,
      order: count,
    });
    res.json({ success: true, image });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/remove — admin only (soft delete)
export const removeHeroImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await heroImageModel.findById(id);
    if (!image) return res.status(404).json({ success: false, message: "Image not found" });
    // Cloudinary asset is kept so the image can be restored later.
    await image.softDelete(req.user?._id);
    res.json({ success: true, message: "Hero image removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/hero/trash/list — admin only
export const listDeletedHeroImages = async (req, res) => {
  try {
    const images = await heroImageModel.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/trash/restore — admin only
export const restoreHeroImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await heroImageModel.findOne({ _id: id, isDeleted: true });
    if (!image) return res.status(404).json({ success: false, message: "Image not found in trash" });
    await image.restore();
    res.json({ success: true, message: "Hero image restored", image });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/hero/trash/delete — admin only
export const permanentlyDeleteHeroImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await heroImageModel.findOne({ _id: id, isDeleted: true });
    if (!image) return res.status(404).json({ success: false, message: "Image not found in trash" });
    await deleteFromCloudinaryByUrl(image.url, "image");
    await image.deleteOne();
    res.json({ success: true, message: "Hero image permanently deleted" });
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
