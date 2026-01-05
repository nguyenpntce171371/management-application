import Token from "../models/Token.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { redis } from "../middlewares/rateLimitRedis.js";
import { sendEmail } from "../services/email.service.js";
import axios from "axios";
import { io } from "../index.js";

export const googleCallback = async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.status(400).json({
                success: false,
                code: "NO_CODE",
                message: "Thiếu mã xác thực",
            });
        }

        const tokenRes = await axios.post(
            "https://oauth2.googleapis.com/token",
            {
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${process.env.DOMAIN}/api/auth/google/callback`,
                grant_type: "authorization_code",
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const { id_token } = tokenRes.data;

        if (!id_token) {
            return res.status(400).json({
                success: false,
                code: "NO_ID_TOKEN",
                message: "Không có id_token trả về từ Google",
            });
        }

        const payload = JSON.parse(Buffer.from(id_token.split(".")[1], "base64").toString());

        const email = payload.email;
        const fullName = payload.name;
        const avatar = payload.picture;
        const providerId = payload.sub;

        if (!email) {
            return res.status(400).json({
                success: false,
                code: "NO_EMAIL",
                message: "Tài khoản Google không có email liên kết",
            });
        }

        let user = await User.findOne({ email });

        if (!user) {
            const count = await User.countDocuments();
            const role = count === 0 ? "Admin" : "User";

            user = new User({ fullName, email, provider: "google", providerId, avatar, role });

            await user.save();
        } else {
            if (!user.provider || user.provider === "local") {
                user.provider = user.provider || "local";
            }
        }

        const rawDeviceId = req.cookies.deviceId || crypto.randomUUID();
        const deviceName = req.headers["user-agent"] || "Unknown device";
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);
        const remember = true;
        const refreshToken = remember ? jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });
        const refreshExp = remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        await Token.create({
            userId: user._id,
            refreshToken,
            accessTokenExpiresAt: accessExp,
            refreshTokenExpiresAt: refreshExp,
            deviceId: rawDeviceId,
            deviceName,
            ipAddress: req.ip || "",
            remember: remember ? true : false,
        });

        io.to(user._id).emit("loggedInElsewhere", {});

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            secure: process.env.NODE_ENV === "production",
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.NODE_ENV === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
        });

        return res.redirect(`${process.env.DOMAIN}/`);
    } catch (error) {
        console.log("Google login error:", error);
        return res.redirect(
            `${process.env.DOMAIN}/?login=google_failed`
        );
    }
};

export const googleLogin = (req, res) => {
    const redirectUri = encodeURIComponent(`${process.env.DOMAIN}/api/auth/google/callback`);
    const scope = encodeURIComponent("openid email profile");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    return res.redirect(url);
};

export const logout = async (req, res) => {
    try {
        const rt = req.cookies.refreshToken;
        const deviceId = req.cookies.deviceId;

        if (rt && deviceId) {
            const hashedDeviceId = crypto.createHash("sha256").update(deviceId).digest("hex");
            const session = await Token.deleteOne({ userId: req.user.userId, deviceId: hashedDeviceId });
            io.to(req.user.userId).emit("loggedOut", { _id: session._id });
        }

        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_OK",
            message: "Đăng xuất thành công",
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const logoutAll = async (req, res) => {
    try {
        const sessions = await Token.find({ userId: req.user.userId });
        const sessionIds = sessions.map(s => s._id);
        await Token.deleteMany({ userId: req.user.userId });

        io.to(req.user.userId).emit("loggedOut", { sessionIds });

        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_ALL_OK",
            message: "Tất cả các phiên đã được đăng xuất thành công",
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const listSessions = async (req, res) => {
    try {
        const rawDeviceId = req.cookies.deviceId;
        const hashedDeviceId = rawDeviceId ? crypto.createHash("sha256").update(rawDeviceId).digest("hex") : null;

        const sessions = await Token.find({ userId: req.user.userId }, { refreshToken: 0 }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            code: "SESSIONS_OK",
            data: sessions.map(s => ({
                id: s._id,
                deviceName: s.deviceName,
                ipAddress: s.ipAddress,
                createdAt: s.createdAt,
                expiresAt: s.refreshTokenExpiresAt,
                isCurrent: hashedDeviceId && s.deviceId === hashedDeviceId
            }))
        });
    } catch (e) {
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const register = async (req, res) => {
    try {
        let { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const fullNameRegex = /^[A-Za-zÀ-ỹ]+(?:\s[A-Za-zÀ-ỹ]+)+$/;
        if (!fullNameRegex.test(fullName)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_FULLNAME",
                message: "Tên không hợp lệ",
            });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Người dùng này đã tồn tại",
            });
        }

        const verified = await redis.get(`otp_verified:${email}`);
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Hãy xác minh mã OTP trước khi đăng ký",
            });
        }

        const count = await User.countDocuments();
        const role = (count === 0) ? "Admin" : "User";
        const user = new User({ fullName, email, role });
        await user.setPassword(password);
        await user.save();

        io.to("Admin").emit("newUserRegistered", { userId: user._id, email: user.email, role: user.role });

        await redis.del(`otp_verified:${email}`);

        return res.status(201).json({
            success: true,
            code: "REGISTER_OK",
            message: "Đăng ký thành công",
        });

    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const sendOtpRegister = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                code: "EMAIL_REQUIRED",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Người dùng này đã tồn tại",
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashed = crypto.createHash("sha256").update(otp).digest("hex");

        await redis.del(`otp_verified:${email}`);
        await redis.set(`otp:${email}`, hashed, "EX", 300);

        await sendEmail(email, "Mã OTP đăng ký tài khoản", `Mã OTP của bạn là: ${otp}\nHiệu lực 5 phút.`);

        return res.status(200).json({
            success: true,
            code: "OTP_SENT",
            message: "Đã gửi mã OTP",
        });
    } catch (err) {
        console.error("sendOtpRegister error:", err);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const verifyOtpRegister = async (req, res) => {
    try {
        let { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const stored = await redis.get(`otp:${email}`);
        if (!stored) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Mã OTP không hợp lệ",
            });
        }

        const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
        if (hashedInput !== stored) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OTP",
                message: "Mã OTP không hợp lệ",
            });
        }

        await redis.del(`otp:${email}`);
        await redis.set(`otp_verified:${email}`, "true", "EX", 600);

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            message: "Xác minh OTP thành công",
        });
    } catch (err) {
        console.error("verifyOtpRegister error:", err);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const login = async (req, res) => {
    try {
        let { email, password, remember } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ",
            });
        }

        const validPassword = await user.comparePassword(password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ",
            });
        }

        const accessToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);

        const refreshToken = remember ? jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });

        const refreshExp = remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        const rawDeviceId = req.cookies.deviceId || crypto.randomUUID();
        const deviceName = req.headers["user-agent"] || "Unknown device";

        const session = await Token.create({
            userId: user._id,
            refreshToken,
            accessTokenExpiresAt: accessExp,
            refreshTokenExpiresAt: refreshExp,
            deviceId: rawDeviceId,
            deviceName,
            ipAddress: req.ip || "",
            remember: remember ? true : false,
        });

        io.to(user._id).emit("loggedInElsewhere", { _id: session._id });

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            secure: process.env.NODE_ENV === "production",
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.NODE_ENV === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
        });

        return res.status(200).json({
            success: true,
            code: "LOGIN_OK",
            message: "Đăng nhập thành công",
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            code: "NO_REFRESH_TOKEN",
            message: "Không có token làm mới.",
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                code: "NO_DEVICE_ID",
                message: "Thiết bị không được nhận dạng.",
            });
        }

        const hashedDeviceId = crypto.createHash("sha256").update(deviceId).digest("hex");

        const tokenRecord = await Token.findOne({
            userId: decoded.userId,
            deviceId: hashedDeviceId,
        });

        if (!tokenRecord) {
            await Token.deleteMany({ userId: decoded.userId });
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });
            return res.status(401).json({
                success: false,
                code: "REUSED_TOKEN_DETECTED",
                message: "Phát hiện sử dụng lại token. Tất cả các phiên đăng nhập đã bị thu hồi.",
            });
        }

        const isMatch = await tokenRecord.compareRefreshToken(refreshToken);
        if (!isMatch) {
            await Token.deleteMany({ userId: decoded.userId });
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });
            return res.status(401).json({
                success: false,
                code: "REUSED_TOKEN_DETECTED",
                message: "Phát hiện sử dụng lại token. Tất cả các phiên đăng nhập đã bị thu hồi.",
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Người dùng không tồn tại",
            });
        }

        const newAccessToken = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: tokenRecord.remember ? "7d" : "1h" }
        );

        const newAccessExp = new Date(Date.now() + 15 * 60 * 1000);
        const newRefreshExp = tokenRecord.remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        tokenRecord.refreshToken = newRefreshToken;
        tokenRecord.accessTokenExpiresAt = newAccessExp;
        tokenRecord.refreshTokenExpiresAt = newRefreshExp;
        await tokenRecord.save();

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            success: true,
            code: "REFRESH_OK",
            message: "Phiên đã được làm mới thành công",
        });
    } catch (error) {
        console.error("Refresh error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const logoutSession = async (req, res) => {
    try {
        const sessionId = req.body.sessionId || req.params.id;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                code: "MISSING_SESSION_ID",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                code: "NO_DEVICE_ID",
                message: "Thiết bị không được nhận dạng.",
            });
        }

        const hashedDeviceId = crypto.createHash("sha256").update(deviceId).digest("hex");

        const currentToken = await Token.findOne({
            userId: req.user.userId,
            deviceId: hashedDeviceId,
        });

        if (currentToken && currentToken._id.toString() === sessionId) {
            return res.status(400).json({
                success: false,
                code: "CANNOT_LOGOUT_CURRENT_SESSION",
                message: "Không thể đăng xuất phiên hiện tại",
            });
        }

        const session = await Token.findOne({ _id: sessionId, userId: req.user.userId });
        if (!session) {
            return res.status(404).json({
                success: false,
                code: "SESSION_NOT_FOUND",
                message: "Phien không tồn tại",
            });
        }

        await Token.deleteOne({ _id: sessionId });

        io.to(req.user.userId).emit("sessionLoggedOut", { sessionId });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_SESSION_OK",
            message: "Đăng xuất phiên thành công",
        });
    } catch (error) {
        console.error("logoutSession error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};
