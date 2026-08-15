import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { generateStructuredAI } from "../ai/gemini.client";

// Zod Schema to validate AI output before returning
const ParsedResumeSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  aiSummary: z.string().optional(),
  contact: z.record(z.string(), z.any()).optional().default({}),
  skills: z.array(z.string()).optional().default([]),
  experience: z.array(z.any()).optional().default([]),
  education: z.array(z.any()).optional().default([]),
  projects: z.array(z.any()).optional().default([]),
  certifications: z.array(z.string()).optional().default([])
});

export async function parsePDF(buffer: Buffer): Promise<string> {
  // 1. Magic Bytes Validation: Must start with %PDF
  const isPDF = buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (!isPDF) {
    throw new Error("Failed to extract text from PDF: File signature does not match PDF format");
  }

  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    console.error("PDF Parsing Error:", error);
    throw new Error("Failed to extract text from PDF");
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyErr) {
        console.error("Error destroying PDF parser instance:", destroyErr);
      }
    }
  }
}

export async function parseResumeWithAI(resumeTxt: string) {
  if (!resumeTxt || resumeTxt.trim().length < 50) {
    throw new Error("Uploaded PDF contains insufficient readable text (scanned image PDFs are not supported).");
  }

  // Cap resume text at 30,000 characters to prevent prompt token bloat
  const sanitizedText = resumeTxt.length > 30000 ? resumeTxt.slice(0, 30000) : resumeTxt;

  const prompt = `Parse the following resume text and extract the information requested. Respond STRICTLY in valid JSON format with no markdown wrappers or backticks.

    Resume Text:
    ${sanitizedText}
    
    Expected JSON format:
    {
      "name": "Candidate Name",
      "title": "Professional Title / Role",
      "aiSummary": "Comprehensive summary of the candidate's background",
      "contact": {
        "email": "email@example.com",
        "phone": "+1...",
        "location": "City, Country",
        "linkedin": "linkedin url"
      },
      "skills": ["skill1", "skill2"],
      "experience": [
        {
          "company": "Company",
          "title": "Role Title",
          "dates": "Date range",
          "location": "Location",
          "responsibilities": ["bullet 1", "bullet 2"]
        }
      ],
      "education": [
        {
          "institution": "University/College",
          "degree": "Degree/Major",
          "year": "Graduation Year"
        }
      ],
      "projects": [
         {
            "name": "Project Name",
            "description": "Project details"
         }
      ],
      "certifications": ["Cert 1"]
    }`;

  try {
    return await generateStructuredAI(prompt, ParsedResumeSchema);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw new Error("Failed to extract structured data using AI");
  }
}