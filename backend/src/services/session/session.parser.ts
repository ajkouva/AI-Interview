import { z } from "zod";
import { generateStructuredAI } from "../ai/gemini.client";

const QuestionSchema = z.object({
    questionNo: z.number().int().positive(),
    questionText: z.string().min(1),
    questionType: z.enum(["BEHAVIORAL", "CODING", "TECHNICAL", "MIXED"]),
});

const GeneratedQuestionsSchema = z.array(QuestionSchema).min(1, "Generated question array cannot be empty");

export async function generateQuestionWithAI(
    resumeText: string,
    jobDescriptionText: string,
    difficultyLevel: string = "MEDIUM",
    NoOfQuestions: number = 5
) {
    // Sanitize question count bounds (1 to 20)
    const targetCount = Math.min(Math.max(NoOfQuestions, 1), 20);

    const prompt = `
    Generate a list of ${targetCount} interview questions based on the provided resume and job description.
    The questions should be relevant to the candidate's experience and the requirements of the job.
    
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
        return await generateStructuredAI(prompt, GeneratedQuestionsSchema);
    } catch (error) {
        console.error("AI Question Generation Error:", error);
        throw new Error("Failed to generate questions using AI");
    }
}

export default {
    generateQuestionWithAI,
};