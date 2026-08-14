-- AlterTable
ALTER TABLE "resumes" ALTER COLUMN "fileUrl" DROP NOT NULL,
ALTER COLUMN "fileId" DROP NOT NULL,
ALTER COLUMN "fileName" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "answers_sessionId_idx" ON "answers"("sessionId");

-- CreateIndex
CREATE INDEX "credit_usage_logs_userId_idx" ON "credit_usage_logs"("userId");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_idx" ON "interview_sessions"("userId");

-- CreateIndex
CREATE INDEX "interview_sessions_status_idx" ON "interview_sessions"("status");

-- CreateIndex
CREATE INDEX "job_descriptions_userId_idx" ON "job_descriptions"("userId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "questions_sessionId_idx" ON "questions"("sessionId");

-- CreateIndex
CREATE INDEX "resumes_userId_idx" ON "resumes"("userId");
