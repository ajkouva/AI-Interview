import { prisma } from "../../../config/db";
import { generateQuestionWithAI } from "./session.parser";
import type { SessionType, Difficulty } from "../../../../generated/prisma/enums";

export interface SessionDetailInput {
    resumeId: string;
    jobDescriptionId: string;
    sessionType?: string;
    difficulty?: string;
    durationMinutes?: number;
    noOfQuestions?: number;
}
async function createSession(
    clerkId: string,
    { resumeId, jobDescriptionId, sessionType = "MIXED", difficulty = "MEDIUM", durationMinutes = 15, noOfQuestions }: SessionDetailInput
) {
    // 1. Fetch User & atomically reserve a credit before any billable AI call.
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
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

    const creditLog = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.user.updateMany({
            where: { id: user.id, credits: { gte: 1 } },
            data: { credits: { decrement: 1 } }
        });

        if (updateResult.count === 0) {
            const error = new Error("Insufficient credits. Transaction aborted.") as any;
            error.statusCode = 402;
            throw error;
        }

        return tx.creditUsageLog.create({
            data: { userId: user.id, creditsUsed: 1, action: "CREATE_INTERVIEW_SESSION" }
        });
    });

    let createdSessionId: string;
    try {
        const resumeContent = (resume.content || resume.aiSummary || "Software Developer candidate").slice(0, 30_000);
        const generatedQuestions = await generateQuestionWithAI(
            resumeContent, jobDescription.description, difficulty, noOfQuestions, sessionType
        );

        const session = await prisma.$transaction(async (tx) => {
        const newSession = await tx.interviewSession.create({
            data: {
                userId: user.id,
                resumeId: resume.id,
                jobDescriptionId: jobDescription.id,
                status: "ACTIVE",
                sessionType: (sessionType as SessionType) || "MIXED",
                difficulty: (difficulty as Difficulty) || "MEDIUM",
                durationMinutes: durationMinutes || 15,
                startedAt: new Date()
            }
        });

        await tx.creditUsageLog.update({ where: { id: creditLog.id }, data: { sessionId: newSession.id } });

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

        createdSessionId = session.id;
    } catch (error) {
        await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { credits: { increment: 1 } } });
            await tx.creditUsageLog.create({ data: { userId: user.id, creditsUsed: -1, action: "REFUND_FAILED_SESSION_CREATION" } });
        });
        throw error;
    }

    return prisma.interviewSession.findUnique({
        where: { id: createdSessionId },
        include: {
            questions: { orderBy: { questionNo: "asc" } },
            jobDescription: { select: { title: true, description: true } },
            resume: { select: { title: true } }
        }
    });
}

export default {
    createSession
}
