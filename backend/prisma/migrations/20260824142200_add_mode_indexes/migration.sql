-- CreateIndex
CREATE INDEX "interview_sessions_mode_idx" ON "interview_sessions"("mode");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_mode_idx" ON "interview_sessions"("userId", "mode");
