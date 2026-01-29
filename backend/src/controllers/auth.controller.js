import Token from "../models/Token.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOTPRegisterEmail } from "../services/email.service.js";
import axios from "axios";
import { io } from "../index.js";
import { OAuth2Client } from "google-auth-library";
import { OTPService } from "../services/otp.service.js";
import NodeCache from "node-cache";
import { generateReadPAR } from "../services/oci.service.js";

const imageUrlCache = new NodeCache({
    stdTTL: 1800,
    checkperiod: 600,
    useClones: false,
    maxKeys: 10000
});

const getCachedImageUrl = async (imagePath) => {
    if (!(imagePath && !imagePath.startsWith("http"))) return imagePath;

    const cachedUrl = imageUrlCache.get(imagePath);
    if (cachedUrl) return cachedUrl;

    try {
        const url = await generateReadPAR(imagePath, 30);
        imageUrlCache.set(imagePath, url);
        return url;
    } catch (error) {
        console.error(`Failed to generate URL for ${imagePath}:`, error);
        return null;
    }
};

export const googleCallback = async (req, res) => {
    const DOMAIN = `https://${process.env.APP_MODE === "development" ? "dev." : ""}${process.env.DOMAIN}`
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
                redirect_uri: `${DOMAIN}/api/auth/google/callback`,
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

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload.email_verified) {
            return res.status(400).json({
                success: false,
                code: "EMAIL_NOT_VERIFIED",
                message: "Email Google chưa được xác minh",
            });
        }

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
        } else {
            if (!user.providerId) {
                user.providerId = providerId;
            }
            if (!user.avatar) {
                user.avatar = avatar
            }
        }
        await user.save();

        const rawDeviceId = req.cookies.deviceId || crypto.randomUUID();
        const deviceName = req.headers["user-agent"] || "Unknown device";
        const accessToken = jwt.sign(
            { id: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);
        const remember = true;
        const refreshToken = remember ? jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });
        const refreshExp = remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        const session = await Token.create({
            userId: user._id,
            refreshToken,
            accessTokenExpiresAt: accessExp,
            refreshTokenExpiresAt: refreshExp,
            deviceId: rawDeviceId,
            deviceName,
            ipAddress: req.ip || "",
            remember: remember,
        });

        io.to(user._id.toString()).emit("loggedInElsewhere", { _id: session._id.toString() });

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            secure: process.env.APP_MODE === "production",
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.APP_MODE === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        return res.redirect(DOMAIN);
    } catch (error) {
        console.log("Google login error:", error);
        return res.redirect(
            `${DOMAIN}/?login=google_failed`
        );
    }
};

export const googleLogin = (req, res) => {
    const DOMAIN = `https://${process.env.APP_MODE === "development" ? "dev." : ""}${process.env.DOMAIN}`
    const redirectUri = encodeURIComponent(`${DOMAIN}/api/auth/google/callback`);
    const scope = encodeURIComponent("openid email profile");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    return res.redirect(url);
};

