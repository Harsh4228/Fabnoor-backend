import express from "express";
import "dotenv/config";
import connectDB from "./config/mongodb.js";

// Global safety logs to surface any uncaught errors during limited checks
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
  // Do not exit immediately during debug; allow inspection
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});
import connectCloudinary from "./config/cloudinary.js";
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import reelRoutes from "./routes/reelRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import reviewRouter from "./routes/reviewRoute.js";
import cors from "cors";




const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
// DB & services
if (process.env.SKIP_DB === "true") {
  console.log("SKIP_DB=true - skipping DB and Cloudinary initialization (limited checks)");
} else {
  connectDB();
  connectCloudinary();
}

// Middleware
app.use(express.json());

// 🚀 HARD ALLOW EVERYTHING (for debugging)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/reels", reelRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/review", reviewRouter);

// Health
app.get("/", (req, res) => {
  res.send("API working");
});

const server = app.listen(port, () => {
  console.log("Server started on", port);
  // print address info for debug
  try {
    console.log('address:', server.address());
  } catch (err) {
    console.log('address info not available:', err && err.message);
  }

  // heartbeat to keep process in foreground and confirm it's alive
  setInterval(() => {
    console.log('heartbeat - server alive at', new Date().toISOString());
  }, 10000);
});
