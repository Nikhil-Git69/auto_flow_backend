"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const MONGO_URL = process.env.MONGO_URI;
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(MONGO_URL);
        console.log("MongoDB connected 🚀");
    }
    catch (error) {
        console.error("MongoDB connection failed ❌", error);
        process.exit(1);
    }
};
exports.default = connectDB;
