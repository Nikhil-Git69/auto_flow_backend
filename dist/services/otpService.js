"use strict";
/**
 * otpService.ts
 * In-memory OTP store for email verification.
 * OTPs are 6 digits and expire after 10 minutes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearOtp = exports.verifyOtp = exports.generateOtp = void 0;
// email → { otp, expiresAt }
const otpStore = new Map();
const OTP_EXPIRY_MINUTES = 10;
/**
 * Generates a 6-digit OTP for the given email and stores it.
 * Any previous OTP for the same email is overwritten.
 */
const generateOtp = (email) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    otpStore.set(email.toLowerCase(), { otp, expiresAt });
    return otp;
};
exports.generateOtp = generateOtp;
/**
 * Verifies an OTP for the given email.
 * Returns 'valid', 'expired', or 'invalid'.
 */
const verifyOtp = (email, otp) => {
    const entry = otpStore.get(email.toLowerCase());
    if (!entry) {
        return 'invalid';
    }
    if (new Date() > entry.expiresAt) {
        otpStore.delete(email.toLowerCase());
        return 'expired';
    }
    if (entry.otp !== otp.trim()) {
        return 'invalid';
    }
    return 'valid';
};
exports.verifyOtp = verifyOtp;
/**
 * Clears the OTP for the given email after successful verification.
 */
const clearOtp = (email) => {
    otpStore.delete(email.toLowerCase());
};
exports.clearOtp = clearOtp;
