import { z } from "zod";
import { generateStructuredAI } from "../ai/gemini.client";

export const BatchSessionEvaluationSchema = z.object({
  totalScore: z.number().min(0).max(100),
  summaryFeedback: z.string().min(1),
  strengths: z.array(z.string()),
  areasToImprove: z.array(z.string()).min(1),
  competencyScores: z.object({
    technicalKnowledge: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    codeQuality: z.number().min(0).max(100),
  }),
  evaluations: z.array(
    z.object({
      questionId: z.string(),
      aiScore: z.number().min(0).max(10),
      aiFeedback: z.string().min(1),
      keywordHit: z.array(z.string()),
      suggestedAnswer: z.string().min(1),
      confidenceLevel: z.number().min(0).max(100),
    })
  ),
});

export type BatchSessionEvaluation = z.infer<typeof BatchSessionEvaluationSchema>;

export interface QuestionAnswerItem {
  questionId: string;
  questionNo: number;
  questionText: string;
  questionType: string;
  answerText?: string | null;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
}

export interface FullSessionEvaluationInput {
  questions: QuestionAnswerItem[];
  jobContext?: string;
  resumeContext?: string;
}

export async function evaluateFullSessionWithAI({
  questions,
  jobContext,
  resumeContext,
}: FullSessionEvaluationInput): Promise<BatchSessionEvaluation> {
  const questionsBlock = questions
    .map((q) => {
      const textPart = q.answerText ? `**Candidate Explanation:**\n${q.answerText}\n` : "";
      const codePart = q.codeSnippet
        ? `**Code Snippet (${q.codeLanguage || "text"}):**\n\`\`\`${q.codeLanguage || "text"}\n${q.codeSnippet}\n\`\`\`\n`
        : "";
      const answerContent = (textPart || codePart) ? `${textPart}${codePart}`.trim() : "No response provided";

      return `
### Q${q.questionNo} [ID: ${q.questionId}]
**Type:** ${q.questionType}
**Question:** ${q.questionText}
${answerContent}
`;
    })
    .join("\n");

  const prompt = `
You are a Principal Tech Lead and Senior Hiring Manager. 
Evaluate the following technical interview session holistically.

## Context
**Role:** ${jobContext || "Software Engineer"}
**Candidate Profile:** ${resumeContext || "Not provided"}

## Assessment Data
${questionsBlock}

## Instructions
1. **Individual Evaluation**: 
   - You MUST provide exactly ONE evaluation object for EACH question listed above.
   - Match the "questionId" exactly.
   - Score (0-10) based on correctness, edge cases, and seniority-level depth.
   - If no answer was provided, score 0.0 and note "No response" in feedback.

2. **Holistic Analytics**:
   - Calculate "totalScore" (0-100) as a weighted average of technical depth and communication.
   - Identify 2-4 specific "strengths" and "areasToImprove".
   - Score competencies (0-100) based on the aggregate performance.

## Output Format
Return STRICTLY a JSON object with this exact structure:
{
  "totalScore": 85,
  "summaryFeedback": "Candidate demonstrated solid foundational knowledge in backend engineering...",
  "strengths": ["Strong explanation of SQL indexing", "Clean modular code structure"],
  "areasToImprove": ["Consider edge cases with null values", "Mention concurrency and lock management"],
  "competencyScores": {
    "technicalKnowledge": 85,
    "problemSolving": 80,
    "communication": 90,
    "codeQuality": 80
  },
  "evaluations": [
    {
      "questionId": "exact-question-id-here",
      "aiScore": 8.5,
      "aiFeedback": "Specific feedback for this question...",
      "keywordHit": ["B-Tree", "Table Heap"],
      "suggestedAnswer": "A comprehensive answer should cover...",
      "confidenceLevel": 85
    }
  ]
}

The "evaluations" array MUST contain exactly ${questions.length} items.
`;


  const result = await generateStructuredAI(prompt, BatchSessionEvaluationSchema);

  if (result.evaluations.length !== questions.length) {
    console.warn(
      `Mismatch in evaluation count: Expected ${questions.length}, got ${result.evaluations.length}. 
       Some questions may have been skipped by the AI.`
    );
  }

  return result;
}

export default {
  evaluateFullSessionWithAI,
};