import express from "express";
import { deleteUserAvatar, getUser, updateUserProfile } from "../controllers/user.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";
import { uploadSingle } from "../middlewares/upload.js";
import { getUsers, getUserStats } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/", verify("User"), getUser);
router.post("/", verify("User"), uploadSingle.single("avatar"), updateUserProfile);
router.delete("/avatar", verify("User"), deleteUserAvatar);
router.get("/stats", verify("Admin"), getUserStats);
router.get("/get-users", verify("Admin"), getUsers);

export default router;