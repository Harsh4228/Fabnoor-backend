import Reel from "../models/Reel.js";
import { cloudinary } from "../config/cloudinary.js";
import fs from "fs";

/* =========================
   UPLOAD REEL (ADMIN)
========================= */
export const uploadReel = async (req, res) => {
  try {
    // authUser already attached req.user
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Video file is required" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "reels",
    });

    // remove temp file
    fs.unlink(req.file.path, () => {});

    const reel = await Reel.create({
      videoUrl: result.secure_url,
      caption: req.body.caption || "",
      createdBy: req.user._id, // ✅ FIXED LINE
    });

    return res.status(201).json(reel);
  } catch (error) {
    console.error("UPLOAD REEL ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET ALL REELS
========================= */
export const getAllReels = async (req, res) => {
  try {
    const reels = await Reel.find()
      .populate()
      .sort({ createdAt: -1 });

    return res.status(200).json(reels);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   LIKE / UNLIKE
========================= */
export const toggleLikeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    const userId = req.user._id;

    if (reel.likes.includes(userId)) {
      reel.likes.pull(userId);
    } else {
      reel.likes.push(userId);
    }

    await reel.save();
    return res.status(200).json(reel);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   DELETE REEL (ADMIN)
========================= */
export const deleteReel = async (req, res) => {
  try {
    const { id } = req.params;

    // 2️⃣ Find & delete in one step
    const reel = await Reel.findByIdAndDelete(id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }


    return res.status(200).json({
      success: true,
      message: "Reel deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};