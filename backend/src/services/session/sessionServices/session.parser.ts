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
    NoOfQuestions: number = 5,
    sessionType: string = "MIXED"
) {
    // 1. Enforce integer count bounds (1 to 20) with robust finite number check
    const sanitizedCount = typeof NoOfQuestions === "number" && Number.isFinite(NoOfQuestions) ? Math.floor(NoOfQuestions) : 5;
    const targetCount = Math.min(Math.max(sanitizedCount, 1), 20);

    // 2. Build dynamic Zod schema requiring exact question count array length
    const DynamicQuestionsSchema = z.array(QuestionSchema).length(
        targetCount,
        `AI generated question count mismatch. Expected exactly ${targetCount} questions.`
    );

    const resumeContext = resumeText.slice(0, 30_000);
    const jobContext = jobDescriptionText.slice(0, 20_000);
    const prompt = `
    Generate a list of EXACTLY ${targetCount} interview questions based on the provided resume and job description.
    The questions should be relevant to the candidate's experience and the requirements of the job.
    The requested interview type is ${sessionType}; make the questions match it. For MIXED, use an intentional mix.
    You MUST return exactly ${targetCount} items in the array.
    
    Resume Context:
    <untrusted_resume>
    ${resumeContext}
    </untrusted_resume>
    
    Job Description Context:
    <untrusted_job_description>
    ${jobContext}
    </untrusted_job_description>

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
        const questions = await generateStructuredAI(prompt, DynamicQuestionsSchema);
        const questionNumbers = questions.map((question) => question.questionNo);
        const expectedNumbers = Array.from({ length: targetCount }, (_, index) => index + 1);
        if (new Set(questionNumbers).size !== targetCount || !expectedNumbers.every((number) => questionNumbers.includes(number))) {
            const error = new Error("AI generated invalid or duplicate question numbers") as any;
            error.statusCode = 422;
            throw error;
        }
        return questions;
    } catch (error) {
        console.error("AI Question Generation Error:", error);
        throw error;
    }
}

export default {
    generateQuestionWithAI,
};
