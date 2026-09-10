import Reel from "../models/Reel.js";
import { uploadLargeBufferToCloudinary, deleteFromCloudinaryByUrl } from "../config/cloudinary.js";

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

    const result = await uploadLargeBufferToCloudinary(req.file.buffer, {
      folder: "fabnoor/reels",
    });
    const videoUrl = result.secure_url;

    const reel = await Reel.create({
      videoUrl,
      caption: req.body.caption || "",
      createdBy: req.user._id,
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

    const reel = await Reel.findByIdAndDelete(id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Delete the video file from Cloudinary
    if (reel.videoUrl) {
      await deleteFromCloudinaryByUrl(reel.videoUrl, "video");
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