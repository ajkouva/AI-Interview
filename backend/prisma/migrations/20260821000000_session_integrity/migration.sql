-- Prevent duplicate question numbers within an interview session.
CREATE UNIQUE INDEX "questions_sessionId_questionNo_key" ON "questions"("sessionId", "questionNo");

-- Prevent concurrent evaluation requests from both calling the AI provider.
ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'EVALUATING';
