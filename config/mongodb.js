import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => {
      console.log("DB Connected");
    });

    let mongoUri = process.env.MONGODB_URI;

    // Support an in-memory MongoDB for local smoke tests when requested
    if (process.env.USE_IN_MEMORY_DB === "true" || mongoUri === "in-memory") {
      console.log("Starting in-memory MongoDB for tests...");
      // lazy import to keep package optional during install
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      // expose to process for later cleanup if needed
      process.__MONGOD = mongod;
      console.log("In-memory MongoDB running");
    }

    if (!mongoUri) {
      throw new Error("MONGODB_URI not provided");
    }

    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
