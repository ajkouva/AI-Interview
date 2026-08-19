import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export const MODEL_NAME = "gemini-3.5-flash-lite";
export const GEMINI_TIMEOUT_MS = 15000; // 15 Seconds hard timeout limit

export class AITimeoutError extends Error {
    statusCode: number;
    code: string;
    constructor(message = "AI service request timed out. Please try again.") {
        super(message);
        this.name = "AITimeoutError";
        this.statusCode = 504;
        this.code = "AI_TIMEOUT_ERROR";
    }
}

/**
 * Shared helper to execute a structured JSON prompt using Google Gemini AI,
 * sanitize markdown code fences, parse JSON, and validate against a Zod schema.
 * Enforces a hard timeout and classifies 504 Gateway Timeout errors.
 */
export async function generateStructuredAI<T>(
    prompt: string,
    schema: z.ZodType<T>
): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
        const generatePromise = ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        // Enforce hard timeout race against model call
        const response: any = await Promise.race([
            generatePromise,
            new Promise((_, reject) => {
                controller.signal.addEventListener("abort", () => {
                    reject(new AITimeoutError(`Gemini AI request timed out after ${GEMINI_TIMEOUT_MS / 1000}s`));
                });
            })
        ]);

        clearTimeout(timeoutId);

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
        clearTimeout(timeoutId);
        console.error(`[Gemini AI Error] Model: ${MODEL_NAME}`, error);

        if (error instanceof AITimeoutError || error.name === "AbortError" || error.code === "ETIMEDOUT" || error.message?.includes("timed out")) {
            const timeoutError = new AITimeoutError("AI service timed out while processing your request. Please try again.");
            throw timeoutError;
        }

        if (error instanceof z.ZodError) {
            const valError = new Error(`AI generated invalid response format: ${error.message}`) as any;
            valError.statusCode = 422;
            throw valError;
        }
        throw error;
    }
}
