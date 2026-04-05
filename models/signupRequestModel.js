import mongoose from "mongoose";

const signupRequestSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true },
    mobile: { type: String, required: true },
    email:  { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const signupRequestModel =
  mongoose.models.signupRequest ||
  mongoose.model("signupRequest", signupRequestSchema);

export default signupRequestModel;
