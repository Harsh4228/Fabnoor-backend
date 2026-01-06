import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import userRouter from './routes/userRoute.js'
import productRouter from './routes/productRoute.js'
import cartRouter from './routes/cartRoute.js'
import orderRouter from './routes/orderRoute.js'
import reelRoutes from "./routes/reelRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";


// App Config
const app = express()
const port = process.env.PORT || 5000

// DB & Services
connectDB()
connectCloudinary()

// Middlewares
app.use(express.json())
app.use(cors())

// API Routes
app.use('/api/user', userRouter)
app.use('/api/product', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/order', orderRouter)
app.use('/api/reels', reelRoutes)
app.use("/api/wishlist", wishlistRoutes);

// Health check
app.get('/', (req, res) => {
  res.send("API working")
})

app.listen(port, () =>
  console.log('Server started on PORT : ' + port)
)
