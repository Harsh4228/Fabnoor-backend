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

    const reel = await Reel.findById(id);

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: "Reel not found",
      });
    }

    // Cloudinary video is kept so the reel can be restored later; it's only
    // cleaned up on permanent delete.
    await reel.softDelete(req.user?._id);

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

/* =========================
   TRASH: LIST DELETED REELS (ADMIN)
========================= */
export const listDeletedReels = async (req, res) => {
  try {
    const reels = await Reel.find({ isDeleted: true }).sort({ deletedAt: -1 });
    return res.status(200).json(reels);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   TRASH: RESTORE REEL (ADMIN)
========================= */
export const restoreReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await Reel.findOne({ _id: id, isDeleted: true });
    if (!reel) {
      return res.status(404).json({ success: false, message: "Reel not found in trash" });
    }
    await reel.restore();
    return res.status(200).json({ success: true, message: "Reel restored", reel });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   TRASH: PERMANENTLY DELETE REEL (ADMIN)
========================= */
export const permanentlyDeleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    const reel = await Reel.findOne({ _id: id, isDeleted: true });
    if (!reel) {
      return res.status(404).json({ success: false, message: "Reel not found in trash" });
    }

    if (reel.videoUrl) {
      await deleteFromCloudinaryByUrl(reel.videoUrl, "video");
    }
    await reel.deleteOne();

    return res.status(200).json({ success: true, message: "Reel permanently deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};