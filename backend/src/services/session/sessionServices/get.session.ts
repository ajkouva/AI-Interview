import { prisma } from "../../../config/db";

async function getAllSessions(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    return await prisma.interviewSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
            jobDescription: {
                select: {
                    id: true,
                    title: true,
                    description: true
                }
            },
            resume: {
                select: {
                    id: true,
                    title: true,
                    aiSummary: true
                }
            },
            questions: {
                orderBy: { questionNo: "asc" },
                include: {
                    answer: true
                }
            }
        }
    });
}

async function getLatestSession(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    return await prisma.interviewSession.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
            jobDescription: {
                select: {
                    id: true,
                    title: true,
                    description: true
                }
            },
            resume: {
                select: {
                    id: true,
                    title: true,
                    aiSummary: true
                }
            },
            questions: {
                orderBy: { questionNo: "asc" },
                include: {
                    answer: true
                }
            }
        }
    });
}

async function getSessionById(clerkId: string, sessionId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: {
            jobDescription: {
                select: {
                    id: true,
                    title: true,
                    description: true
                }
            },
            resume: {
                select: {
                    id: true,
                    title: true,
                    aiSummary: true
                }
            },
            questions: {
                orderBy: { questionNo: "asc" },
                include: {
                    answer: true
                }
            }
        }
    });

    if (!session) {
        const error = new Error("Interview session not found") as any;
        error.statusCode = 404;
        throw error;
    }

    return session;
}

export default {
    getAllSessions,
    getLatestSession,
    getSessionById
}