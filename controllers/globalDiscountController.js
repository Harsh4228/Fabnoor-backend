import globalDiscountModel from "../models/globalDiscountModel.js";

/**
 * Get Global Discount
 */
const getGlobalDiscount = async (req, res) => {
    try {
        let globalDiscount = await globalDiscountModel.findOne();
        if (!globalDiscount) {
            // Create a default if it doesn't exist
            globalDiscount = await globalDiscountModel.create({
                discountPercentage: 0,
                isActive: false,
                lowStockThreshold: 5,
            });
        }
        res.json({ success: true, globalDiscount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update Global Discount (Admin)
 */
const updateGlobalDiscount = async (req, res) => {
    try {
        const { discountPercentage, isActive, lowStockThreshold } = req.body;

        let globalDiscount = await globalDiscountModel.findOne();

        if (!globalDiscount) {
            globalDiscount = new globalDiscountModel({
                discountPercentage: Number(discountPercentage) || 0,
                isActive: isActive === "true" || isActive === true,
                lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
            });
        } else {
            globalDiscount.discountPercentage =
                discountPercentage !== undefined ? Number(discountPercentage) : globalDiscount.discountPercentage;
            globalDiscount.isActive =
                isActive !== undefined ? (isActive === "true" || isActive === true) : globalDiscount.isActive;
            globalDiscount.lowStockThreshold =
                lowStockThreshold !== undefined ? Number(lowStockThreshold) : globalDiscount.lowStockThreshold;
        }

        globalDiscount.updatedAt = Date.now();
        await globalDiscount.save();

        res.json({ success: true, message: "Global discount updated", globalDiscount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export { getGlobalDiscount, updateGlobalDiscount };
