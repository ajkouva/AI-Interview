import type { NextFunction, Request, Response } from "express";
import { getClerkUserId } from "./auth";

type RateLimitEntry = { count: number; resetAt: number };

/**
 * Lightweight per-process protection for expensive provider calls. Use a
 * shared store (Redis, etc.) when the API is deployed with multiple instances.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
    const entries = new Map<string, RateLimitEntry>();

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        // Use static route path (e.g. /:sessionId/submit) instead of dynamic param values to prevent bypass and key bloat
        const routePath = req.route?.path || req.path;
        const identifier = getClerkUserId(req) || req.ip || "unknown";
        const key = `${identifier}:${req.baseUrl}${routePath}`;

        // Periodically evict expired entries if Map grows large to prevent unbounded memory growth
        if (entries.size > 2000) {
            for (const [k, v] of entries.entries()) {
                if (v.resetAt <= now) entries.delete(k);
            }
        }

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
