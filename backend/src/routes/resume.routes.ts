import { Router } from "express";
import multer from "multer";
import { protectedRoute } from "../middlewares/auth";
import resumeController from "../controllers/resume.controller";

const resumeRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB
        fields: 5,                 // Max 5 non-file fields
        parts: 6                   // Max 6 parts (5 fields + 1 file)
    }
});

resumeRouter.post("/upload", protectedRoute, upload.single("file"), resumeController.uploadResume);
resumeRouter.get("/", protectedRoute, resumeController.getAllResumes);

export default resumeRouter;