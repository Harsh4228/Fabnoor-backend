import express from "express";
import "dotenv/config";
import connectDB from "./config/mongodb.js";
import path from "path";
import { fileURLToPath } from "url";
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import reelRoutes from "./routes/reelRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import reviewRouter from "./routes/reviewRoute.js";
import globalDiscountRouter from "./routes/globalDiscountRoute.js";
import categoryRouter from "./routes/categoryRoute.js";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global safety logs to surface any uncaught errors during limited checks
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
  // Do not exit immediately during debug; allow inspection
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});




const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
// DB & services
if (process.env.SKIP_DB === "true") {
  console.log("SKIP_DB=true - skipping DB initialization (limited checks)");
} else {
  connectDB();
}

// Middleware
app.use(express.json());

// CORS headers must come BEFORE static files so browsers can load images/videos cross-origin
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve uploaded files (images & videos) as static assets
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/reels", reelRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/review", reviewRouter);
app.use("/api/discount", globalDiscountRouter);
app.use("/api/category", categoryRouter);

// Health
app.get("/", (req, res) => {
  res.send("API working");
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  
  // ✅ Keep-alive self-ping to prevent Render free-tier from sleeping.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  if (SELF_URL) {
    console.log(`Keep-alive active for: ${SELF_URL}`);
    const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
      try {
        const https = await import('https');
        https.default.get(SELF_URL, (res) => {
          console.log(`[keep-alive] Pinged ${SELF_URL} → ${res.statusCode}`);
        }).on('error', (err) => {
          console.warn('[keep-alive] Ping error:', err.message);
        });
      } catch (err) {
        console.warn('[keep-alive] Import error:', err.message);
      }
    }, PING_INTERVAL_MS);
  } else {
    console.log("RENDER_EXTERNAL_URL not set; skipping keep-alive ping.");
  }
});
