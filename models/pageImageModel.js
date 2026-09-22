import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

const pageImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  page: { type: String, enum: ["about", "contact"], required: true },
  createdAt: { type: Date, default: Date.now },
});

pageImageSchema.plugin(softDeletePlugin);

const pageImageModel =
  mongoose.models.pageImage || mongoose.model("pageImage", pageImageSchema);

export default pageImageModel;
