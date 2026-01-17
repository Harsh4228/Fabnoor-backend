import userModel from "../models/userModel.js";

/**
 * =========================
 * ADD TO CART (WHOLESALE PACK)
 * =========================
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, color = "", type = "" } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const cart = user.cartData || {};

    // ✅ if not exists create pack object
    if (!cart[itemId]) {
      cart[itemId] = {
        quantity: 1,
        color,
        type,
      };
    } else {
      // ✅ increase qty
      cart[itemId].quantity = Number(cart[itemId].quantity || 0) + 1;

      // ✅ update variant info if provided
      if (color) cart[itemId].color = color;
      if (type) cart[itemId].type = type;
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
 * UPDATE CART (WHOLESALE PACK)
 * =========================
 */
export const updateCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, quantity } = req.body;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const cart = user.cartData || {};
    const qty = Number(quantity);

    // ✅ remove product if qty <= 0
    if (qty <= 0) {
      delete cart[itemId];
    } else {
      // ✅ if product not exists create
      if (!cart[itemId]) {
        cart[itemId] = {
          quantity: qty,
          color: "",
          type: "",
        };
      } else {
        cart[itemId].quantity = qty;
      }
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
      return res.status(401).json({ success: false, message: "User not found" });
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
