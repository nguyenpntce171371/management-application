import User from "../models/User.js";
import { sendOTPResetPasswordEmail, sendPasswordChangedEmail } from "../services/email.service.js";
import { OTPService } from "../services/otp.service.js";
import { io } from "../index.js";
import Token from "../models/Token.js";
import { normalizeEmail } from "../utils/string.js";

export const changePassword = async (req, res) => {
    try {
        const { email } = req.user;
        const { oldPassword, newPassword, confirm } = req.body;

        if (!newPassword || !confirm) {
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

        const user = await User.findOne({ email }).select({ fullName: 1, password: 1, provider: 1 });
        if (!user) {
            return res.status(400).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ",
            });
        }

        if (user.provider === "local") {
            if (!oldPassword) {
                return res.status(400).json({
                    success: false,
                    code: "MISSING_FIELDS",
                    message: "Các trường bắt buộc bị thiếu",
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
        }

        user.password = await User.hashPassword(newPassword);
        user.provider = "local";
        await user.save();

        const deviceId = req.session.deviceId;
        const id = req.user.id;

        const sessions = await Token.find({ userId: id, deviceId: { $ne: deviceId } }, { _id: 1 }).lean();
        await Token.deleteMany({ userId: id, deviceId: { $ne: deviceId } });

        io.to(id).emit("loggedOut", sessions.map(s => s._id.toString()));

        await sendPasswordChangedEmail(email, user.fullName);

        return res.status(200).json({
            success: true,
            code: "PASSWORD_CHANGED",
            message: "Mật khẩu đã được thay đổi thành công"
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const sendOtpForgot = async (req, res) => {
    try {
        const { email: rawEmail } = req.body;
        const email = normalizeEmail(rawEmail);

        if (!email) {
            return res.status(400).json({
                success: false,
                code: "EMAIL_REQUIRED",
                message: "Email is required",
            });
        }

        const exists = await User.exists({ email });
        if (!exists) {
            return res.status(200).json({
                success: true,
                code: "OTP_SENT",
                message: "Đã gửi mã OTP đến email của bạn",
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
                message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { otp, email: rawEmail } = req.body;
        const email = normalizeEmail(rawEmail);

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const resetToken = await OTPService.verify(email, otp, "reset_password");

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            data: resetToken,
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
                message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email: rawEmail, resetToken, newPassword, confirm } = req.body;
        const email = normalizeEmail(rawEmail);
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

        const verified = await OTPService.isVerified(email, resetToken, "reset_password");
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Vui lòng xác minh OTP trước",
            });
        }
        await OTPService.clearVerified(email, "reset_password");

        const user = await User.findOne({ email }, { _id: 1, provider: 1 });
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng",
            });
        }

        user.password = await User.hashPassword(newPassword);
        if (user.provider !== "local") {
            user.provider = "local";
        }
        await user.save();

        const sessions = await Token.find({ userId: user._id }, { _id: 1 }).lean();
        await Token.deleteMany({ userId: user._id });

        io.to(user._id.toString()).emit("loggedOut", sessions.map(s => s._id.toString()));

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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};