import { prisma } from "../../config/db";

export interface JobInput {
    title: string,
    description: string
}

async function createJob(clerkId: string, data: JobInput) {
    const user = await prisma.user.findUnique({
        where: {
            clerkId: clerkId
        }
    })

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
    })
    return job;
}

async function getAllJobs(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: {
            clerkId: clerkId
        }
    })

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    return await prisma.jobDescription.findMany({
        where: {
            userId: user.id
        },
        orderBy: {
            createdAt: "desc"
        }
    })
}

async function getJobById(jobId: string, clerkId: string) {
    const user = await prisma.user.findUnique({
        where: {
            clerkId: clerkId
        }
    })

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const job = await prisma.jobDescription.findUnique({
        where: {
            id: jobId
        }
    })

    if (!job || job.userId !== user.id) {
        return null;
    }

    return job;
}

export default {
    createJob,
    getAllJobs,
    getJobById
}