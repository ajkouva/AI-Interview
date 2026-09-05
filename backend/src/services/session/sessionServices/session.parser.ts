import { z } from "zod";
import { generateStructuredAI } from "../../ai/gemini.client";

export const FirstQuestionSchema = z.object({
    greeting: z.string().min(1),
    questionText: z.string().min(1),
    questionType: z.enum(["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"]),
});

export const TurnEvaluationSchema = z.object({
    evaluation: z.object({
        score: z.number().min(0).max(100),
        feedback: z.string().min(1),
        strengths: z.array(z.string()).default([]),
        improvements: z.array(z.string()).default([]),
        codeReview: z.string().optional()
    }),
    nextStep: z.object({
        isFollowUp: z.boolean(),
        nextQuestionText: z.string().optional(),
        nextQuestionType: z.enum(["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"]).optional(),
        concludingRemarks: z.string().optional()
    }),
    finalSummary: z.object({
        overallScore: z.number().min(0).max(100),
        overallFeedback: z.string(),
        strengths: z.array(z.string()),
        areasToImprove: z.array(z.string()),
        competencyScores: z.object({
            problemSolving: z.number().min(0).max(100),
            technicalKnowledge: z.number().min(0).max(100),
            communication: z.number().min(0).max(100),
            codeQuality: z.number().min(0).max(100)
        })
    }).optional()
});

export async function generateFirstQuestionWithAI({
    candidateName,
    targetRole,
    resumeText,
    jobDescriptionText,
    difficultyLevel = "MEDIUM",
    sessionType = "MIXED"
}: {
    candidateName: string;
    targetRole: string;
    resumeText: string;
    jobDescriptionText: string;
    difficultyLevel?: string;
    sessionType?: string;
}) {
    const resumeContext = resumeText.slice(0, 30_000);
    const jobContext = jobDescriptionText.slice(0, 20_000);

    const prompt = `
    You are an expert technical interviewer conducting an interactive interview for the role of "${targetRole}".
    Candidate Name: "${candidateName}"
    Difficulty: ${difficultyLevel}
    Session Focus: ${sessionType}

    Candidate Resume:
    <resume>
    ${resumeContext || "General background in software development."}
    </resume>

    Target Job Description:
    <job_description>
    ${jobContext || "Standard industry standards for this role."}
    </job_description>

    TASK:
    1. Generate a warm, professional, 1-to-2 sentence opening greeting addressed to ${candidateName}.
    2. Generate Question #1: An introductory/icebreaker or primary project deep-dive question relevant to their resume experience and the target job.
    3. Specify the questionType ("BEHAVIORAL", "TECHNICAL", "CODING", or "MIXED").

    Return ONLY a JSON object matching this structure:
    {
        "greeting": "Hello ${candidateName}, welcome to your interview for the ${targetRole} position.",
        "questionText": "To start off, could you walk me through...",
        "questionType": "TECHNICAL"
    }
    `;

    return await generateStructuredAI(prompt, FirstQuestionSchema);
}

export async function evaluateTurnAndGenerateNextWithAI({
    candidateName,
    targetRole,
    resumeText,
    jobDescriptionText,
    difficultyLevel,
    sessionType,
    currentQuestionNo,
    totalQuestions,
    questionText,
    questionType,
    answerText,
    codeSnippet,
    codeLanguage,
    history
}: {
    candidateName: string;
    targetRole: string;
    resumeText: string;
    jobDescriptionText: string;
    difficultyLevel: string;
    sessionType: string;
    currentQuestionNo: number;
    totalQuestions: number;
    questionText: string;
    questionType: string;
    answerText?: string | null;
    codeSnippet?: string | null;
    codeLanguage?: string | null;
    history: Array<{ questionNo: number; questionText: string; answerText?: string | null; codeSnippet?: string | null; score?: number | null }>;
}) {
    const isLastQuestion = currentQuestionNo >= totalQuestions;

    const formattedHistory = history.map((h) => `
    [Q${h.questionNo}]: ${h.questionText}
    [Candidate Answer]: ${h.answerText || "(No verbal answer provided)"}
    ${h.codeSnippet ? `[Candidate Code]:\n\`\`\`\n${h.codeSnippet}\n\`\`\`` : ""}
    [Score]: ${h.score ?? "Pending"}
    `).join("\n---\n");

    const prompt = `
    You are an expert technical interviewer evaluating Question #${currentQuestionNo} out of ${totalQuestions} for candidate "${candidateName}" applying for "${targetRole}".
    Difficulty: ${difficultyLevel} | Focus: ${sessionType}

    Resume Context:
    ${resumeText.slice(0, 10_000)}

    Job Context:
    ${jobDescriptionText.slice(0, 10_000)}

    Interview History So Far:
    ${formattedHistory || "First question in session."}

    CURRENT TURN TO EVALUATE:
    Question #${currentQuestionNo}: "${questionText}" (Type: ${questionType})
    Candidate Answer: "${answerText || "No verbal explanation provided."}"
    ${codeSnippet ? `Candidate Code (${codeLanguage || "code"}):\n\`\`\`${codeLanguage || ""}\n${codeSnippet}\n\`\`\`` : "No code submitted."}

    EVALUATION INSTRUCTIONS:
    1. Score the answer from 0 to 100 based on technical depth, clarity, accuracy, and edge-case handling.
    2. Provide constructive, concise feedback explaining what was good and what could be improved.
    3. If code was provided, include a brief codeReview note (syntax, time/space complexity O(n), clean patterns).

    NEXT QUESTION INSTRUCTIONS:
    - Current Question No: ${currentQuestionNo} | Total Target: ${totalQuestions}.
    - Is this the final question of the session? ${isLastQuestion ? "YES (Final Question)" : "NO (More questions remain)"}
    - If NOT the final question:
      - If the candidate gave a vague/shallow answer, you may ask an adaptive follow-up probe (set isFollowUp: true, nextQuestionText: "...").
      - Otherwise, advance to the next technical topic/scenario (set isFollowUp: false, nextQuestionText: "...").
    - If this IS the final question:
      - Provide concludingRemarks.
      - Provide a finalSummary with overallScore (0-100), overallFeedback, top strengths, areasToImprove, and competencyScores (problemSolving, technicalKnowledge, communication, codeQuality from 0-100).

    Return ONLY a valid JSON object matching the requested schema.
    `;

    const result = await generateStructuredAI(prompt, TurnEvaluationSchema);

    // Enforce progression invariants based on stored session progress
    if (!isLastQuestion) {
        // Non-final turn: must have next question and cannot complete early
        result.finalSummary = undefined;
        if (!result.nextStep.nextQuestionText || result.nextStep.nextQuestionText.trim() === "") {
            result.nextStep.nextQuestionText = `Can you expand further on your technical approach and how you would test it in production?`;
        }
    } else {
        // Final turn: cannot have follow-up questions; must conclude
        result.nextStep.isFollowUp = false;
        result.nextStep.nextQuestionText = undefined;
        if (!result.finalSummary) {
            result.finalSummary = {
                overallScore: result.evaluation.score,
                overallFeedback: result.nextStep.concludingRemarks || result.evaluation.feedback,
                strengths: result.evaluation.strengths,
                areasToImprove: result.evaluation.improvements,
                competencyScores: {
                    problemSolving: result.evaluation.score,
                    technicalKnowledge: result.evaluation.score,
                    communication: 80,
                    codeQuality: result.evaluation.score
                }
            };
        }
    }

    return result;
}

export default {
    generateFirstQuestionWithAI,
    evaluateTurnAndGenerateNextWithAI,
};
