import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import userRouter from './routes/user.routes';
import webhookRouter from './routes/webhook.routes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Mount webhooks before express.json() so we can capture the raw body for Svix
app.use("/api/webhooks", webhookRouter);

app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/users", userRouter);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', runtime: 'bun', timestamp: new Date() });
});

// Protected Route Example
app.get('/api/protected', requireAuth(), (req, res) => {
  const auth = getAuth(req);
  res.json({ message: 'Access granted to protected route!', userId: auth.userId });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} with Bun`);
});
