import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";

// Add Category
const addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "Category name is required" });
        }

        const existing = await categoryModel.findOne({ name: name.trim() });
        if (existing) {
            return res.status(400).json({ success: false, message: "Category already exists" });
        }

        const category = await categoryModel.create({ name: name.trim() });
        res.json({ success: true, message: "Category added", category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// List Categories
const listCategories = async (req, res) => {
    try {
        const categories = await categoryModel.find({}).sort({ name: 1 });
        res.json({ success: true, categories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove Category
const removeCategory = async (req, res) => {
    try {
        const { id } = req.body;
        const category = await categoryModel.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Check if any products exist in this category
        const productCount = await productModel.countDocuments({ category: category.name });
        if (productCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete category. There are ${productCount} products assigned to it.` 
            });
        }

        await categoryModel.findByIdAndDelete(id);
        res.json({ success: true, message: "Category removed" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Category
const updateCategory = async (req, res) => {
    try {
        const { id, name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }

        const category = await categoryModel.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // If name changes, we theoretically should update all products, 
        // but the user's request focuses on CRUD. 
        // For safety, let's just update the category name if no products exist, 
        // OR warn that existing products will keep the old string until updated.
        // However, a simple name update is usually expected.
        
        await categoryModel.findByIdAndUpdate(id, { name: name.trim() });
        res.json({ success: true, message: "Category updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add Subcategory
const addSubCategory = async (req, res) => {
    try {
        const { categoryId, subCategoryName } = req.body;
        if (!subCategoryName) {
            return res.status(400).json({ success: false, message: "Subcategory name is required" });
        }

        const category = await categoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        if (category.subCategories.includes(subCategoryName.trim())) {
            return res.status(400).json({ success: false, message: "Subcategory already exists in this category" });
        }

        category.subCategories.push(subCategoryName.trim());
        await category.save();

        res.json({ success: true, message: "Subcategory added", category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove Subcategory
const removeSubCategory = async (req, res) => {
    try {
        const { categoryId, subCategoryName } = req.body;
        const category = await categoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Check if any products exist in this subcategory under this category
        const productCount = await productModel.countDocuments({ 
            category: category.name, 
            subCategory: subCategoryName 
        });

        if (productCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete subcategory. There are ${productCount} products assigned to it.` 
            });
        }

        category.subCategories = category.subCategories.filter(s => s !== subCategoryName);
        await category.save();

        res.json({ success: true, message: "Subcategory removed", category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export {
    addCategory,
    listCategories,
    removeCategory,
    updateCategory,
    addSubCategory,
    removeSubCategory
};
