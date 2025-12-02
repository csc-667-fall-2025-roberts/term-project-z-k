import { Request, Response, NextFunction } from "express";

declare module 'express-session' {
    interface SessionData {
        userId?: number;
        username?: string;
    }
}

export function auth(req: Request, res: Response, next: NextFunction) {
    const userId = req.session?.userId;
    
    if (!userId) {
        if (req.path.includes('/api/')) {
            return res.status(401).json({ 
                error: 'Authentication required' 
            });
        }
        return res.redirect('/signup');
    }
    
    next();
}