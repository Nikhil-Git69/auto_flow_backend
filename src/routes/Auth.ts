// backend/src/routes/auth.ts
import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import bcrypt from "bcryptjs";
import { notifyEmailVerification, notifyWelcome, notifyPasswordReset } from '../services/webhookService';
import { generateOtp, verifyOtp, clearOtp } from '../services/otpService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Helper to build user response object
const buildUserResponse = (user: any) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  collegeName: user.collegeName,
  role: user.role,
  studentId: user.studentId,
  department: user.department,
  logoUrl: user.logoUrl,
  bannerUrl: user.bannerUrl,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

/**
 * POST /auth/register
 * Creates account, generates OTP, sends verification email.
 * Does NOT return a token — user must verify email first.
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name, collegeName, role, studentId, department, logoUrl } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but never verified, re-send OTP using same flow as resend-otp
      if (!existingUser.isEmailVerified) {
        const otp = generateOtp(email);
        try {
          await notifyEmailVerification({
            userId: existingUser._id.toString(),
            userName: existingUser.name,
            userEmail: existingUser.email,
            otp,
            expiresInMinutes: 10
          });
        } catch (webhookErr) {
          console.error('Verification webhook error (re-register):', webhookErr);
        }
        return res.status(200).json({
          success: true,
          requiresVerification: true,
          email,
          message: "Account exists but email not verified. A new OTP has been sent."
        });
      }
      return res.status(409).json({ success: false, error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      name,
      collegeName,
      role: role || 'student',
      studentId,
      department,
      logoUrl,
      isActive: false,           // inactive until verified
      isEmailVerified: false
    });

    await user.save();

    // Generate OTP and send verification email — awaited to guarantee delivery (same as resend-otp)
    const otp = generateOtp(email);
    try {
      await notifyEmailVerification({
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email,
        otp,
        expiresInMinutes: 10
      });
    } catch (webhookErr) {
      console.error('Verification webhook error (register):', webhookErr);
      // Don't fail registration if webhook fails — user can resend OTP
    }

    res.status(201).json({
      success: true,
      requiresVerification: true,
      email,
      message: "Account created. Please check your email for the verification OTP."
    });

  } catch (err: any) {
    console.error("Registration error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: "Validation error", details: err.errors });
    }
    res.status(500).json({ success: false, error: "Registration failed", details: err.message });
  }
});

/**
 * POST /auth/verify-email
 * Accepts { email, otp }. On success activates account and returns JWT + welcome email.
 */
router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "Email and OTP are required" });
    }

    const result = verifyOtp(email, otp);

    if (result === 'expired') {
      return res.status(400).json({ success: false, error: "OTP has expired. Please request a new one.", code: 'OTP_EXPIRED' });
    }
    if (result === 'invalid') {
      return res.status(400).json({ success: false, error: "Invalid OTP. Please try again.", code: 'OTP_INVALID' });
    }

    // OTP is valid — activate the account
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.isEmailVerified = true;
    user.isActive = true;
    await user.save();
    clearOtp(email);

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email (non-blocking)
    notifyWelcome({
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      signupAt: new Date()
    }).catch(err => console.error('Welcome webhook error:', err));



    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      data: {
        user: buildUserResponse(user),
        token
      }
    });

  } catch (err: any) {
    console.error("Verify email error:", err);
    res.status(500).json({ success: false, error: "Verification failed", details: err.message });
  }
});

/**
 * POST /auth/resend-otp
 * Accepts { email }. Regenerates and resends OTP.
 */
router.post("/resend-otp", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, error: "Email already verified" });
    }

    const otp = generateOtp(email);
    try {
      await notifyEmailVerification({
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email,
        otp,
        expiresInMinutes: 10
      });
    } catch (webhookErr) {
      console.error('Resend OTP webhook error:', webhookErr);
    }

    res.status(200).json({ success: true, message: "A new OTP has been sent to your email." });

  } catch (err: any) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, error: "Failed to resend OTP", details: err.message });
  }
});

/**
 * POST /auth/login
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    // Block unverified users — but send them a fresh OTP first
    if (!user.isEmailVerified) {
      const otp = generateOtp(email);
      try {
        await notifyEmailVerification({
          userId: user._id.toString(),
          userName: user.name,
          userEmail: user.email,
          otp,
          expiresInMinutes: 10
        });
      } catch (webhookErr) {
        console.error('Verification webhook error (login):', webhookErr);
      }
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email,
        error: "Please verify your email before logging in. A new code has been sent."
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, error: "Account is deactivated" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, name: user.name, collegeName: user.collegeName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: { user: buildUserResponse(user), token }
    });

  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed", details: err.message });
  }
});

/**
 * GET /auth/me
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, data: buildUserResponse(user) });

  } catch (err: any) {
    console.error("Get profile error:", err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
    res.status(500).json({ success: false, error: "Failed to get profile", details: err.message });
  }
});

/**
 * DELETE /auth/me
 */
router.delete("/me", async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Find and delete user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, data: buildUserResponse(user) });

  } catch (err: any) {
    console.error("Get profile error:", err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }
    res.status(500).json({ success: false, error: "Failed to get profile", details: err.message });
  }
});

/**
 * POST /auth/forgot-password
 * Generates an OTP for password reset and sends it via email.
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const user = await User.findOne({ email });

    // Only send the webhook if the user actually exists
    if (user) {
      const otp = generateOtp(email);
      try {
        await notifyPasswordReset({
          userId: user._id.toString(),
          userName: user.name,
          userEmail: user.email,
          otp,
          expiresInMinutes: 10
        });
      } catch (webhookErr) {
        console.error('Password reset OTP webhook error:', webhookErr);
      }
    }

    // Always return success to avoid user enumeration (Information Leakage)
    res.status(200).json({
      success: true,
      message: "If an account exists with this email, a reset code has been sent to your email."
    });

  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, error: "Failed to process request", details: err.message });
  }
});

/**
 * POST /auth/verify-reset-otp
 * Verifies if the provided OTP is valid for the given email.
 */
router.post("/verify-reset-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: "Email and OTP are required" });

    const verificationResult = verifyOtp(email, otp);
    if (verificationResult === 'valid') {
      return res.status(200).json({ success: true, message: "OTP is valid" });
    } else {
      return res.status(400).json({
        success: false,
        error: verificationResult === 'expired' ? "OTP has expired" : "Invalid OTP code",
        code: verificationResult === 'expired' ? 'OTP_EXPIRED' : 'OTP_INVALID'
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to verify OTP" });
  }
});

/**
 * POST /auth/reset-password
 * Verifies OTP and updates user's password.
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: "Email, OTP and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const verificationResult = verifyOtp(email, otp);

    if (verificationResult === 'expired') {
      return res.status(400).json({ success: false, error: "OTP has expired. Please request a new one.", code: 'OTP_EXPIRED' });
    }
    if (verificationResult === 'invalid') {
      return res.status(400).json({ success: false, error: "Invalid OTP. Please try again.", code: 'OTP_INVALID' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Prevent using the same password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ success: false, error: "New password cannot be the same as your current password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Clear OTP after successful reset
    clearOtp(email);

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password."
    });

  } catch (err: any) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, error: "Failed to reset password", details: err.message });
  }
});

export default router;