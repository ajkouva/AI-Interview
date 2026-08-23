-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "confidenceLevel" DOUBLE PRECISION,
ADD COLUMN     "suggestedAnswer" TEXT;

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "areasToImprove" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "competencyScores" JSONB,
ADD COLUMN     "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[];
