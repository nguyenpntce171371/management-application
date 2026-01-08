import User from "../models/User.js";
import { sendOTPResetPasswordEmail, sendPasswordChangedEmail } from "../services/email.service.js";
import { OTPService } from "../services/otp.service.js";
import crypto from "crypto";
import { io } from "../index.js";
import Token from "../models/Token.js";

export const changePassword = async (req, res) => {
    try {
        let { email, oldPassword, newPassword, confirm } = req.body;

        if (!email || !oldPassword || !newPassword || !confirm) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        if (newPassword !== confirm) {
            return res.status(400).json({
                success: false,
                code: "PASSWORD_MISMATCH",
                message: "Mật khẩu xác nhận không khớp",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ",
            });
        }

        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ",
            });
        }

        await user.setPassword(newPassword);
        await user.save();

        const deviceId = req.cookies.deviceId;
        const hashedDeviceId = crypto.createHash("sha256").update(deviceId).digest("hex");
        const currentSession = await Token.findOne({ userId: user._id, deviceId: hashedDeviceId });
        const sessions = await Token.find({ userId: user._id });
        const sessionIdsToDelete = sessions.filter(s => !s._id.equals(currentSession._id)).map(s => s._id);
        await Token.deleteMany({ _id: { $in: sessionIdsToDelete } });

        io.to(user._id).emit("loggedOut", { sessionIds: sessionIdsToDelete });

        await sendPasswordChangedEmail(email, user.fullName);

        return res.status(200).json({
            success: true,
            code: "PASSWORD_CHANGED",
            message: "Mật khẩu đã được thay đổi thành công",
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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

        const { code, expiresIn } = await OTPService.create(email, "reset_password");
        await sendOTPResetPasswordEmail(email, code, expiresIn);

        return res.status(200).json({
            success: true,
            code: "OTP_SENT",
            message: "Đã gửi mã OTP đến email của bạn",
        });
    } catch (error) {
        if (error.code === "OTP_LIMIT") {
            res.status(429).json({
                success: false,
                code: error.code,
                message: error.message
            });
        } else {
            console.error("sendOtpRegister error:", error);
            res.status(500).json({
                success: false,
                code: "SERVER_ERROR",
                message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    }
};

export const verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng",
            });
        }

        await OTPService.verify(email, otp, "reset_password");

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            message: "Mã OTP đã được xác minh thành công",
        });
    } catch (error) {
        if (error.code === "OTP_ERROR") {
            res.status(400).json({
                success: false,
                code: error.code,
                message: error.message
            });
        } else if (error.code === "OTP_LIMIT") {
            res.status(429).json({
                success: false,
                code: error.code,
                message: error.message
            });
        } else {
            console.error("sendOtpRegister error:", error);
            res.status(500).json({
                success: false,
                code: "SERVER_ERROR",
                message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    }
};

export const resetPassword = async (req, res) => {
    try {
        let { email, newPassword, confirm } = req.body;
        if (!email || !newPassword || !confirm) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        if (newPassword !== confirm) {
            return res.status(400).json({
                success: false,
                code: "PASSWORD_MISMATCH",
                message: "Mật khẩu xác nhận không khớp",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng",
            });
        }

        const verified = await OTPService.isVerified(email, "reset_password");
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Vui lòng xác minh OTP trước",
            });
        }

        await user.setPassword(newPassword);
        await user.save();

        const sessions = await Token.find({ userId: user._id });
        const sessionIds = sessions.map(s => s._id);
        await Token.deleteMany({ userId: user._id });

        io.to(user._id).emit("loggedOut", { sessionIds });

        return res.status(200).json({
            success: true,
            code: "PASSWORD_RESET",
            message: "Đặt lại mật khẩu thành công",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};