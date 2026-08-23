import { prisma } from "../../config/db";
import type { LiveInterviewContext } from "./interview.types";

export async function getLiveSessionContext(
    sessionId: string,
    clerkId: string
): Promise<LiveInterviewContext> {
    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },

        include: {
            user: true,
            resume: true,
            jobDescription: true,
        },
    });

    if (!session) {
        const error = new Error("Interview session not found") as any;
        error.statusCode = 404;
        throw error;
    }

    if (session.user.clerkId !== clerkId) {
        const error = new Error("Unauthorized access to this interview session") as any;
        error.statusCode = 403;
        throw error;
    }

    if (session.status === "COMPLETED") {
        const error = new Error("This interview session has already been completed") as any;
        error.statusCode = 400;
        throw error;
    }

    const candidateName = session.user.fullName || 'Candidate';
    const targetRole = session.jobDescription?.title || session.user.targetRole || "Software Engineer";

    return {
        sessionId: session.id,
        candidateName,
        targetRole,
        experienceLevel: session.user.experienceLevel || undefined,
        resumeSummary: session.resume?.aiSummary || undefined,
        jobTitle: session.jobDescription?.title || undefined,
        jobDescription: session.jobDescription?.description || undefined,
        difficulty: session.difficulty,
        sessionType: session.sessionType,
        voiceName: "Aoede",
    };
}

export async function markLiveSessionActive(sessionId: string): Promise<void> {
    await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
            status: "ACTIVE",
            startedAt: new Date(),
        },
    });
}

export async function completeLiveSession(
    sessionId: string,
    transcript?: any[]
): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { startedAt: true, status: true },
    });
    if (!session || session.status === "COMPLETED") {
        return;
    }
    const now = new Date();
    const durationSec = session.startedAt
        ? Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000))
        : 0;

    const updateData: any = {
        status: "COMPLETED",
        endedAt: now,
        durationSec: durationSec > 0 ? durationSec : null,
    };

    if (transcript && transcript.length > 0) {
        updateData.transcript = transcript;
    }

    await prisma.interviewSession.update({
        where: { id: sessionId },
        data: updateData,
    });
}

export async function createLiveInterviewSession(clerkId: string, data: {
    resumeId?: string;
    jobDescriptionId?: string;
    sessionType?: "BEHAVIORAL" | "CODING" | "TECHNICAL" | "MIXED";
    difficulty?: "EASY" | "MEDIUM" | "HARD";
}) {
    return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { clerkId } });
        if (!user) {
            const error = new Error("User not found in DB") as any;
            error.statusCode = 404;
            throw error;
        }

        // 1. Atomically deduct 1 credit
        const creditUpdate = await tx.user.updateMany({
            where: { id: user.id, credits: { gte: 1 } },
            data: { credits: { decrement: 1 } },
        });

        if (creditUpdate.count === 0) {
            const error = new Error("Insufficient credits to start a live interview") as any;
            error.statusCode = 402;
            throw error;
        }

        // Auto-select latest resume if not explicitly passed
        let targetResumeId = data.resumeId;
        if (!targetResumeId) {
            const latestResume = await tx.resume.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            targetResumeId = latestResume?.id;
        }

        // Auto-select latest job description if not explicitly passed
        let targetJobId = data.jobDescriptionId;
        if (!targetJobId) {
            const latestJob = await tx.jobDescription.findFirst({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                select: { id: true },
            });
            targetJobId = latestJob?.id;
        }

        // 2. Create Live Session with attached Resume & Job Context
        const session = await tx.interviewSession.create({
            data: {
                userId: user.id,
                resumeId: targetResumeId || null,
                jobDescriptionId: targetJobId || null,
                mode: "LIVE",
                sessionType: data.sessionType || "MIXED",
                difficulty: data.difficulty || "MEDIUM",
                status: "PENDING",
                transcript: [],
            },
        });

        // 3. Log credit usage
        await tx.creditUsageLog.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                creditsUsed: 1,
                action: "LIVE_INTERVIEW_SESSION",
            },
        });

        return {
            session,
            wsUrl: `/ws/interview?sessionId=${session.id}`,
        };
    });
}


export default {
    getLiveSessionContext,
    markLiveSessionActive,
    completeLiveSession,
    createLiveInterviewSession
};