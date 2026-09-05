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

    if (session.status !== "ACTIVE") {
        const error = new Error(`Interview session is not active (status: ${session.status}).`) as any;
        error.statusCode = 400;
        throw error;
    }

    // 3. Find target question and validate it is the current active unanswered turn
    const currentQuestion = session.questions.find((q) => q.id === questionId);
    if (!currentQuestion) {
        const error = new Error("Question not found in this interview session.") as any;
        error.statusCode = 404;
        throw error;
    }

    if (currentQuestion.questionNo !== session.currentQuestionNo) {
        const error = new Error(`Cannot submit answer for question #${currentQuestion.questionNo}. Active turn is question #${session.currentQuestionNo}.`) as any;
        error.statusCode = 400;
        throw error;
    }

    if (currentQuestion.answer && currentQuestion.answer.aiScore !== null) {
        const error = new Error(`Question #${currentQuestion.questionNo} has already been evaluated.`) as any;
        error.statusCode = 400;
        throw error;
    }

    // 4. Validate Candidate Answer
    const sanitizedAnswerText = answerText?.trim() || null;
    const sanitizedCode = codeSnippet && codeSnippet.trim().length > 0 ? codeSnippet : null;

    if (!sanitizedAnswerText && !sanitizedCode) {
        const error = new Error("Please provide a verbal explanation or code snippet.") as any;
        error.statusCode = 400;
        throw error;
    }

    // 5. Atomically Claim the Turn before the slow AI call
    const claimSuccess = await prisma.$transaction(async (tx) => {
        const active = await tx.interviewSession.findUnique({
            where: { id: session.id },
            select: { status: true, currentQuestionNo: true }
        });
        if (!active || active.status !== "ACTIVE" || active.currentQuestionNo !== currentQuestion.questionNo) {
            return false;
        }
        const existingAns = await tx.answer.findUnique({
            where: { questionId: currentQuestion.id }
        });
        if (existingAns && existingAns.aiScore !== null) {
            return false;
        }
        await tx.answer.upsert({
            where: { questionId: currentQuestion.id },
            create: {
                questionId: currentQuestion.id,
                sessionId: session.id,
                answerText: sanitizedAnswerText,
                codeSnippet: sanitizedCode,
                codeLanguage: codeLanguage || null,
                answerAt: new Date()
            },
            update: {
                answerText: sanitizedAnswerText,
                codeSnippet: sanitizedCode,
                codeLanguage: codeLanguage || null,
                answerAt: new Date()
            }
        });
        return true;
    });

    if (!claimSuccess) {
        const error = new Error(`Question #${currentQuestion.questionNo} is currently being processed or already evaluated.`) as any;
        error.statusCode = 409;
        throw error;
    }

    // 6. Build History of Previous Turns for AI Context
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
    const targetRole = session.jobDescription?.title || user.targetRole || "Software Engineer";

    // 7. Evaluate Turn & Determine Next Step via Gemini
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

    // 8. Derive completion strictly from stored session progress
    const isConcluded = currentQuestion.questionNo >= session.totalQuestions;

    let nextQuestionData: any = null;
    let nextAudioBase64: string = "";
    let finalSummaryData: any = null;

    // 9. Atomic DB Transaction: Save Answer Evaluation + (Create Next Question OR Mark Completed)
    await prisma.$transaction(async (tx) => {
        // Update Answer with evaluation scores
        await tx.answer.update({
            where: { questionId: currentQuestion.id },
            data: {
                aiScore: turnResult.evaluation.score,
                aiFeedback: turnResult.evaluation.feedback
            }
        });

        if (isConcluded) {
            // Compute aggregate scores
            const allScores = [...history.map((h) => h.score).filter((s): s is number => typeof s === "number"), turnResult.evaluation.score];
            const computedAvgScore = allScores.length > 0
                ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
                : turnResult.evaluation.score;

            finalSummaryData = turnResult.finalSummary || {
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
                    totalScore: finalSummaryData.overallScore,
                    aiFeedback: finalSummaryData.overallFeedback,
                    strengths: finalSummaryData.strengths,
                    areasToImprove: finalSummaryData.areasToImprove,
                    competencyScores: finalSummaryData.competencyScores
                }
            });
        } else {
            // Non-final question: Create Question N+1
            const nextQuestionNo = currentQuestion.questionNo + 1;
            const nextText = turnResult.nextStep.nextQuestionText || "Can you expand further on your technical approach and system design considerations?";
            const newQ = await tx.question.create({
                data: {
                    sessionId: session.id,
                    questionNo: nextQuestionNo,
                    questionText: nextText,
                    questionType: (turnResult.nextStep.nextQuestionType as SessionType) || currentQuestion.questionType,
                    isFollowUp: turnResult.nextStep.isFollowUp ?? false,
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

    // 10. Synthesize Next Question Audio with Edge-TTS if session continues
    if (!isConcluded && nextQuestionData) {
        nextAudioBase64 = await synthesizeSpeechBase64(nextQuestionData.questionText, voice);
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
        concludingRemarks: isConcluded ? (turnResult.nextStep.concludingRemarks || "Interview session successfully completed.") : null,
        finalSummary: isConcluded ? finalSummaryData : null,
        progress: {
            current: currentQuestion.questionNo,
            total: session.totalQuestions
        }
    };
}

export default {
    submitTurn
};
