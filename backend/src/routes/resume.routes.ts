import { Router } from "express";
import multer from "multer";
import { protectedRoute } from "../middlewares/auth";
import resumeController from "../controllers/resume.controller";

const resumeRouter = Router();

const upload = multer({storage: multer.memoryStorage()});

resumeRouter.post("/upload", protectedRoute, upload.single("file"), resumeController.uploadResume);
resumeRouter.get("/", protectedRoute, resumeController.getAllResumes);

export default resumeRouter;