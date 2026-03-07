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
import globalDiscountRouter from "./routes/globalDiscountRoute.js";
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
app.use("/api/discount", globalDiscountRouter);

// Health
app.get("/", (req, res) => {
  res.send("API working");
});

const server = app.listen(port, () => {
  console.log("Server started on", port);
  try {
    console.log('address:', server.address());
  } catch (err) {
    console.log('address info not available:', err && err.message);
  }

  // ✅ Keep-alive self-ping to prevent Render free-tier from sleeping.
  // Render automatically sets RENDER_EXTERNAL_URL for deployed services.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15)

  setInterval(async () => {
    try {
      const https = await import('https');
      const http = await import('http');
      const lib = SELF_URL.startsWith('https') ? https.default : http.default;
      lib.get(SELF_URL, (res) => {
        console.log(`[keep-alive] Pinged ${SELF_URL} → ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn('[keep-alive] Ping error:', err.message);
      });
    } catch (err) {
      console.warn('[keep-alive] Import error:', err.message);
    }
  }, PING_INTERVAL_MS);
});
