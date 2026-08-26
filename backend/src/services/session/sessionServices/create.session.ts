import { prisma } from "../../../config/db";
import { generateFirstQuestionWithAI } from "./session.parser";
import { synthesizeSpeechBase64, type TTSVoice } from "../../ai/tts.services";
import type { SessionType, Difficulty } from "../../../../generated/prisma/enums";

export interface SessionDetailInput {
    resumeId?: string;
    jobDescriptionId?: string;
    sessionType?: string;
    difficulty?: string;
    durationMinutes?: number;
    totalQuestions?: number;
    voice?: TTSVoice;
}

async function createSession(
    clerkId: string,
    {
        resumeId,
        jobDescriptionId,
        sessionType = "MIXED",
        difficulty = "MEDIUM",
        durationMinutes = 15,
        totalQuestions = 5,
        voice = "en-US-GuyNeural"
    }: SessionDetailInput
) {
    // 1. Fetch User
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    // 2. Fetch Optional Resume & Job Description Context
    let resumeContent = "General Software Engineering candidate";
    let jobTitle = "Software Engineer";
    let jobDescriptionContent = "General software development requirements.";

    if (resumeId) {
        const resume = await prisma.resume.findFirst({
            where: { id: resumeId, userId: user.id }
        });
        if (resume) {
            resumeContent = resume.content || resume.aiSummary || resumeContent;
        }
    }

    if (jobDescriptionId) {
        const job = await prisma.jobDescription.findFirst({
            where: { id: jobDescriptionId, userId: user.id }
        });
        if (job) {
            jobTitle = job.title || jobTitle;
            jobDescriptionContent = job.description || jobDescriptionContent;
        }
    }

    // 3. Atomically reserve 1 credit
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

    const sanitizedTotalQuestions = typeof totalQuestions === "number" && totalQuestions > 0 ? Math.min(totalQuestions, 20) : 5;

    let createdSessionId: string;
    let greetingText: string;
    let initialQuestion: any;
    let audioBase64: string = "";

    try {
        // 4. Generate Greeting + Question 1 dynamically with Gemini
        const firstTurn = await generateFirstQuestionWithAI({
            candidateName: user.fullName || "Candidate",
            targetRole: jobTitle,
            resumeText: resumeContent,
            jobDescriptionText: jobDescriptionContent,
            difficultyLevel: difficulty,
            sessionType: sessionType
        });

        greetingText = firstTurn.greeting;

        // 5. Synthesize Question 1 Voice using Edge-TTS
        const fullAudioScript = `${firstTurn.greeting} ... ${firstTurn.questionText}`;
        audioBase64 = await synthesizeSpeechBase64(fullAudioScript, voice);

        // 6. Save Session + Question 1 in DB
        const session = await prisma.$transaction(async (tx) => {
            const newSession = await tx.interviewSession.create({
                data: {
                    userId: user.id,
                    resumeId: resumeId || null,
                    jobDescriptionId: jobDescriptionId || null,
                    mode: "PRACTICE",
                    status: "ACTIVE",
                    sessionType: (sessionType as SessionType) || "MIXED",
                    difficulty: (difficulty as Difficulty) || "MEDIUM",
                    durationMinutes: durationMinutes || 15,
                    totalQuestions: sanitizedTotalQuestions,
                    currentQuestionNo: 1,
                    startedAt: new Date()
                }
            });

            await tx.creditUsageLog.update({
                where: { id: creditLog.id },
                data: { sessionId: newSession.id }
            });

            const createdQ = await tx.question.create({
                data: {
                    sessionId: newSession.id,
                    questionNo: 1,
                    questionText: firstTurn.questionText,
                    questionType: firstTurn.questionType as SessionType,
                    aiVoiceId: voice
                }
            });

            initialQuestion = createdQ;
            return newSession;
        });

        createdSessionId = session.id;
    } catch (error) {
        // Refund credit on initialization failure
        await prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.id }, data: { credits: { increment: 1 } } });
            await tx.creditUsageLog.create({
                data: { userId: user.id, creditsUsed: -1, action: "REFUND_FAILED_SESSION_CREATION" }
            });
        });
        throw error;
    }

    const fetchedSession = await prisma.interviewSession.findUnique({
        where: { id: createdSessionId },
        include: {
            jobDescription: { select: { title: true, description: true } },
            resume: { select: { title: true } }
        }
    });

    return {
        session: fetchedSession,
        greeting: greetingText,
        currentQuestion: {
            id: initialQuestion.id,
            questionNo: 1,
            questionText: initialQuestion.questionText,
            questionType: initialQuestion.questionType,
            audioBase64
        },
        totalQuestions: sanitizedTotalQuestions
    };
}

export default {
    createSession
};
