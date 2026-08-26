-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "interview_sessions_mode_idx" ON "interview_sessions"("mode");

-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "interview_sessions_userId_mode_idx" ON "interview_sessions"("userId", "mode");
