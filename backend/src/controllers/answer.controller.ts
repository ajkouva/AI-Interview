import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { getClerkUserId } from "../middlewares/auth";
import answerService from "../services/answer/answer.services";

const submitSingleAnswer = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        const error = new Error("Unauthorized") as any;
        error.statusCode = 401;
        throw error;
    }

    const sessionId = req.params.sessionId || req.body.sessionId;
    const questionId = req.params.questionId || req.body.questionId;
    const { answerText, codeSnippet, codeLanguage } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
        const error = new Error("sessionId is required in URL or request body") as any;
        error.statusCode = 400;
        throw error;
    }
    if (!questionId || typeof questionId !== "string") {
        const error = new Error("questionId is required in request body or URL") as any;
        error.statusCode = 400;
        throw error;
    }
    if (answerText !== undefined && typeof answerText !== "string") {
        const error = new Error("answerText must be a string") as any;
        error.statusCode = 400;
        throw error;
    }
    if (codeSnippet !== undefined && typeof codeSnippet !== "string") {
        const error = new Error("codeSnippet must be a string") as any;
        error.statusCode = 400;
        throw error;
    }
    if (codeLanguage !== undefined && typeof codeLanguage !== "string") {
        const error = new Error("codeLanguage must be a string") as any;
        error.statusCode = 400;
        throw error;
    }

    // Enforce reasonable length limits to protect prompt token budgets
    if (answerText && answerText.length > 10000) {
        const error = new Error("answerText exceeds maximum allowed length of 10,000 characters") as any;
        error.statusCode = 400;
        throw error;
    }
    if (codeSnippet && codeSnippet.length > 20000) {
        const error = new Error("codeSnippet exceeds maximum allowed length of 20,000 characters") as any;
        error.statusCode = 400;
        throw error;
    }
    if (codeLanguage && codeLanguage.length > 50) {
        const error = new Error("codeLanguage exceeds maximum allowed length of 50 characters") as any;
        error.statusCode = 400;
        throw error;
    }

    if (!answerText && !codeSnippet) {
        const error = new Error("Please provide either answerText or codeSnippet") as any;
        error.statusCode = 400;
        throw error;
    }

    const result = await answerService.submitSingleAnswer({
        clerkId,
        sessionId,
        questionId,
        answerText,
        codeSnippet,
        codeLanguage
    });

    res.status(200).json({
        message: "Answer saved successfully",
        data: {
            answerId: result.answer.id,
            questionId: result.answer.questionId,
            sessionId: result.answer.sessionId,
            answerText: result.answer.answerText,
            codeSnippet: result.answer.codeSnippet,
            codeLanguage: result.answer.codeLanguage,
            savedAt: result.answer.answerAt
        }
    });

});

export default {
    submitSingleAnswer
};