import express from "express";
import { getGlobalDiscount, updateGlobalDiscount } from "../controllers/globalDiscountController.js";
import adminAuth from "../middleware/adminAuth.js";
import authUser from "../middleware/auth.js";

const globalDiscountRouter = express.Router();

globalDiscountRouter.get("/get", getGlobalDiscount);
globalDiscountRouter.post("/update", authUser, adminAuth, updateGlobalDiscount);

export default globalDiscountRouter;
