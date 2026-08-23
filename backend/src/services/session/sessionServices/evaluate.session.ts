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

    if (session.status !== "ACTIVE") {
        const error = new Error(`This interview session cannot be submitted (current status: ${session.status})`) as any;
        error.statusCode = 400;
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

    // Claim the session before calling Gemini so concurrent submissions cannot
    // create duplicate billable evaluations.
    const claim = await prisma.interviewSession.updateMany({
        where: { id: session.id, status: "ACTIVE" },
        data: { status: "EVALUATING" }
    });
    if (claim.count === 0) {
        const error = new Error("This interview session is already being submitted") as any;
        error.statusCode = 409;
        throw error;
    }

    try {
    // 3. Prepare data for Batch AI Evaluation
    const validQuestionIdSet = new Set(session.questions.map((q) => q.id));
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

    const evaluationIds = evaluation.evaluations.map((evaluation) => evaluation.questionId);
    if (evaluationIds.length !== session.questions.length || new Set(evaluationIds).size !== evaluationIds.length ||
        !evaluationIds.every((id) => validQuestionIdSet.has(id))) {
        const error = new Error("AI evaluation did not contain exactly one result for every question") as any;
        error.statusCode = 422;
        throw error;
    }

    // 5. Atomic Database Update: Save per-question scores + mark Session COMPLETED
    await prisma.$transaction(async (tx) => {
        // Filter evaluations strictly against known question IDs for this session to prevent foreign-key/cross-session bugs
        const safeEvaluations = evaluation.evaluations.filter((ev) => validQuestionIdSet.has(ev.questionId));

        // Update each answer with its AI score & feedback
        for (const ev of safeEvaluations) {
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

        // Mark session as COMPLETED with concurrency guard (aborts if another concurrent request completed it first)
        const updateResult = await tx.interviewSession.updateMany({
            where: { id: session.id, status: "EVALUATING" },
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

        if (updateResult.count === 0) {
            const error = new Error("Session submission failed: Session was already submitted or is no longer active.") as any;
            error.statusCode = 409;
            throw error;
        }
    });

    return {
        sessionId: session.id,
        status: "COMPLETED",
        evaluation
    };
    } catch (error) {
        // A failed provider response must leave the interview answerable.
        await prisma.interviewSession.updateMany({
            where: { id: session.id, status: "EVALUATING" },
            data: { status: "ACTIVE" }
        });
        throw error;
    }
}

export default {
    submitAndEvaluateSession
}
