import validator from "validator";
import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import signupRequestModel from "../models/signupRequestModel.js";
import { sendWelcomeEmail } from "../config/emailService.js";

/* ======================================================
   POST /api/signup-request/create   (public – no auth)
   Body: { name, mobile, email }
====================================================== */
export const createSignupRequest = async (req, res) => {
  try {
    const { name, mobile, email } = req.body;

    if (!name || !name.trim())   return res.json({ success: false, message: "Name is required" });
    if (!mobile || !mobile.trim()) return res.json({ success: false, message: "Mobile is required" });
    if (!email || !validator.isEmail(email))
      return res.json({ success: false, message: "Enter a valid email" });

    // Block if user already exists
    const userExists = await userModel.findOne({ email: email.toLowerCase() });
    if (userExists) return res.json({ success: false, message: "An account with this email already exists" });

    // Block duplicate pending request
    const existing = await signupRequestModel.findOne({
      email: email.toLowerCase(),
      status: "pending",
    });
    if (existing) return res.json({ success: false, message: "A signup request with this email is already pending" });

    await signupRequestModel.create({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.toLowerCase(),
    });

    return res.json({ success: true, message: "Signup request submitted. The admin will create your account shortly." });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: err.message });
  }
};

/* ======================================================
   GET /api/signup-request/all   (admin only)
====================================================== */
export const getAllSignupRequests = async (req, res) => {
  try {
    const requests = await signupRequestModel.find().sort({ createdAt: -1 });
    return res.json({ success: true, requests });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: err.message });
  }
};

/* ======================================================
   POST /api/signup-request/approve   (admin only)
   Body: { requestId, name, mobile, email, shopName, password }
   Admin fills in shop name + password then creates the account.
====================================================== */
export const approveSignupRequest = async (req, res) => {
  try {
    const { requestId, name, mobile, email, shopName, password } = req.body;

    if (!requestId) return res.json({ success: false, message: "requestId is required" });
    if (!shopName || !shopName.trim()) return res.json({ success: false, message: "Shop name is required" });
    if (!password || password.length < 8)
      return res.json({ success: false, message: "Password must be at least 8 characters" });

    const request = await signupRequestModel.findById(requestId);
    if (!request) return res.json({ success: false, message: "Request not found" });
    if (request.status !== "pending") return res.json({ success: false, message: "Request already processed" });

    // Final duplicate guard
    const userExists = await userModel.findOne({ email: email.toLowerCase() });
    if (userExists) {
      await signupRequestModel.findByIdAndUpdate(requestId, { status: "approved" });
      return res.json({ success: false, message: "An account with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await userModel.create({
      name: name.trim(),
      email: email.toLowerCase(),
      mobile: mobile.trim(),
      shopName: shopName.trim(),
      password: hashedPassword,
      role: "user",
    });

    await signupRequestModel.findByIdAndUpdate(requestId, { status: "approved" });

    // Fire-and-forget welcome email
    sendWelcomeEmail(user.email, user.name).catch(err =>
      console.error("Welcome email failed:", err)
    );

    return res.json({ success: true, message: `Account created for ${user.name}` });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: err.message });
  }
};

/* ======================================================
   POST /api/signup-request/reject   (admin only)
   Body: { requestId }
====================================================== */
export const rejectSignupRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.json({ success: false, message: "requestId is required" });

    const request = await signupRequestModel.findById(requestId);
    if (!request) return res.json({ success: false, message: "Request not found" });

    await signupRequestModel.findByIdAndUpdate(requestId, { status: "rejected" });
    return res.json({ success: true, message: "Request rejected" });
  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: err.message });
  }
};
