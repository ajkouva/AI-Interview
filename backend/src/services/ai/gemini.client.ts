import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export const MODEL_NAME = "gemini-2.5-flash";

/**
 * Shared helper to execute a structured JSON prompt using Google Gemini AI,
 * sanitize markdown code fences, parse JSON, and validate against a Zod schema.
 */
export async function generateStructuredAI<T>(
    prompt: string,
    schema: z.ZodType<T>
): Promise<T> {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const responseText = response.text;
        if (!responseText || responseText.trim() === "") {
            throw new Error("No text content returned from Gemini AI model");
        }

        // Clean JSON markdown code blocks (e.g. ```json ... ```)
        const cleanJson = responseText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const rawJson = JSON.parse(cleanJson);
        return schema.parse(rawJson);
    } catch (error: any) {
        console.error(`[Gemini AI Error] Model: ${MODEL_NAME}`, error);
        if (error instanceof z.ZodError) {
            throw new Error(`AI generated invalid response format: ${error.message}`);
        }
        throw error;
    }
}
