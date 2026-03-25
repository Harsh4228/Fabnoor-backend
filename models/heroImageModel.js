import mongoose from "mongoose";

const heroImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const heroImageModel = mongoose.models.heroImage || mongoose.model("heroImage", heroImageSchema);
export default heroImageModel;
