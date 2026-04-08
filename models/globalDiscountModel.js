import mongoose from "mongoose";

const globalDiscountSchema = new mongoose.Schema({
    discountPercentage: {
        type: Number,
        required: true,
        default: 0,
    },
    isActive: {
        type: Boolean,
        required: true,
        default: false,
    },
    lowStockThreshold: {
        type: Number,
        default: 5,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

const globalDiscountModel =
    mongoose.models.globalDiscount || mongoose.model("globalDiscount", globalDiscountSchema);

export default globalDiscountModel;
