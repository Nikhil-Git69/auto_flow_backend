import { Request, Response } from 'express';
import User from '../models/User';

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
                    ...(studentId && { studentId })
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
