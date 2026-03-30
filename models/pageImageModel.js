import mongoose from "mongoose";

const pageImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  page: { type: String, enum: ["about", "contact"], required: true },
  createdAt: { type: Date, default: Date.now },
});

const pageImageModel =
  mongoose.models.pageImage || mongoose.model("pageImage", pageImageSchema);

export default pageImageModel;
