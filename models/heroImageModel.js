import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

const heroImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

heroImageSchema.plugin(softDeletePlugin);

const heroImageModel = mongoose.models.heroImage || mongoose.model("heroImage", heroImageSchema);
export default heroImageModel;
