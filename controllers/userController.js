import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import userModel from "../models/userModel.js";

/* ================= TOKEN ================= */
const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* ================= USER LOGIN ================= */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};

/* ================= USER REGISTER ================= */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, mobile, shopName } = req.body;

    // Validate required fields are not just whitespace
    if (!name || name.trim() === "") {
      return res.json({ success: false, message: "Name is required" });
    }
    if (!shopName || shopName.trim() === "") {
      return res.json({ success: false, message: "Shop Name is required" });
    }
    if (!mobile || mobile.trim() === "") {
      return res.json({ success: false, message: "Mobile number is required" });
    }

    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter a valid email" });
    }

    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await userModel.create({
      name,
      email,
      mobile,
      shopName,
      password: hashedPassword,
      role: "user", // ✅ default role
    });

    const token = createToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        mobile: user.mobile,
        shopName: user.shopName,
      },
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};

/* ================= ADMIN LOGIN ================= */
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User doesn't exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    // ✅ ENSURE USER IS ADMIN
    if (user.role !== "admin") {
      return res.json({ success: false, message: "Admin access only" });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        mpbile: user.mobile,
      },
    });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: error.message });
  }
};



/* ================= GET LOGGED-IN USER ================= */
const getProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id).select("-password");
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= UPDATE PROFILE ================= */
const updateProfile = async (req, res) => {
  try {
    const { name, mobile, dob, gender, address, shopName } = req.body;

    // Check mobile if provided
    if (mobile && mobile.length !== 10) {
      return res.json({ success: false, message: "Invalid mobile number" });
    }

    const updateFields = { name, mobile };
    if (dob !== undefined) updateFields.dob = dob;
    if (gender !== undefined) updateFields.gender = gender;
    if (address !== undefined) updateFields.address = address;
    if (shopName !== undefined) updateFields.shopName = shopName;

    const user = await userModel.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true }
    ).select("-password");

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET ALL USERS (ADMIN) ================= */
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find({}).select("-password").sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET USER FULL DETAILS (ADMIN) ================= */
const getUserFullDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id).select("-password").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Since we also need to pull up this user's orders, import orderModel dynamically or ensure it's available.
    // For simplicity, we can just use mongoose.model('order') which works because orderModel is already registered.
    const orderModel = mongoose.model('order');
    const orders = await orderModel.find({ userId: id }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, user, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= DELETE USER (ADMIN) ================= */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    const user = await userModel.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { loginUser, registerUser, adminLogin, getProfile, updateProfile, getAllUsers, getUserFullDetails, deleteUser };
