import { Router } from "express";
import multer from "multer";
import { protectedRoute } from "../middlewares/auth";
import resumeController from "../controllers/resume.controller";

const resumeRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only PDF files are allowed."));
        }
    },
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1,
    }
});

resumeRouter.post("/upload", protectedRoute, upload.single("file"), resumeController.uploadResume);
resumeRouter.get("/", protectedRoute, resumeController.getAllResumes);
resumeRouter.get("/:id", protectedRoute, resumeController.getResumeById);
resumeRouter.delete("/:id", protectedRoute, resumeController.deleteResume);

export default resumeRouter;