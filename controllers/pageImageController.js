import pageImageModel from "../models/pageImageModel.js";
import { uploadBufferToCloudinary, deleteFromCloudinaryByUrl } from "../config/cloudinary.js";

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
      await deleteFromCloudinaryByUrl(existing.url, "image");
      await pageImageModel.findByIdAndDelete(existing._id);
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "fabnoor/pages",
    });
    const image = await pageImageModel.create({
      url: result.secure_url,
      filename: result.public_id,
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
    await deleteFromCloudinaryByUrl(image.url, "image");
    await pageImageModel.findByIdAndDelete(id);
    res.json({ success: true, message: "Page image removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
