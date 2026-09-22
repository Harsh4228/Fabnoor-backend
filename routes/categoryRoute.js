import express from "express";
import { 
    addCategory, 
    listCategories, 
    removeCategory, 
    updateCategory, 
    addSubCategory, 
    removeSubCategory,
    listDeletedCategories,
    restoreCategory,
    permanentlyDeleteCategory,
} from "../controllers/categoryController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const categoryRouter = express.Router();

categoryRouter.get("/list", listCategories);
categoryRouter.post("/add", authUser, adminAuth, addCategory);
categoryRouter.post("/remove", authUser, adminAuth, removeCategory);
categoryRouter.post("/update", authUser, adminAuth, updateCategory);
categoryRouter.post("/add-subcategory", authUser, adminAuth, addSubCategory);
categoryRouter.post("/remove-subcategory", authUser, adminAuth, removeSubCategory);

// Trash / soft-delete management
categoryRouter.get("/trash/list", authUser, adminAuth, listDeletedCategories);
categoryRouter.post("/trash/restore", authUser, adminAuth, restoreCategory);
categoryRouter.post("/trash/delete", authUser, adminAuth, permanentlyDeleteCategory);

export default categoryRouter;
