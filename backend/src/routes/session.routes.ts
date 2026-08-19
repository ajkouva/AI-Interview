import { Router } from "express";
import sessionController from "../controllers/session.controller";
import { protectedRoute } from "../middlewares/auth";

const sessionRouter = Router();

sessionRouter.post("/", protectedRoute, sessionController.createSession);
sessionRouter.get("/", protectedRoute, sessionController.getAllSessions);
sessionRouter.get("/latest", protectedRoute, sessionController.getLatestSession);
sessionRouter.get("/:id", protectedRoute, sessionController.getSessionById);

sessionRouter.post("/:sessionId/submit", protectedRoute, sessionController.submitSession);

export default sessionRouter;
