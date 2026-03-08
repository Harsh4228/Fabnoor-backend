import express from "express";
import { 
    addCategory, 
    listCategories, 
    removeCategory, 
    updateCategory, 
    addSubCategory, 
    removeSubCategory 
} from "../controllers/categoryController.js";
import adminAuth from "../middleware/adminAuth.js";

const categoryRouter = express.Router();

categoryRouter.get("/list", listCategories);
categoryRouter.post("/add", adminAuth, addCategory);
categoryRouter.post("/remove", adminAuth, removeCategory);
categoryRouter.post("/update", adminAuth, updateCategory);
categoryRouter.post("/add-subcategory", adminAuth, addSubCategory);
categoryRouter.post("/remove-subcategory", adminAuth, removeSubCategory);

export default categoryRouter;
