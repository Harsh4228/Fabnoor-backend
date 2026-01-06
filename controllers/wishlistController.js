// controllers/wishlistController.js
import userModel from "../models/userModel.js";

/**
 * =========================
 * ADD TO WISHLIST
 * =========================
 */
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, color, size } = req.body;

    const user = await userModel.findById(userId);

    const alreadyExists = user.wishlist.some(
      (item) =>
        item.productId.toString() === productId &&
        item.color === color &&
        item.size === size
    );

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "Product already in wishlist",
      });
    }

    user.wishlist.push({ productId, color, size });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Added to wishlist",
      wishlist: user.wishlist,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * REMOVE FROM WISHLIST
 * =========================
 */
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, color, size } = req.body;

    const user = await userModel.findById(userId);

    user.wishlist = user.wishlist.filter(
      (item) =>
        !(
          item.productId.toString() === productId &&
          item.color === color &&
          item.size === size
        )
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Removed from wishlist",
      wishlist: user.wishlist,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * GET USER WISHLIST
 * =========================
 */
export const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await userModel
      .findById(userId)
      .populate("wishlist.productId");

    res.status(200).json({
      success: true,
      wishlist: user.wishlist,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
