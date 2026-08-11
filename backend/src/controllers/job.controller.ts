import jobService from "../services/job.services";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";

const createJob = async (req: Request, res: Response) => {
    try {
        const clerkId = getAuth(req).userId;
        if(!clerkId){
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { title, description } = req.body;
        const job = await jobService.createJob(clerkId, {title, description});
        res.status(201).json(job);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

const getAllJobs = async (req: Request, res: Response) => {
    try {
        const clerkId = getAuth(req).userId;
        const jobs = await jobService.getAllJobs(clerkId!);
        res.status(200).json(jobs);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

const getJobById = async (req: Request, res: Response) => {
    try {
        const clerkId = getAuth(req).userId;
        const jobId = req.params.id as string;
        const job = await jobService.getJobById(jobId, clerkId!);
        res.status(200).json(job);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

export default {
    createJob,
    getAllJobs,
    getJobById
}
