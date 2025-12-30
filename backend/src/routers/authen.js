import express from "express";
import { googleCallback, googleLogin, listSessions, login, logout, logoutAll, logoutSession, refreshToken, register, sendOtpRegister, verifyOtpRegister } from "../controllers/authen.controller.js"
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/send-otp-register", sendOtpRegister);
router.post("/verify-otp-register", verifyOtpRegister);
router.post("/refresh-token", refreshToken);
router.post("/logout", verify("User"), logout);
router.post("/logout-sessions", verify("User"), logoutSession);
router.post("/logout-all-device", verify("User"), logoutAll);
router.get("/sessions", verify("User"), listSessions);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

export default router;