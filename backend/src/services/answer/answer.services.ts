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
        include: {
            jobDescription: {
                select: { title: true, description: true }
            }
        }
    });

    if (!session) {
        const error = new Error("Active interview session not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const question = await prisma.question.findFirst({
        where: {
            id: questionId,
            sessionId: session.id
        },
        include: {
            answer: true
        }
    });

    if (!question) {
        const error = new Error("Question not found in this session") as any;
        error.statusCode = 404;
        throw error;
    }

    const savedAnswer = await prisma.answer.upsert({
        where: {
            questionId: question.id
        },
        update: {
            answerText: answerText || null,
            codeSnippet: codeSnippet || null,
            codeLanguage: codeLanguage || null,
            answerAt: new Date()
        },
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