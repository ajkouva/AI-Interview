import type { Request, Response, NextFunction } from 'express';

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Global Error] at ${req.method} ${req.url}:`, err);

    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = "File too large. Maximum size is 5MB.";
    }

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};
