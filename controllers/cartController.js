import userModel from "../models/userModel.js";

/**
 * =========================
 * ADD TO CART
 * =========================
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, size } = req.body;

    if (!itemId || !size) {
      return res.status(400).json({
        success: false,
        message: "Item ID and size are required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false });
    }

    const cart = user.cartData || {};

    if (!cart[itemId]) cart[itemId] = {};
    cart[itemId][size] = (cart[itemId][size] || 0) + 1;

    user.cartData = cart;
    await user.save();

    res.json({
      success: true,
      cartData: user.cartData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * UPDATE CART
 * =========================
 */
export const updateCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, size, quantity } = req.body;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false });
    }

    const cart = user.cartData || {};

    if (!cart[itemId]) cart[itemId] = {};

    if (quantity <= 0) {
      delete cart[itemId][size];
      if (Object.keys(cart[itemId]).length === 0) {
        delete cart[itemId];
      }
    } else {
      cart[itemId][size] = quantity;
    }

    user.cartData = cart;
    await user.save();

    res.json({
      success: true,
      cartData: user.cartData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =========================
 * GET USER CART
 * =========================
 */
export const getUserCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await userModel.findById(userId).select("cartData");

    if (!user) {
      return res.status(401).json({ success: false });
    }

    res.json({
      success: true,
      cartData: user.cartData || {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
