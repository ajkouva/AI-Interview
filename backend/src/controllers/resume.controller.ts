import type { Request, Response } from "express";
import { getClerkUserId } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/asyncHandler";
import resumeService from "../services/resume/resume.services";

const uploadResume = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    const file = req.file;
    const { title } = req.body;

    if (!clerkId)
        return res.status(401).json({ error: "Unauthorized" });

    if (!file)
        return res.status(400).json({ error: "No file uploaded" });

    if (title && typeof title !== 'string')
        return res.status(400).json({ error: "Resume title must be a string" });

    const resume = await resumeService.uploadResume(clerkId, title, file);

    res.status(201).json(resume);
});

const getAllResumes = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);

    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const resumes = await resumeService.getAllResumes(clerkId);

    res.status(200).json(resumes);
});

const getResumeById = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    const { id } = req.params;

    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    if (!id || typeof id !== 'string') return res.status(400).json({ error: "Resume ID is required" });

    const resume = await resumeService.getResumeById(clerkId, id);

    res.status(200).json(resume);
});

const deleteResume = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    const { id } = req.params;

    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });
    if (!id || typeof id !== 'string') return res.status(400).json({ error: "Resume ID is required" });

    const result = await resumeService.deleteResume(clerkId, id);

    res.status(200).json(result);
});

export default { uploadResume, getAllResumes, getResumeById, deleteResume };
