import express from "express";
import { listSessions, logoutAll, logoutSession } from "../controllers/auth.controller.js"
import { verify } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verify("User"), listSessions);
router.delete("/all", verify("User"), logoutAll);
router.delete("/:id", verify("User"), logoutSession);

export default router;