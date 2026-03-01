import express from 'express';
import { loginUser, registerUser, adminLogin, getProfile, updateProfile, getAllUsers, getUserFullDetails, deleteUser, requestResetOtp, resetPassword } from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
const router = express.Router()

const userRouter = express.Router();

router.get("/", (req, res) => {
  res.json({ status: "user route working" })
})

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.post('/admin', adminLogin)

userRouter.post('/request-reset-otp', requestResetOtp);
userRouter.post('/reset-password', resetPassword);

userRouter.get("/profile", authUser, getProfile);
userRouter.post("/profile", authUser, updateProfile);

// Admin Routes
userRouter.get("/admin/users", authUser, adminAuth, getAllUsers);
userRouter.get("/admin/user/:id", authUser, adminAuth, getUserFullDetails);
userRouter.post("/admin/delete-user", authUser, adminAuth, deleteUser);

export default userRouter;