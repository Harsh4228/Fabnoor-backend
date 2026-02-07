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

/**
 * =========================
 * MERGE CART (BULK) - merge guest/local cart into user cart
 * Accepts { cartData: { [itemId]: { quantity, color, type } } }
 * =========================
 */
export const mergeCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cartData } = req.body;

    if (!cartData || typeof cartData !== "object") {
      return res.status(400).json({ success: false, message: "cartData required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const serverCart = user.cartData || {};

    for (const itemId in cartData) {
      const val = cartData[itemId] || {};
      const qty = Number(val.quantity || 0);
      const color = val.color || "";
      const type = val.type || "";

      if (qty <= 0) continue;

      if (!serverCart[itemId]) {
        serverCart[itemId] = { quantity: qty, color, type };
      } else {
        serverCart[itemId].quantity = Number(serverCart[itemId].quantity || 0) + qty;
        if (color) serverCart[itemId].color = color;
        if (type) serverCart[itemId].type = type;
      }
    }

    user.cartData = serverCart;
    await user.save();

    res.json({ success: true, cartData: user.cartData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
