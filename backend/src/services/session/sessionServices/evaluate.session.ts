import { evaluateFullSessionWithAI } from "../../answer/answer.parser";
import { prisma } from "../../../config/db";

async function submitAndEvaluateSession(clerkId: string, sessionId: string) {
    // 1. Verify User
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });

    if (!user) {
        const error = new Error("User not found in DB") as any;
        error.statusCode = 404;
        throw error;
    }

    // 2. Fetch Session with all Questions, Answers, Job Description & Resume
    const session = await prisma.interviewSession.findFirst({
        where: {
            id: sessionId,
            userId: user.id
        },
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
        const error = new Error("Interview session not found") as any;
        error.statusCode = 404;
        throw error;
    }

    if (session.status === "COMPLETED") {
        const error = new Error("This interview session has already been submitted and evaluated") as any;
        error.statusCode = 400;
        throw error;
    }

    // 3. Prepare data for Batch AI Evaluation
    const questionsForAI = session.questions.map((q) => ({
        questionId: q.id,
        questionNo: q.questionNo,
        questionText: q.questionText,
        questionType: q.questionType,
        answerText: q.answer?.answerText || null,
        codeSnippet: q.answer?.codeSnippet || null,
        codeLanguage: q.answer?.codeLanguage || null
    }));

    const jobContext = session.jobDescription?.description || session.jobDescription?.title || "";
    const resumeContext = session.resume?.aiSummary || session.resume?.content || "";

    // 4. Run Single Batch Evaluation Pass with Gemini
    const evaluation = await evaluateFullSessionWithAI({
        questions: questionsForAI,
        jobContext,
        resumeContext
    });

    // 5. Atomic Database Update: Save per-question scores + mark Session COMPLETED
    await prisma.$transaction(async (tx) => {
        // Update each answer with its AI score & feedback
        for (const ev of evaluation.evaluations) {
            await tx.answer.upsert({
                where: { questionId: ev.questionId },
                update: {
                    aiScore: ev.aiScore,
                    aiFeedback: ev.aiFeedback,
                    keywordHit: ev.keywordHit,
                    suggestedAnswer: ev.suggestedAnswer,
                    confidenceLevel: ev.confidenceLevel
                },
                create: {
                    questionId: ev.questionId,
                    sessionId: session.id,
                    aiScore: ev.aiScore,
                    aiFeedback: ev.aiFeedback,
                    keywordHit: ev.keywordHit,
                    suggestedAnswer: ev.suggestedAnswer,
                    confidenceLevel: ev.confidenceLevel,
                    answerAt: new Date()
                }
            });
        }

        const endedAt = new Date();
        const durationSec = session.startedAt
            ? Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000)
            : null;

        // Mark session as COMPLETED with overall score, duration & feedback
        await tx.interviewSession.update({
            where: { id: session.id },
            data: {
                status: "COMPLETED",
                endedAt,
                durationSec,
                totalScore: evaluation.totalScore,
                aiFeedback: evaluation.summaryFeedback,
                strengths: evaluation.strengths,
                areasToImprove: evaluation.areasToImprove,
                competencyScores: evaluation.competencyScores
            }
        });
    });

    return {
        sessionId: session.id,
        status: "COMPLETED",
        evaluation
    };
}

export default {
    submitAndEvaluateSession
}