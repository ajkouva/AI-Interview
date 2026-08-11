import { Router } from "express";
import jobController from "../controllers/job.controller";
import { protectedRoute } from "../middlewares/auth";

const jobRouter = Router();

jobRouter.post("/", protectedRoute, jobController.createJob);
jobRouter.get("/", protectedRoute, jobController.getAllJobs);
jobRouter.get("/:id", protectedRoute, jobController.getJobById);

export default jobRouter;
