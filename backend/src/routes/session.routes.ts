import { Router } from "express";
import sessionController from "../controllers/session.controller";
import { protectedRoute } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import liveController from "../controllers/live.controller";

const sessionRouter = Router();

sessionRouter.post("/", protectedRoute, rateLimit({ windowMs: 60_000, max: 5 }), sessionController.createSession);
sessionRouter.get("/", protectedRoute, sessionController.getAllSessions);
sessionRouter.get("/latest", protectedRoute, sessionController.getLatestSession);
sessionRouter.get("/:id", protectedRoute, sessionController.getSessionById);

sessionRouter.post("/:sessionId/turn", protectedRoute, rateLimit({ windowMs: 60_000, max: 20 }), sessionController.submitTurn);

sessionRouter.post("/live", protectedRoute, rateLimit({ windowMs: 60_000, max: 5 }), liveController.createLiveSession);

export default sessionRouter;
