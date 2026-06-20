import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    lastDirection: { type: String, enum: ["in", "out"], default: "in" },
    unreadCount: { type: Number, default: 0 },
    // 24h WhatsApp "customer service window" — set whenever the customer messages us.
    // Free-form replies are only allowed while now() < sessionExpiresAt.
    sessionExpiresAt: { type: Date },
  },
  { timestamps: true }
);

const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);

export default Conversation;
