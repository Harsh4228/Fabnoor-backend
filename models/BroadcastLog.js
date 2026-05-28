import mongoose from "mongoose";

const broadcastLogSchema = new mongoose.Schema(
  {
    templateName: { type: String, required: true },
    total: { type: Number, required: true },
    sentCount: { type: Number, required: true },
    failedCount: { type: Number, required: true },
    sent: [{ name: String, mobile: String }],
    failed: [{ name: String, mobile: String, error: String }],
  },
  { timestamps: true }
);

const BroadcastLog =
  mongoose.models.BroadcastLog || mongoose.model("BroadcastLog", broadcastLogSchema);

export default BroadcastLog;
