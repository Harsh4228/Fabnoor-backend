import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    mobile: { type: String, required: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    type: { type: String, default: "text" }, // text | image | document | audio | video | other
    body: { type: String, default: "" },
    waMessageId: { type: String }, // Meta's message id - used to match status updates
    status: { type: String, default: "sent" }, // sent | delivered | read | failed | received
    timestamp: { type: Date, default: Date.now },
    raw: { type: mongoose.Schema.Types.Mixed }, // original webhook payload, kept for debugging
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, timestamp: 1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
