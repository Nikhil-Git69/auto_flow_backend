import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { updateProfile, uploadAvatar, uploadBanner, getProfile, deleteUser, changePassword } from '../controller/user.controller';
import { auth } from '../middleware/auth';

const router = Router();

// Ensure the directory exists
const uploadDir = path.join(__dirname, '../../uploads/avatars');
const bannerDir = path.join(__dirname, '../../uploads/banners');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(bannerDir)) fs.mkdirSync(bannerDir, { recursive: true });

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

// Configure storage for banners
const bannerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, bannerDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const userId = req.params.id || 'unknown';
        cb(null, `banner-${userId}-${uniqueSuffix}${ext}`);
    }
});

const uploadBannerMiddleware = multer({
    storage: bannerStorage,
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB for banners
});

// User routes
// We require authentication to update profile data
router.get('/:id', auth, getProfile);
router.patch('/:id', auth, updateProfile);
router.delete('/:id', auth, deleteUser);
router.post('/:id/avatar', auth, upload.single('avatar'), uploadAvatar);
router.post('/:id/banner', auth, uploadBannerMiddleware.single('banner'), uploadBanner);
router.post('/:id/change-password', auth, changePassword);

export default router;
