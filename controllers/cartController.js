import userModel from "../models/userModel.js";

/**
 * =========================
 * ADD TO CART
 * =========================
 */
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { itemId, color = "", type = "", code = "" } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: "Item ID required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // Clone the cart data so Mongoose recognizes it as a completely new object
    const cartData = structuredClone(user.cartData || {});

    // ✅ if not exists create pack object
    if (!cartData[itemId]) {
      cartData[itemId] = {
        quantity: 1,
        color,
        type,
        code,
      };
    } else {
      // ✅ increase qty
      cartData[itemId].quantity = Number(cartData[itemId].quantity || 0) + 1;

      // ✅ update variant info if provided
      if (color) cartData[itemId].color = color;
      if (type) cartData[itemId].type = type;
      if (code) cartData[itemId].code = code;
    }

    // Replace the entire object
    await userModel.findByIdAndUpdate(userId, { cartData });

    // Fetch new state
    const updatedUser = await userModel.findById(userId).select("cartData");

    res.json({
      success: true,
      cartData: updatedUser.cartData || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    const { itemId, quantity } = req.body;

    if (!itemId) {
      return res.status(400).json({ success: false, message: "Item ID required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // Clone the cart data
    const cartData = structuredClone(user.cartData || {});
    const qty = Number(quantity);

    // ✅ remove product if qty <= 0
    if (qty <= 0) {
      delete cartData[itemId];
    } else {
      // ✅ if product not exists create
      if (!cartData[itemId]) {
        cartData[itemId] = {
          quantity: qty,
          color: "",
          type: "",
          code: "",
        };
      } else {
        cartData[itemId].quantity = qty;
      }
    }

    await userModel.findByIdAndUpdate(userId, { cartData });

    const updatedUser = await userModel.findById(userId).select("cartData");

    res.json({
      success: true,
      cartData: updatedUser.cartData || {},
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * =========================
 * MERGE CART (BULK)
 * =========================
 */
export const mergeCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cartData: clientCartData } = req.body;

    if (!clientCartData || typeof clientCartData !== "object") {
      return res.status(400).json({ success: false, message: "cartData required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const serverCart = structuredClone(user.cartData || {});

    for (const itemId in clientCartData) {
      const val = clientCartData[itemId] || {};
      const qty = Number(val.quantity || 0);
      const color = val.color || "";
      const type = val.type || "";
      const code = val.code || "";

      if (qty <= 0) continue;

      if (!serverCart[itemId]) {
        serverCart[itemId] = { quantity: qty, color, type, code };
      } else {
        serverCart[itemId].quantity = Number(serverCart[itemId].quantity || 0) + qty;
        if (color) serverCart[itemId].color = color;
        if (type) serverCart[itemId].type = type;
        if (code) serverCart[itemId].code = code;
      }
    }

    await userModel.findByIdAndUpdate(userId, { cartData: serverCart });

    const updatedUser = await userModel.findById(userId).select("cartData");

    res.json({ success: true, cartData: updatedUser.cartData || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
