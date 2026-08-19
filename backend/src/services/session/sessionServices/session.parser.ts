import { z } from "zod";
import { generateStructuredAI } from "../../ai/gemini.client";

const QuestionSchema = z.object({
    questionNo: z.number().int().positive(),
    questionText: z.string().min(1),
    questionType: z.enum(["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"]),
});

export async function generateQuestionWithAI(
    resumeText: string,
    jobDescriptionText: string,
    difficultyLevel: string = "MEDIUM",
    NoOfQuestions: number = 5
) {
    // 1. Enforce integer count bounds (1 to 20)
    const sanitizedCount = typeof NoOfQuestions === "number" ? Math.floor(NoOfQuestions) : 5;
    const targetCount = Math.min(Math.max(sanitizedCount, 1), 20);

    // 2. Build dynamic Zod schema requiring exact question count array length
    const DynamicQuestionsSchema = z.array(QuestionSchema).length(
        targetCount,
        `AI generated question count mismatch. Expected exactly ${targetCount} questions.`
    );

    const prompt = `
    Generate a list of EXACTLY ${targetCount} interview questions based on the provided resume and job description.
    The questions should be relevant to the candidate's experience and the requirements of the job.
    You MUST return exactly ${targetCount} items in the array.
    
    Resume Context:
    ${resumeText}
    
    Job Description Context:
    ${jobDescriptionText}

    Difficulty Level: ${difficultyLevel}
    
    Return the questions STRICTLY in the following JSON array format with no markdown wrappers:
    [
        {
            "questionNo": 1,
            "questionText": "Question text here...",
            "questionType": "BEHAVIORAL"
        },
        {
            "questionNo": 2,
            "questionText": "Question text here...",
            "questionType": "TECHNICAL"
        }
    ]
    `;

    try {
        return await generateStructuredAI(prompt, DynamicQuestionsSchema);
    } catch (error) {
        console.error("AI Question Generation Error:", error);
        throw error;
    }
}

export default {
    generateQuestionWithAI,
};