import { Router } from "express";
import authController from "../controllers/user.controller";
import {requireAuth} from "@clerk/express";

const userRouter = Router();

userRouter.get('/me', requireAuth(), authController.me);
userRouter.post('/onboarding', requireAuth(), authController.onboarding);

export default userRouter;