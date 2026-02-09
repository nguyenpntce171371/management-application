import express from "express";
import { changePassword, verifyOTP, resetPassword, sendOtpForgot } from "../controllers/password.controller.js";
import { verify } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/change-password", verify("User"), changePassword);
router.post("/send-otp-forgot", sendOtpForgot);
router.post("/verify-otp-forgot", verifyOTP);
router.post("/reset-password", resetPassword);

export default router;