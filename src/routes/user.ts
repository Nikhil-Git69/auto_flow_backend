import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { updateProfile, uploadAvatar, getProfile } from '../controller/user.controller';
import { auth } from '../middleware/auth';

const router = Router();

// Ensure the directory exists
const uploadDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to backend/uploads/avatars
    },
    filename: function (req, file, cb) {
        // Create a unique filename: user-id-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const userId = req.params.id || 'unknown';
        cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// User routes
// We require authentication to update profile data
router.get('/:id', auth, getProfile);
router.patch('/:id', auth, updateProfile);
router.post('/:id/avatar', auth, upload.single('avatar'), uploadAvatar);

export default router;
