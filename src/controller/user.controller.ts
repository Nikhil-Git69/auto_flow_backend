import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, collegeName, department, studentId } = req.body;

        // Avoid updating sensitive fields like password or role through this endpoint
        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                $set: {
                    ...(name && { name }),
                    ...(collegeName && { collegeName }),
                    ...(department && { department }),
                    ...(studentId && { studentId }),
                    ...(req.body.hasOwnProperty('bannerUrl') && { bannerUrl: req.body.bannerUrl })
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                collegeName: updatedUser.collegeName,
                department: updatedUser.department,
                logoUrl: updatedUser.logoUrl,
                bannerUrl: updatedUser.bannerUrl,
                studentId: updatedUser.studentId,
                role: updatedUser.role
            }
        });

    } catch (error: any) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

export const uploadAvatar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }

        // Ensure it's an image
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ success: false, error: 'File must be an image' });
        }

        // Create the public URL for the image
        // Note: Assuming server runs on localhost:5000 in dev, or a proper domain in prod.
        // In a real production app, we might just store the relative path and let the frontend figure it out,
        // or store the full URL if using an S3 bucket. Here we use relative path.
        const logoUrl = `/uploads/avatars/${req.file.filename}`;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { logoUrl } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Avatar updated successfully',
            data: {
                logoUrl: updatedUser.logoUrl
            }
        });

    } catch (error: any) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

export const uploadBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided' });
        }

        const bannerUrl = `/uploads/banners/${req.file.filename}`;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { bannerUrl } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Banner updated successfully',
            data: {
                bannerUrl: updatedUser.bannerUrl
            }
        });

    } catch (error: any) {
        console.error('Upload banner error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                collegeName: user.collegeName,
                department: user.department,
                logoUrl: user.logoUrl,
                bannerUrl: user.bannerUrl,
                studentId: user.studentId,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error: any) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
}

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Delete the user from the database
        await User.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'User account and associated data deleted successfully'
        });

    } catch (error: any) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
        }

        const user = await User.findById(id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Incorrect current password' });
        }

        // Prevent use of same password
        if (currentPassword === newPassword) {
            return res.status(400).json({ success: false, error: 'New password cannot be the same as your current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error: any) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};
