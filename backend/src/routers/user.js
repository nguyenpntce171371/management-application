import express from "express";
import { deleteUserAvatar, getUser, updateUserProfile } from "../controllers/user.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { uploadSingle } from "../middlewares/upload.js";

const router = express.Router();

router.get("/", verify("User"), getUser);
router.post("/", verify("User"), uploadSingle.single("avatar"), updateUserProfile);
router.delete("/avatar", verify("User"), deleteUserAvatar);

export default router;