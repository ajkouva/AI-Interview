import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import userRouter from './routes/user.routes';
import webhookRouter from './routes/webhook.routes';
import jobRouter from './routes/job.routes';
import resumeRouter from './routes/resume.routes';
import sessionRouter from './routes/session.routes';
import { globalErrorHandler } from './middlewares/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Mount webhooks before express.json() so we can capture the raw body for Svix
app.use("/api/webhooks", webhookRouter);

app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/users", userRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/resumes", resumeRouter);
app.use("/api/sessions", sessionRouter);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', runtime: 'bun', timestamp: new Date() });
});

// Global Error Handler (Must be last before app.listen)
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} with Bun`);
});
