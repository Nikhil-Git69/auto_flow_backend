// backend/src/routes/auth.ts - FIXED VERSION
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import bcrypt from "bcryptjs"; // Add this import
import { notifyUserSignup } from '../services/webhookService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, collegeName, role, studentId, department, logoUrl } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email already registered"
      });
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
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
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
    notifyUserSignup({
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

  } catch (err: any) {
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
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user with password included
    const user = await User.findOne({ email }).select('+password');
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
    const isPasswordValid = await bcrypt.compare(password, user.password);
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
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        collegeName: user.collegeName
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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

  } catch (err: any) {
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
router.get("/me", async (req: Request, res: Response) => {
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
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

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

  } catch (err: any) {
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

export default router;