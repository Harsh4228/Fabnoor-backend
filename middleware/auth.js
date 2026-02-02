import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const authUser = async (req, res, next) => {
  // helper to safely mask tokens for logs
  const maskToken = (t) => {
    if (!t) return '<none>';
    if (t.length <= 12) return t.replace(/.(?=.{4})/g, '*');
    return t.slice(0, 6) + '...' + t.slice(-4);
  };

  try {
    // If DB is disabled in limited debug mode, clearly indicate auth cannot proceed
    if (process.env.SKIP_DB === "true") {
      console.warn('[auth] Auth request while SKIP_DB=true - DB disabled for limited checks');
      return res.status(503).json({
        success: false,
        message: "Server running in limited debug mode (SKIP_DB=true); auth is disabled. Enable DB to perform authenticated operations.",
      });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn(
        '[auth] Missing or malformed Authorization header for',
        req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress
      );
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await userModel.findById(decoded.id).select("-password");

      if (!user) {
        console.warn('[auth] Token valid but user not found, token:', maskToken(token));
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      req.user = user; // ✅ attach the loaded user
      next();
    } catch (err) {
      console.warn('[auth] Token verification failed:', maskToken(token));
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
  } catch (error) {
    // unexpected error
    console.error('[auth] Unexpected auth error:', error && error.stack ? error.stack : error);
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

export default authUser;
