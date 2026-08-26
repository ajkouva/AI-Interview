import { prisma } from "../../../config/db";
import { evaluateTurnAndGenerateNextWithAI } from "./session.parser";
import { synthesizeSpeechBase64, type TTSVoice } from "../../ai/tts.services";
import type { SessionType } from "../../../../generated/prisma/enums";

export interface SubmitTurnInput {
    clerkId: string;
    sessionId: string;
    questionId: string;
    answerText?: string;
    codeSnippet?: string;
    codeLanguage?: string;
    voice?: TTSVoice;
}

export async function submitTurn({
    clerkId,
    sessionId,
    questionId,
    answerText,
    codeSnippet,
    codeLanguage,
    voice = "en-US-GuyNeural"
}: SubmitTurnInput) {
    // 1. Authenticate & Fetch User
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    // 2. Fetch Session & Validate Ownership & Status
    const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: {
            jobDescription: true,
            resume: true,
            questions: {
                orderBy: { questionNo: "asc" },
                include: { answer: true }
            }
        }
    });

    if (!session) {
        const error = new Error("Interview session not found or unauthorized") as any;
        error.statusCode = 404;
        throw error;
    }

    if (session.status === "COMPLETED") {
        const error = new Error("This interview session has already been completed.") as any;
        error.statusCode = 400;
        throw error;
    }

    // 3. Find target question
    const currentQuestion = session.questions.find((q) => q.id === questionId);
    if (!currentQuestion) {
        const error = new Error("Question not found in this interview session.") as any;
        error.statusCode = 404;
        throw error;
    }

    // 4. Save Candidate Answer (or update existing)
    const sanitizedAnswerText = answerText?.trim() || null;
    const sanitizedCode = codeSnippet && codeSnippet.trim().length > 0 ? codeSnippet : null;

    if (!sanitizedAnswerText && !sanitizedCode) {
        const error = new Error("Please provide a verbal explanation or code snippet.") as any;
        error.statusCode = 400;
        throw error;
    }

    // 5. Build History of Previous Turns for AI Context
    const history = session.questions
        .filter((q) => q.questionNo < currentQuestion.questionNo)
        .map((q) => ({
            questionNo: q.questionNo,
            questionText: q.questionText,
            answerText: q.answer?.answerText,
            codeSnippet: q.answer?.codeSnippet,
            score: q.answer?.aiScore
        }));

    const resumeText = session.resume?.content || session.resume?.aiSummary || "Software Engineer";
    const jobText = session.jobDescription?.description || session.jobDescription?.title || "Software Engineering role";
    const targetRole = session.jobDescription?.title || user.targetRole ||  "Software Engineer";

    // 6. Evaluate Turn & Determine Next Step via Gemini
    const turnResult = await evaluateTurnAndGenerateNextWithAI({
        candidateName: user.fullName || "Candidate",
        targetRole,
        resumeText,
        jobDescriptionText: jobText,
        difficultyLevel: session.difficulty,
        sessionType: session.sessionType,
        currentQuestionNo: currentQuestion.questionNo,
        totalQuestions: session.totalQuestions,
        questionText: currentQuestion.questionText,
        questionType: currentQuestion.questionType,
        answerText: sanitizedAnswerText,
        codeSnippet: sanitizedCode,
        codeLanguage: codeLanguage || null,
        history
    });

    const isConcluded = currentQuestion.questionNo >= session.totalQuestions && !turnResult.nextStep.isFollowUp;

    let nextQuestionData: any = null;
    let nextAudioBase64: string = "";

    // 7. Atomic DB Transaction: Save Answer Evaluation + (Create Next Question OR Mark Completed)
    await prisma.$transaction(async (tx) => {
        // Upsert Answer
        await tx.answer.upsert({
            where: { questionId: currentQuestion.id },
            create: {
                questionId: currentQuestion.id,
                sessionId: session.id,
                answerText: sanitizedAnswerText,
                codeSnippet: sanitizedCode,
                codeLanguage: codeLanguage || null,
                aiScore: turnResult.evaluation.score,
                aiFeedback: turnResult.evaluation.feedback
            },
            update: {
                answerText: sanitizedAnswerText,
                codeSnippet: sanitizedCode,
                codeLanguage: codeLanguage || null,
                aiScore: turnResult.evaluation.score,
                aiFeedback: turnResult.evaluation.feedback
            }
        });

        if (isConcluded || turnResult.finalSummary) {
            // Compute aggregate scores
            const allScores = [...history.map((h) => h.score).filter((s): s is number => typeof s === "number"), turnResult.evaluation.score];
            const computedAvgScore = allScores.length > 0
                ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
                : turnResult.evaluation.score;

            const finalSummary = turnResult.finalSummary || {
                overallScore: computedAvgScore,
                overallFeedback: turnResult.nextStep.concludingRemarks || "Interview session successfully completed.",
                strengths: turnResult.evaluation.strengths,
                areasToImprove: turnResult.evaluation.improvements,
                competencyScores: {
                    problemSolving: computedAvgScore,
                    technicalKnowledge: computedAvgScore,
                    communication: 80,
                    codeQuality: computedAvgScore
                }
            };

            await tx.interviewSession.update({
                where: { id: session.id },
                data: {
                    status: "COMPLETED",
                    endedAt: new Date(),
                    totalScore: finalSummary.overallScore,
                    aiFeedback: finalSummary.overallFeedback,
                    strengths: finalSummary.strengths,
                    areasToImprove: finalSummary.areasToImprove,
                    competencyScores: finalSummary.competencyScores
                }
            });
        } else if (turnResult.nextStep.nextQuestionText) {
            // Create Question N+1
            const nextQuestionNo = currentQuestion.questionNo + 1;
            const newQ = await tx.question.create({
                data: {
                    sessionId: session.id,
                    questionNo: nextQuestionNo,
                    questionText: turnResult.nextStep.nextQuestionText,
                    questionType: (turnResult.nextStep.nextQuestionType as SessionType) || currentQuestion.questionType,
                    isFollowUp: turnResult.nextStep.isFollowUp,
                    parentQId: turnResult.nextStep.isFollowUp ? currentQuestion.id : null,
                    aiVoiceId: voice
                }
            });

            await tx.interviewSession.update({
                where: { id: session.id },
                data: { currentQuestionNo: nextQuestionNo }
            });

            nextQuestionData = newQ;
        }
    });

    // 8. Synthesize Next Question Audio with Edge-TTS if session continues
    if (nextQuestionData && turnResult.nextStep.nextQuestionText) {
        nextAudioBase64 = await synthesizeSpeechBase64(turnResult.nextStep.nextQuestionText, voice);
    }

    return {
        evaluation: turnResult.evaluation,
        nextQuestion: nextQuestionData ? {
            id: nextQuestionData.id,
            questionNo: nextQuestionData.questionNo,
            questionText: nextQuestionData.questionText,
            questionType: nextQuestionData.questionType,
            isFollowUp: nextQuestionData.isFollowUp,
            audioBase64: nextAudioBase64
        } : null,
        isCompleted: isConcluded,
        concludingRemarks: turnResult.nextStep.concludingRemarks || null,
        finalSummary: turnResult.finalSummary || null,
        progress: {
            current: currentQuestion.questionNo,
            total: session.totalQuestions
        }
    };
}

export default {
    submitTurn
};
