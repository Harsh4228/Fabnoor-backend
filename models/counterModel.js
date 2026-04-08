import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "orderNumber"
  seq: { type: Number, default: 0 },
});

const counterModel =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export default counterModel;
