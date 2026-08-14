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

    const { resumeId, jobDescriptionId, sessionType, difficulty, durationMinutes, noOfQuestions } = req.body;

    if (!resumeId || typeof resumeId !== 'string') {
        return res.status(400).json({ error: "resumeId is required" });
    }
    if (!jobDescriptionId || typeof jobDescriptionId !== 'string') {
        return res.status(400).json({ error: "jobDescriptionId is required" });
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
    if (noOfQuestions !== undefined && (typeof noOfQuestions !== 'number' || noOfQuestions < 1 || noOfQuestions > 20)) {
        return res.status(400).json({ error: "noOfQuestions must be a number between 1 and 20" });
    }

    const session = await sessionService.createSession(clerkId, {
        resumeId,
        jobDescriptionId,
        sessionType,
        difficulty,
        durationMinutes,
        noOfQuestions
    });

    res.status(201).json(session);
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
    getLatestSession,
    getSessionById
};
