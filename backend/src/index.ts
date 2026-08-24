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
import answerRouter from './routes/answer.routes';
import { setupInterviewWebSocket } from "./services/interview/interview.ws";


const requiredEnvironment = [
  "DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT"
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

const app = express();
const PORT = process.env.PORT || 5000;
const configuredOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = ["http://localhost:3000", "http://localhost:5173"];
const allowedOrigins = process.env.NODE_ENV === "production" ? configuredOrigins : [...developmentOrigins, ...configuredOrigins];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Origin is not allowed by CORS policy"));
  }
}));
// Mount webhooks before express.json() so we can capture the raw body for Svix
app.use("/api/webhooks", webhookRouter);

app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/users", userRouter);
app.use("/api/jobs", jobRouter);
app.use("/api/resumes", resumeRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/answers", answerRouter);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', runtime: 'bun', timestamp: new Date() });
});

// Global Error Handler (Must be last before app.listen)
app.use(globalErrorHandler);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} with Bun`);
});

const wss = setupInterviewWebSocket(server);

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down gracefully.`);

  // 5-second force exit timer
  const forceExitTimer = setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  // Terminate active WebSockets and close WebSocket Server
  try {
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
  } catch (err) {
    console.error("Error closing WebSocket server:", err);
  }

  server.close(async () => {
    clearTimeout(forceExitTimer);
    const { prisma } = await import("./config/db");
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
