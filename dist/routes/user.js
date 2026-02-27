"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const user_controller_1 = require("../controller/user.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Ensure the directory exists
const uploadDir = path_1.default.join(__dirname, '../../uploads/avatars');
const bannerDir = path_1.default.join(__dirname, '../../uploads/banners');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
if (!fs_1.default.existsSync(bannerDir))
    fs_1.default.mkdirSync(bannerDir, { recursive: true });
// Configure multer for disk storage
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to backend/uploads/avatars
    },
    filename: function (req, file, cb) {
        // Create a unique filename: user-id-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        const userId = req.params.id || 'unknown';
        cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only images are allowed'));
        }
    }
});
// Configure storage for banners
const bannerStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, bannerDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        const userId = req.params.id || 'unknown';
        cb(null, `banner-${userId}-${uniqueSuffix}${ext}`);
    }
});
const uploadBannerMiddleware = (0, multer_1.default)({
    storage: bannerStorage,
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB for banners
});
// User routes
// We require authentication to update profile data
router.get('/:id', auth_1.auth, user_controller_1.getProfile);
router.patch('/:id', auth_1.auth, user_controller_1.updateProfile);
router.delete('/:id', auth_1.auth, user_controller_1.deleteUser);
router.post('/:id/avatar', auth_1.auth, upload.single('avatar'), user_controller_1.uploadAvatar);
router.post('/:id/banner', auth_1.auth, uploadBannerMiddleware.single('banner'), user_controller_1.uploadBanner);
router.post('/:id/change-password', auth_1.auth, user_controller_1.changePassword);
exports.default = router;
