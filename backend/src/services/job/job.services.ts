import { prisma } from "../../config/db";

export interface JobInput {
    title: string;
    description: string;
}

async function createJob(clerkId: string, data: JobInput) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const job = await prisma.jobDescription.create({
        data: {
            title: data.title,
            description: data.description,
            userId: user.id
        }
    });
    return job;
}

async function getAllJobs(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    return await prisma.jobDescription.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" }
    });
}

async function getJobById(jobId: string, clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const job = await prisma.jobDescription.findFirst({
        where: { id: jobId, userId: user.id }
    });

    if (!job) {
        const error = new Error("Job description not found") as any;
        error.statusCode = 404;
        throw error;
    }

    return job;
}

async function deleteJob(jobId: string, clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const job = await prisma.jobDescription.findFirst({
        where: { id: jobId, userId: user.id }
    });

    if (!job) {
        const error = new Error("Job description not found") as any;
        error.statusCode = 404;
        throw error;
    }

    await prisma.jobDescription.delete({
        where: { id: job.id }
    });

    return { message: "Job description deleted successfully" };
}

export default {
    createJob,
    getAllJobs,
    getJobById,
    deleteJob
};