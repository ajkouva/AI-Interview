import type { Request, Response, NextFunction } from 'express';

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Global Error] at ${req.method} ${req.url}:`, err);

    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Handle AI Timeout & Service Availability Errors
    if (err.name === 'AITimeoutError' || err.code === 'AI_TIMEOUT_ERROR' || statusCode === 504) {
        statusCode = 504;
        message = err.message || "AI model service timed out. Please try again.";
    }

    // Handle Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = "File too large. Maximum size allowed is 5MB.";
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message?.includes("Only PDF files are allowed")) {
        statusCode = 400;
        message = err.message || "Invalid file upload.";
    }

    // Handle Prisma invalid UUID / input error (P2023)
    if (err.code === 'P2023') {
        statusCode = 400;
        message = "Invalid identifier format provided.";
    }

    // Handle PDF / AI parsing errors
    if (err.message?.includes("Failed to extract text from PDF")) {
        statusCode = 400;
        message = "The uploaded file could not be parsed as a valid PDF.";
    }

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};
