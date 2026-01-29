import express from "express";
import { googleCallback, googleLogin, login, logout, refreshToken, register, sendOtpRegister, verifyOtpRegister } from "../controllers/auth.controller.js"
import { verify } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/send-otp-register", sendOtpRegister);
router.post("/verify-otp-register", verifyOtpRegister);
router.post("/refresh-token", refreshToken);
router.post("/logout", verify("User"), logout);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);

export default router;