import { prisma } from "../../config/db";
import { evaluateFullSessionWithAI } from "./answer.parser";

export interface SubmitAnswerInput {
    clerkId: string;
    sessionId: string;
    questionId: string;
    answerText?: string;
    codeSnippet?: string;
    codeLanguage?: string;
}

export async function submitSingleAnswer({
    clerkId,
    sessionId,
    questionId,
    answerText,
    codeSnippet,
    codeLanguage
}: SubmitAnswerInput) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    const session = await prisma.interviewSession.findFirst({
        where: {
            id: sessionId,
            userId: user.id,
            status: "ACTIVE"
        },
        select: {
            id: true,
            startedAt: true,
            durationMinutes: true
        }
    });

    if (!session) {
        const error = new Error("Active interview session not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const now = new Date();
    if (session.startedAt && now.getTime() >= session.startedAt.getTime() + session.durationMinutes * 60_000) {
        await prisma.interviewSession.updateMany({
            where: { id: session.id, status: "ACTIVE" },
            data: { status: "ABANDONED", endedAt: now, durationSec: session.durationMinutes * 60 }
        });
        const error = new Error("This interview session has expired") as any;
        error.statusCode = 410;
        throw error;
    }

    const question = await prisma.question.findFirst({
        where: {
            id: questionId,
            sessionId: session.id
        },
        select: {
            id: true
        }
    });

    if (!question) {
        const error = new Error("Question not found in this session") as any;
        error.statusCode = 404;
        throw error;
    }

    // Only update fields that the caller explicitly supplied to prevent wiping existing data
    const updateData: any = {
        answerAt: new Date()
    };
    if (answerText !== undefined) updateData.answerText = answerText || null;
    if (codeSnippet !== undefined) updateData.codeSnippet = codeSnippet || null;
    if (codeLanguage !== undefined) updateData.codeLanguage = codeLanguage || null;

    const savedAnswer = await prisma.answer.upsert({
        where: {
            questionId: question.id
        },
        update: updateData,
        create: {
            questionId: question.id,
            sessionId: session.id,
            answerText: answerText || null,
            codeSnippet: codeSnippet || null,
            codeLanguage: codeLanguage || null,
            answerAt: new Date()
        }
    });

    return {
        saved: true,
        answer: savedAnswer
    };
}

export default {
    submitSingleAnswer
};
