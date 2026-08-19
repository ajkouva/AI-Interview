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
        const error = new Error("questionId is required in request body") as any;
        error.statusCode = 400;
        throw error;
    }
    if (!answerText && !codeSnippet) {
        return res.status(400).json({ error: "Please provide either answerText or codeSnippet" });
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