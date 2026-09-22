import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

const reelSchema = new mongoose.Schema(
  {
    videoUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

reelSchema.plugin(softDeletePlugin);

export default mongoose.models.Reel || mongoose.model("Reel", reelSchema);
