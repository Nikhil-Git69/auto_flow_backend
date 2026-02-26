/**
 * otpService.ts
 * In-memory OTP store for email verification.
 * OTPs are 6 digits and expire after 10 minutes.
 */

interface OtpEntry {
    otp: string;
    expiresAt: Date;
}

// email → { otp, expiresAt }
const otpStore = new Map<string, OtpEntry>();

const OTP_EXPIRY_MINUTES = 10;

/**
 * Generates a 6-digit OTP for the given email and stores it.
 * Any previous OTP for the same email is overwritten.
 */
export const generateOtp = (email: string): string => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    otpStore.set(email.toLowerCase(), { otp, expiresAt });
    return otp;
};

/**
 * Verifies an OTP for the given email.
 * Returns 'valid', 'expired', or 'invalid'.
 */
export const verifyOtp = (email: string, otp: string): 'valid' | 'expired' | 'invalid' => {
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

/**
 * Clears the OTP for the given email after successful verification.
 */
export const clearOtp = (email: string): void => {
    otpStore.delete(email.toLowerCase());
};
