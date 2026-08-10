import { clerkMiddleware, requireAuth } from '@clerk/express';

export const clerkAuthMiddleware = clerkMiddleware();
export const protectedRoute = requireAuth();
