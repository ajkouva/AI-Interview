import { Router } from "express";
import authController from "../controllers/user.controller";
import { protectedRoute } from "../middlewares/auth";

const userRouter = Router();

userRouter.get('/me', protectedRoute, authController.me);
userRouter.post('/onboarding', protectedRoute, authController.onboarding);

export default userRouter;