import type { Request, Response } from "express";
import { getClerkUserId } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/asyncHandler";
import sessionService from "../services/session/session.services";

const VALID_SESSION_TYPES = ["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"];
const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const createSession = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { resumeId, jobDescriptionId, sessionType, difficulty, durationMinutes, noOfQuestions, totalQuestions, voice } = req.body;

    if (resumeId && typeof resumeId !== 'string') {
        return res.status(400).json({ error: "resumeId must be a string" });
    }
    if (jobDescriptionId && typeof jobDescriptionId !== 'string') {
        return res.status(400).json({ error: "jobDescriptionId must be a string" });
    }

    if (sessionType && (typeof sessionType !== 'string' || !VALID_SESSION_TYPES.includes(sessionType))) {
        return res.status(400).json({ error: `Invalid sessionType. Allowed values: ${VALID_SESSION_TYPES.join(", ")}` });
    }
    if (difficulty && (typeof difficulty !== 'string' || !VALID_DIFFICULTIES.includes(difficulty))) {
        return res.status(400).json({ error: `Invalid difficulty. Allowed values: ${VALID_DIFFICULTIES.join(", ")}` });
    }
    if (durationMinutes !== undefined && (typeof durationMinutes !== 'number' || durationMinutes < 5 || durationMinutes > 180)) {
        return res.status(400).json({ error: "durationMinutes must be a number between 5 and 180" });
    }

    const questionCount = totalQuestions ?? noOfQuestions;
    if (questionCount !== undefined && (typeof questionCount !== 'number' || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20)) {
        return res.status(400).json({ error: "totalQuestions must be an integer between 1 and 20" });
    }

    const session = await sessionService.createSession(clerkId, {
        resumeId,
        jobDescriptionId,
        sessionType,
        difficulty,
        durationMinutes,
        totalQuestions: questionCount,
        voice
    });

    res.status(201).json(session);
});

const submitTurn = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { sessionId } = req.params;
    const { questionId, answerText, codeSnippet, codeLanguage, voice } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "Session ID is required" });
    }
    if (!questionId || typeof questionId !== 'string') {
        return res.status(400).json({ error: "questionId is required" });
    }
    if (answerText !== undefined && typeof answerText !== 'string') {
        return res.status(400).json({ error: "answerText must be a string" });
    }
    if (codeSnippet !== undefined && typeof codeSnippet !== 'string') {
        return res.status(400).json({ error: "codeSnippet must be a string" });
    }
    if (codeLanguage !== undefined && typeof codeLanguage !== 'string') {
        return res.status(400).json({ error: "codeLanguage must be a string" });
    }
    if (voice !== undefined && typeof voice !== 'string') {
        return res.status(400).json({ error: "voice must be a string" });
    }

    const result = await sessionService.submitTurn({
        clerkId,
        sessionId,
        questionId,
        answerText,
        codeSnippet,
        codeLanguage,
        voice
    });

    res.status(200).json({
        message: "Turn evaluated successfully",
        data: result
    });
});

const getAllSessions = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const sessions = await sessionService.getAllSessions(clerkId, page, limit);
    res.status(200).json(sessions);
});

const getLatestSession = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await sessionService.getLatestSession(clerkId);
    if (!session) {
        return res.status(404).json({ error: "No interview sessions found" });
    }

    res.status(200).json(session);
});

const getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    const { id } = req.params;

    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Session ID is required" });
    }

    const session = await sessionService.getSessionById(clerkId, id);
    res.status(200).json(session);
});
export default {
    createSession,
    submitTurn,
    getAllSessions,
    getLatestSession,
    getSessionById
};
