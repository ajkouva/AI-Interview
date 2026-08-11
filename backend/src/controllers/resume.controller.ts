import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../middlewares/asyncHandler";
import resumeService from "../services/resume.services";

const uploadResume = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getAuth(req).userId;
    const file = req.file;
    const { title } = req.body;

    if (!clerkId)
        return res.status(401).json({ error: "Unauthorized" });

    if (!file)
        return res.status(400).json({ error: "No file uploaded" });

    if (!title || typeof title !== 'string')
        return res.status(400).json({ error: "Resume title must be a string" });

    const resume = await resumeService.uploadResume(clerkId, title, file);

    res.status(201).json(resume);
});

const getAllResumes = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getAuth(req).userId;

    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const resumes = await resumeService.getAllResumes(clerkId);

    res.status(200).json(resumes);
});

export default { uploadResume, getAllResumes };
