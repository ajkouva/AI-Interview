import { getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

export const getClerkUserId = (req: Request): string | null => {
    // 1. Explicit local development bypass (disabled in production or if ALLOW_DEV_AUTH_BYPASS=false)
    const devUserId = req.headers['x-clerk-user-id'] as string;
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS !== 'false' && devUserId) {
        return devUserId;
    }
    // 2. Standard Clerk Auth check
    return getAuth(req).userId || null;
};

export const protectedRoute = (req: Request, res: Response, next: NextFunction) => {
    const userId = getClerkUserId(req);
    if (!userId) {
        return res.status(401).json({
            error: "Unauthorized: Session token missing, invalid, or expired.",
            tip: "In Postman, add header 'x-clerk-user-id: user_3HgzSaYMvOmi55WZYTLemUiVfgo' to test without expiring tokens!"
        });
    }
    next();
};
