import express from "express";
import { getUser } from "../controllers/user.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";
import { getUsers, getUserStats } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/", verify("User"), getUser);
router.get("/stats", verify("Admin"), getUserStats);
router.get("/get-users", verify("Admin"), getUsers);

export default router;