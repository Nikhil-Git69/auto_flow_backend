"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const auth = (req, res, next) => {
    try {
        const headerToken = req.header('Authorization')?.replace('Bearer ', '');
        const queryToken = req.query?.token;
        const token = headerToken || queryToken;
        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Access denied. No token provided."
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
};
exports.auth = auth;
