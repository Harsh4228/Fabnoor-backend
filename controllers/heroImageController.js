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

// POST /api/hero/remove — admin only
export const removeHeroImage = async (req, res) => {
  try {
    const { id } = req.body;
    const image = await heroImageModel.findById(id);
    if (!image) return res.status(404).json({ success: false, message: "Image not found" });
    await deleteFromCloudinaryByUrl(image.url, "image");
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
