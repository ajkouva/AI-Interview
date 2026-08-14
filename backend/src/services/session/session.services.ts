import { prisma } from "../../config/db";
import { generateQuestionWithAI } from "./session.parser";
import type { SessionType, Difficulty } from "../../../generated/prisma/enums";

export interface SessionDetailInput {
    resumeId: string;
    jobDescriptionId: string;
    sessionType?: string;
    difficulty?: string;
    durationMinutes?: number;
    noOfQuestions?: number;
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
                orderBy: { questionNo: "asc" }
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
                orderBy: { questionNo: "asc" }
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

async function createSession(
    clerkId: string,
    { resumeId, jobDescriptionId, sessionType = "MIXED", difficulty = "MEDIUM", durationMinutes = 30, noOfQuestions }: SessionDetailInput
) {
    // 1. Fetch User & Guard initial credit state
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    if (user.credits < 1) {
        const error = new Error("Insufficient credits. Please upgrade your plan to start a new interview session.") as any;
        error.statusCode = 402;
        throw error;
    }

    // 2. Fetch Resume & Job Description Context
    const resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId: user.id }
    });

    const jobDescription = await prisma.jobDescription.findFirst({
        where: { id: jobDescriptionId, userId: user.id }
    });

    if (!resume || !jobDescription) {
        const error = new Error("Resume or Job Description not found") as any;
        error.statusCode = 404;
        throw error;
    }

    // 3. Generate Questions using AI
    const resumeContent = resume.content || resume.aiSummary || "Software Developer candidate";
    const generatedQuestions = await generateQuestionWithAI(
        resumeContent,
        jobDescription.description,
        difficulty,
        noOfQuestions
    );

    // 4. Atomic Database Transaction: Deduct Credit (Conditional Guard against TOCTOU race), Log Usage & Create Session
    const session = await prisma.$transaction(async (tx) => {
        // A. Conditional Credit Deduction (protects against concurrent requests)
        const updateResult = await tx.user.updateMany({
            where: { id: user.id, credits: { gte: 1 } },
            data: { credits: { decrement: 1 } }
        });

        if (updateResult.count === 0) {
            const error = new Error("Insufficient credits. Transaction aborted.") as any;
            error.statusCode = 402;
            throw error;
        }

        // B. Create Interview Session
        const newSession = await tx.interviewSession.create({
            data: {
                userId: user.id,
                resumeId: resume.id,
                jobDescriptionId: jobDescription.id,
                status: "ACTIVE",
                sessionType: (sessionType as SessionType) || "MIXED",
                difficulty: (difficulty as Difficulty) || "MEDIUM",
                durationMinutes: durationMinutes || 30,
                startedAt: new Date()
            }
        });

        // C. Create Credit Usage Log
        await tx.creditUsageLog.create({
            data: {
                userId: user.id,
                sessionId: newSession.id,
                creditsUsed: 1,
                action: "CREATE_INTERVIEW_SESSION"
            }
        });

        // D. Create Generated Questions in Database
        await tx.question.createMany({
            data: generatedQuestions.map((q) => ({
                sessionId: newSession.id,
                questionNo: q.questionNo,
                questionText: q.questionText,
                questionType: q.questionType as SessionType
            }))
        });

        return newSession;
    });

    // 5. Return Complete Session with Questions
    return await prisma.interviewSession.findUnique({
        where: { id: session.id },
        include: {
            questions: { orderBy: { questionNo: "asc" } },
            jobDescription: { select: { title: true, description: true } },
            resume: { select: { title: true } }
        }
    });
}

export default {
    getLatestSession,
    getSessionById,
    createSession
};