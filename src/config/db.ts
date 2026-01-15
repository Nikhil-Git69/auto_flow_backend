import mongoose from "mongoose";

const MONGO_URL = "mongodb://localhost:27017/stt";

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("MongoDB connected 🚀");
  } catch (error) {
    console.error("MongoDB connection failed ❌", error);
    process.exit(1);
  }
};

export default connectDB;
