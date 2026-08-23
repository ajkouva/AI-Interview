import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = { count: number; resetAt: number };

/**
 * Lightweight per-process protection for expensive provider calls. Use a
 * shared store (Redis, etc.) when the API is deployed with multiple instances.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
    const entries = new Map<string, RateLimitEntry>();

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const key = `${req.ip}:${req.baseUrl}${req.path}`;
        const current = entries.get(key);

        if (!current || current.resetAt <= now) {
            entries.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        current.count += 1;
        if (current.count > max) {
            res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
            return res.status(429).json({ error: "Too many requests. Please try again later." });
        }

        next();
    };
}
