import express from "express";
import {
  createSignupRequest,
  getAllSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
} from "../controllers/signupRequestController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const signupRequestRouter = express.Router();

// Public – any visitor can submit a request
signupRequestRouter.post("/create", createSignupRequest);

// Admin only
signupRequestRouter.get("/all", authUser, adminAuth, getAllSignupRequests);
signupRequestRouter.post("/approve", authUser, adminAuth, approveSignupRequest);
signupRequestRouter.post("/reject", authUser, adminAuth, rejectSignupRequest);

export default signupRequestRouter;
