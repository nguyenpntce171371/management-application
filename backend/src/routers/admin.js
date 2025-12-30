import express from "express";
import { deleteUser, getLogs, updateUserRole } from "../controllers/admin.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";

const router = express.Router();

router.post("/modify-role", verify("Admin"), updateUserRole);
router.delete("/delete-user", verify("Admin"), deleteUser);
router.get("/log", verify("Admin"), getLogs);

export default router;