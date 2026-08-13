import jobService from "../services/job.services";
import type { Request, Response } from "express";
import { getClerkUserId } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/asyncHandler";

const createJob = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { title, description } = req.body;
    if (!title || typeof title !== 'string' || !description || typeof description !== 'string') {
        return res.status(400).json({ error: "Invalid or missing title or description" });
    }
    const job = await jobService.createJob(clerkId, { title, description });
    res.status(201).json(job);
});

const getAllJobs = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const jobs = await jobService.getAllJobs(clerkId);
    res.status(200).json(jobs);
});

const getJobById = asyncHandler(async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const jobId = req.params.id as string;
    const job = await jobService.getJobById(jobId, clerkId);

    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }

    res.status(200).json(job);
});

export default {
    createJob,
    getAllJobs,
    getJobById
};
