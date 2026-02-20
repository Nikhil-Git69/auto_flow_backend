"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/auth.ts - FIXED VERSION
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const Analysis_1 = __importDefault(require("../models/Analysis")); // Add Analysis import
const bcryptjs_1 = __importDefault(require("bcryptjs")); // Add this import
const webhookService_1 = require("../services/webhookService");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 */
router.post("/register", async (req, res) => {
    try {
        const { email, password, name, collegeName, role, studentId, department, logoUrl } = req.body;
        // Check if user already exists
        const existingUser = await User_1.default.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "Email already registered"
            });
        }
        // Hash password before saving
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create new user
        const user = new User_1.default({
            email,
            password: hashedPassword,
            name,
            collegeName,
            role: role || 'student',
            studentId,
            department,
            logoUrl,
            isActive: true
        });
        await user.save();
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        // Return user without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            name: user.name,
            collegeName: user.collegeName,
            role: user.role,
            studentId: user.studentId,
            department: user.department,
            logoUrl: user.logoUrl,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        // Send webhook notification for new user (non-blocking)
        (0, webhookService_1.notifyUserSignup)({
            userId: user._id.toString(),
            userName: user.name,
            userEmail: user.email,
            signupAt: new Date()
        }).catch(err => console.error('Webhook error:', err));
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user: userResponse,
                token
            }
        });
    }
    catch (err) {
        console.error("Registration error:", err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: "Validation error",
                details: err.errors
            });
        }
        res.status(500).json({
            success: false,
            error: "Registration failed",
            details: err.message
        });
    }
});
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user with password included
        const user = await User_1.default.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password"
            });
        }
        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                error: "Account is deactivated"
            });
        }
        // Verify password using bcrypt directly
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password"
            });
        }
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
            collegeName: user.collegeName
        }, JWT_SECRET, { expiresIn: '7d' });
        // Create user response without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            name: user.name,
            collegeName: user.collegeName,
            role: user.role,
            studentId: user.studentId,
            department: user.department,
            logoUrl: user.logoUrl,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        res.json({
            success: true,
            message: "Login successful",
            data: {
                user: userResponse,
                token
            }
        });
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            success: false,
            error: "Login failed",
            details: err.message
        });
    }
});
/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 */
router.get("/me", async (req, res) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Access denied. No token provided."
            });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await User_1.default.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "User not found"
            });
        }
        // Create user response without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            name: user.name,
            collegeName: user.collegeName,
            role: user.role,
            studentId: user.studentId,
            department: user.department,
            logoUrl: user.logoUrl,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        res.json({
            success: true,
            data: userResponse
        });
    }
    catch (err) {
        console.error("Get profile error:", err);
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: "Invalid token"
            });
        }
        res.status(500).json({
            success: false,
            error: "Failed to get profile",
            details: err.message
        });
    }
});
/**
 * @swagger
 * /auth/me:
 *   delete:
 *     summary: Delete current user account and all data
 */
router.delete("/me", async (req, res) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Access denied. No token provided."
            });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        // Find and delete user
        const user = await User_1.default.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }
        // Delete all analyses by this user
        await Analysis_1.default.deleteMany({ userId: userId });
        // Optional: Remove user from workspaces (if Workspace model was imported)
        // await Workspace.updateMany(
        //   { members: userId },
        //   { $pull: { members: userId } } 
        // );
        res.json({
            success: true,
            message: "Account and all associated data deleted successfully"
        });
    }
    catch (err) {
        console.error("Delete account error:", err);
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: "Invalid token"
            });
        }
        res.status(500).json({
            success: false,
            error: "Failed to delete account",
            details: err.message
        });
    }
});
exports.default = router;
