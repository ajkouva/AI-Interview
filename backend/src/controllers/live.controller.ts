import { createLiveInterviewSession } from "../services/interview/interview.services";
import type { Request, Response } from "express";
import { getClerkUserId } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/asyncHandler";


const VALID_SESSION_TYPES = ["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"];
const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];


const createLiveSession = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { resumeId, jobDescriptionId, sessionType, difficulty } = req.body;

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

    const result = await createLiveInterviewSession(clerkId, {
        resumeId,
        jobDescriptionId,
        sessionType,
        difficulty,
    });

    res.status(201).json({
        message: "Live interview session created successfully",
        session: result.session,
        wsUrl: result.wsUrl,
    });
});

export default {
    createLiveSession
};  
