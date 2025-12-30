import User from "../models/User.js";
import { sendEmail } from "../services/email.service.js";

export const changePassword = async (req, res) => {
    try {
        let { email, oldPassword, newPassword, confirm } = req.body;

        if (!email || !oldPassword || !newPassword || !confirm) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Email, old password and new password are required",
            });
        }

        if (newPassword !== confirm) {
            return res.status(400).json({
                success: false,
                code: "PASSWORD_MISMATCH",
                message: "Password confirmation does not match",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                code: "INCORRECT_PASSWORD",
                message: "Old password is incorrect",
            });
        }

        user.password = newPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            code: "PASSWORD_CHANGED",
            message: "Password changed successfully",
        });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong while changing password",
        });
    }
};

export const sendOtpForgot = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                code: "EMAIL_REQUIRED",
                message: "Email is required",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "EMAIL_NOT_FOUND",
                message: "Email not found",
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        user.otp = hashedOtp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        await sendEmail(
            email,
            "Mã OTP khôi phục mật khẩu",
            `Mã OTP của bạn là: ${otp}\nHiệu lực 5 phút.`
        );

        return res.json({
            success: true,
            code: "OTP_SENT",
            message: "OTP sent",
        });

    } catch (err) {
        console.error("sendOtpForgot error:", err);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Could not send OTP",
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Email and OTP are required",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }

        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        if (!user.otp || user.otp !== hashedOtp) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Invalid OTP",
            });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({
                success: false,
                code: "OTP_EXPIRED",
                message: "OTP has expired",
            });
        }

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            message: "OTP verified successfully",
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong while verifying OTP",
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        let { email, otp, newPassword, confirm } = req.body;

        if (!email || !otp || !newPassword || !confirm) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "All fields are required",
            });
        }

        if (newPassword !== confirm) {
            return res.status(400).json({
                success: false,
                code: "PASSWORD_MISMATCH",
                message: "Password confirmation does not match",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }

        const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
        if (user.otp !== hashedInput) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Invalid OTP",
            });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({
                success: false,
                code: "OTP_EXPIRED",
                message: "OTP has expired",
            });
        }

        user.password = newPassword;
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            code: "PASSWORD_RESET",
            message: "Password reset successful",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong while resetting password",
        });
    }
};