import express from "express";
import { verify } from "../middlewares/authMiddleware.js";
import { getLogs } from "../controllers/log.controller.js";

const router = express.Router();

router.get("/", verify("Admin"), getLogs);

export default router;