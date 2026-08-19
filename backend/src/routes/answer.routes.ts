import { Router } from "express";
import { protectedRoute } from "../middlewares/auth";
import answerController from "../controllers/answer.controller";

const answerRouter = Router();

answerRouter.post("/", protectedRoute, answerController.submitSingleAnswer);
answerRouter.post("/:sessionId/:questionId", protectedRoute, answerController.submitSingleAnswer);

export default answerRouter;