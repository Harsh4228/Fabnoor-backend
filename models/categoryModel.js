import mongoose from "mongoose";
import softDeletePlugin from "../utils/softDeletePlugin.js";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Original name kept when soft-deleted so the unique index doesn't block
    // creating a new category with the same name while the old one is trashed.
    originalName: {
        type: String,
        default: undefined,
    },
    subCategories: {
        type: [String],
        default: []
    },
    sequence: {
        type: Number,
        default: 1
    }
}, { timestamps: true });

categorySchema.plugin(softDeletePlugin);

const categoryModel = mongoose.models.category || mongoose.model("category", categorySchema);

export default categoryModel;
