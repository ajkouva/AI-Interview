import { Router } from "express";
import { handleClerkWebhook } from "../controllers/webhook.controller";
import express from 'express';

const webhookRouter = Router();

// We need raw body for webhook verification
webhookRouter.post('/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

export default webhookRouter;
