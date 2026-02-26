import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface AuthRequest extends Request {
    user?: any;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const headerToken = req.header('Authorization')?.replace('Bearer ', '');
        const queryToken = req.query?.token as string | undefined;
        const token = headerToken || queryToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Access denied. No token provided."
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
};
