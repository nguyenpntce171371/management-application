import User from "../models/User.js";
import { sendEmail } from "../services/email.service.js";
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

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        user.otp = hashedOtp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        await sendEmail(email, "Mã OTP khôi phục mật khẩu", `Mã OTP của bạn là: ${otp}\nHiệu lực 5 phút.`);

        return res.json({
            success: true,
            code: "OTP_SENT",
            message: "Đã gửi mã OTP đến email của bạn",
        });

    } catch (err) {
        console.error("sendOtpForgot error:", err);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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

        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
        if (!user.otp || user.otp !== hashedOtp) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Mã OTP không hợp lệ",
            });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({
                success: false,
                code: process.env.NODE_ENV === "development" ? "OTP_EXPIRED" : "INVALID_OTP",
                message: process.env.NODE_ENV === "development" ? "OTP has expired" : "Mã OTP không hợp lệ",
            });
        }

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            message: "Mã OTP đã được xác minh thành công",
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
        const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
        if (user.otp !== hashedInput) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Mã OTP không hợp lệ",
            });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).json({
                success: false,
                code: process.env.NODE_ENV === "development" ? "OTP_EXPIRED" : "INVALID_OTP",
                message: process.env.NODE_ENV === "development" ? "OTP has expired" : "Mã OTP không hợp lệ",
            });
        }

        await user.setPassword(newPassword);
        user.otp = undefined;
        user.otpExpiry = undefined;
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