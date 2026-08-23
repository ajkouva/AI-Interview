import { Router } from "express";
import sessionController from "../controllers/session.controller";
import { protectedRoute } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";

const sessionRouter = Router();

sessionRouter.post("/", protectedRoute, rateLimit({ windowMs: 60_000, max: 5 }), sessionController.createSession);
sessionRouter.get("/", protectedRoute, sessionController.getAllSessions);
sessionRouter.get("/latest", protectedRoute, sessionController.getLatestSession);
sessionRouter.get("/:id", protectedRoute, sessionController.getSessionById);

sessionRouter.post("/:sessionId/submit", protectedRoute, rateLimit({ windowMs: 60_000, max: 5 }), sessionController.submitSession);

export default sessionRouter;
