-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('PRACTICE', 'LIVE');

-- AlterTable
ALTER TABLE "interview_sessions" ADD COLUMN     "mode" "InterviewMode" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "transcript" JSONB;