export const logout = async (req, res) => {
    try {
        const deviceId = req.cookies.deviceId;

        if (deviceId) {
            const sessions = await Token.find({ userId: req.user.id });
            const session = sessions.find(s => s.compareDeviceId(deviceId));
            if (session) {
                await session.deleteOne();
                io.to(req.user.id).emit("loggedOut", { id: session._id.toString() });
            }
        }

        res.clearCookie("deviceId");
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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const logoutAll = async (req, res) => {
    try {
        const currentUser = req.user;
        const sessions = await Token.find({ userId: currentUser.id });
        const sessionIds = sessions.map(s => s._id.toString());
        await Token.deleteMany({ userId: currentUser.id });

        io.to(currentUser.id).emit("loggedOut", { sessionIds });

        res.clearCookie("deviceId");
        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_ALL_OK",
            message: "Tất cả các phiên đã được đăng xuất thành công",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const listSessions = async (req, res) => {
    try {
        const rawDeviceId = req.cookies.deviceId;

        const sessions = await Token.find({ userId: req.user.id }, { refreshToken: 0 }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            code: "SESSIONS_OK",
            data: sessions.map(s => ({
                id: s._id.toString(),
                deviceName: s.deviceName,
                ipAddress: s.ipAddress,
                createdAt: s.createdAt,
                expiresAt: s.refreshTokenExpiresAt,
                isCurrent: s.compareDeviceId(rawDeviceId)
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
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

        const verified = await OTPService.isVerified(email, "register");
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Hãy xác minh mã OTP trước khi đăng ký",
            });
        }
        OTPService.clearVerified(email, "register");
        const count = await User.countDocuments();
        const role = (count === 0) ? "Admin" : "User";
        const user = new User({ fullName, email, role });
        await user.setPassword(password);
        await user.save();

        io.to("Admin").emit("newUserRegistered", { id: user._id.toString(), email: user.email, role: user.role });

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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
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

        const { code, expiresIn } = await OTPService.create(email, "register");
        console.log(code)
        await sendOTPRegisterEmail(email, code, expiresIn);

        return res.status(200).json({
            success: true,
            code: "OTP_SENT",
            message: "Đã gửi mã OTP",
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

        await OTPService.verify(email, otp, "register");

        return res.status(200).json({
            success: true,
            code: "OTP_VERIFIED",
            message: "Xác minh OTP thành công",
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
            { id: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);

        const refreshToken = remember ? jwt.sign({ id: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });

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
            remember: remember,
        });

        io.to(user._id.toString()).emit("loggedInElsewhere", { _id: session._id.toString() });

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            secure: process.env.APP_MODE === "production",
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.APP_MODE === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "LOGIN_OK",
            message: "Đăng nhập thành công",
            data: {
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                address: user.address,
                avatar: avatarUrl,
                provider: user.provider
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                code: "NO_REFRESH_TOKEN",
                message: "Không có token làm mới.",
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(401).json({
                success: false,
                code: "DEVICE_ID_MISSING",
                message: "Thiết bị không được nhận dạng.",
            });
        }

        const sessions = await Token.find({ userId: decoded.id });
        const currentSession = sessions.find(s => s.compareDeviceId(deviceId));

        if (!currentSession) {
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });
            return res.status(401).json({
                success: false,
                code: "CURRENT_SESSION_NOT_FOUND",
                message: "Phiên đăng nhập không tồn tại hoặc đã bị thu hồi.",
            });
        }

        const isMatch = await currentSession.compareRefreshToken(refreshToken);
        if (!isMatch) {
            await Token.deleteOne({ _id: currentSession._id });
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });
            return res.status(401).json({
                success: false,
                code: "REUSED_TOKEN_DETECTED",
                message: "Phát hiện sử dụng lại token. Phiên đăng nhập đã bị thu hồi.",
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Người dùng không tồn tại",
            });
        }

        const newAccessToken = jwt.sign(
            { id: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { id: user._id.toString() },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: currentSession.remember ? "7d" : "1h" }
        );

        const newAccessExp = new Date(Date.now() + 15 * 60 * 1000);
        const newRefreshExp = currentSession.remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        currentSession.refreshToken = newRefreshToken;
        currentSession.accessTokenExpiresAt = newAccessExp;
        currentSession.refreshTokenExpiresAt = newRefreshExp;
        await currentSession.save();

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.APP_MODE === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: currentSession.remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production",
        });

        return res.status(200).json({
            success: true,
            code: "REFRESH_OK",
            message: "Phiên đã được làm mới thành công",
        });
    } catch (error) {
        console.error("Refresh error:", error);

        if (error.name === "TokenExpiredError") {
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });

            return res.status(401).json({
                success: false,
                code: "REFRESH_TOKEN_EXPIRED",
                message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại",
            });
        }

        if (error.name === "JsonWebTokenError") {
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });

            return res.status(401).json({
                success: false,
                code: "INVALID_REFRESH_TOKEN",
                message: "Refresh token không hợp lệ",
            });
        }

        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ",
        });
    }
};

export const logoutSession = async (req, res) => {
    try {
        const currentUser = req.user;
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_SESSION_ID",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const deviceId = req.cookies.deviceId;

        const sessions = await Token.find({ userId: currentUser.id });

        const currentSession = sessions.find(s =>
            s.compareDeviceId(deviceId)
        );

        if (!currentSession) {
            return res.status(401).json({
                success: false,
                code: "INVALID_DEVICEID",
                message: "Thiết bị không hợp lệ."
            });
        }

        if (currentSession._id.toString() === id) {
            return res.status(400).json({
                success: false,
                code: "CANNOT_LOGOUT_CURRENT_SESSION",
                message: "Không thể đăng xuất phiên hiện tại",
            });
        }

        const session = sessions.find(
            s => s._id.toString() === id
        );

        if (!session) {
            return res.status(404).json({
                success: false,
                code: "TARGET_SESSION_NOT_FOUND",
                message: "Phien không tồn tại",
            });
        }

        await session.deleteOne();

        io.to(currentUser.id).emit("sessionLoggedOut", { id });

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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};
