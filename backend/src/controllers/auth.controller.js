import Token from "../models/Token.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendOTPRegisterEmail } from "../services/email.service.js";
import axios from "axios";
import { io } from "../index.js";
import { OAuth2Client } from "google-auth-library";
import { getCachedImageUrl } from "../utils/cachedImage.js";
import { transformIds } from "../utils/normalizeMongoIds.js";
import { clearVerified, create, verify, isVerified } from "../services/otp.service.js";

export const googleCallback = async (req, res) => {
    const DOMAIN = `https://${process.env.DOMAIN}`;
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

        const email = payload.email.trim().toLowerCase();
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

        let user = await User.findOne({ email, deletedAt: { $exists: true } });
        if (!user) {
            const count = await User.countDocuments();
            const role = count === 0 ? "Admin" : "User";

            user = new User({ fullName, email, provider: "google", providerId, avatar, role });
        } else {
            if (user.deletedAt) {
                return res.status(401).json({
                    success: false,
                    code: "INVALID_CREDENTIALS",
                    message: "Thông tin đăng nhập không hợp lệ"
                });
            }
            if (!user.providerId) {
                user.providerId = providerId;
            }
            if (!user.avatar) {
                user.avatar = avatar
            }
        }
        await user.save();
        const id = user._id.toString();
        const rawDeviceId = req.cookies.deviceId || crypto.randomUUID();
        const deviceName = req.headers["user-agent"] || "Unknown device";
        const accessToken = jwt.sign(
            { id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);
        const remember = true;
        const refreshToken = remember ? jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });
        const refreshExp = remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        const session = await Token.findOneAndUpdate({
            userId: user._id,
            deviceId: Token.hashValue(rawDeviceId)
        }, {
            $set: {
                refreshToken: Token.hashValue(refreshToken),
                accessTokenExpiresAt: accessExp,
                refreshTokenExpiresAt: refreshExp,
                deviceName,
                ipAddress: req.ip || "",
                remember,
            },
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        });

        io.to(id).emit("loggedInElsewhere");

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
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
    const DOMAIN = `https://${process.env.DOMAIN}`;
    const redirectUri = encodeURIComponent(`${DOMAIN}/api/auth/google/callback`);
    const scope = encodeURIComponent("openid email profile");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    return res.redirect(url);
};

export const login = async (req, res) => {
    try {
        const { password, remember } = req.body;
        const email = req.body.email.trim().toLowerCase();

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu"
            });
        }

        const user = await User.findOne({ email }).select({ email: 1, password: 1, role: 1, fullName: 1, address: 1, avatar: 1, provider: 1 });
        if (!user) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ"
            });
        }

        const isMatch = user.provider !== "local" ? false : await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Thông tin đăng nhập không hợp lệ"
            });
        }

        const id = user._id.toString();

        const accessToken = jwt.sign(
            { id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        const accessExp = new Date(Date.now() + 15 * 60 * 1000);

        const refreshToken = remember ? jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" }) : jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1h" });

        const refreshExp = remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        const rawDeviceId = req.cookies.deviceId || crypto.randomUUID();
        const deviceName = req.headers["user-agent"] || "Unknown device";

        const session = await Token.findOneAndUpdate({
            userId: user._id,
            deviceId: Token.hashValue(rawDeviceId),
        }, {
            $set: {
                refreshToken: Token.hashValue(refreshToken),
                accessTokenExpiresAt: accessExp,
                refreshTokenExpiresAt: refreshExp,
                deviceName,
                ipAddress: req.ip || "",
                remember
            },
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        io.to(id).emit("loggedInElsewhere");

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production"
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.APP_MODE === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production"
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production"
        });

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        const processedData = transformIds({
            id: user._id,
            sessionId: session._id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            address: user.address,
            avatar: avatarUrl,
            provider: user.provider
        });

        if (processedData.avatar && !processedData.avatar.startsWith("http")) {
            processedData.avatar = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "LOGIN_OK",
            message: "Đăng nhập thành công",
            data: processedData
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

export const register = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
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

        const verified = await isVerified(email, "register");
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Hãy xác minh mã OTP trước khi đăng ký",
            });
        }
        clearVerified(email, "register");
        const count = await User.countDocuments();
        const role = (count === 0) ? "Admin" : "User";
        const user = new User({ fullName, email: email.trim().toLowerCase(), role });
        user.password = await User.hashPassword(password);
        await user.save();

        io.to("Admin").emit("newUserRegistered", { id: user._id.toString(), email: user.email, role: user.role });

        return res.status(201).json({
            success: true,
            code: "REGISTER_OK",
            message: "Đăng ký thành công",
        });
    } catch (error) {
        console.error("Register error:", error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Người dùng này đã tồn tại",
            });
        }

        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const sendOtpRegister = async (req, res) => {
    try {
        const { email: rawEmail } = req.body;
        const email = normalizeEmail(rawEmail);
        if (!email) {
            return res.status(400).json({
                success: false,
                code: "EMAIL_REQUIRED",
                message: "Các trường bắt buộc bị thiếu"
            });
        }

        const exists = await User.exists({ email, deletedAt: { $exists: true } });
        if (exists) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Người dùng này đã tồn tại"
            });
        }

        const { code, expiresIn } = await create(email, "register");

        await sendOTPRegisterEmail(email, code, expiresIn);

        return res.status(200).json({
            success: true,
            code: "OTP_SENT",
            message: "Đã gửi mã OTP"
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
        const { email: rawEmail, otp } = req.body;
        const email = normalizeEmail(rawEmail);
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        await verify(email, otp, "register");

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

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                code: "NO_REFRESH_TOKEN",
                message: "Không có token làm mới."
            });
        }
        let hashedRefreshToken = Token.hashValue(refreshToken);

        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(401).json({
                success: false,
                code: "DEVICE_ID_MISSING",
                message: "Thiết bị không được nhận dạng."
            });
        }
        const hashedDeviceId = Token.hashValue(deviceId);

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const id = decoded.id;

        const session = await Token.findOne({ userId: id, deviceId: hashedDeviceId, refreshToken: hashedRefreshToken });

        if (!session) {
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });
            return res.status(401).json({
                success: false,
                code: "CURRENT_SESSION_NOT_FOUND",
                message: "Phiên đăng nhập không tồn tại hoặc đã bị thu hồi."
            });
        }

        const user = await User.findById(id, { email: 1, role: 1, }).lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Người dùng không tồn tại"
            });
        }

        const newAccessToken = jwt.sign(
            { id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: session.remember ? "7d" : "1h" }
        );
        hashedRefreshToken = Token.hashValue(newRefreshToken);

        const newAccessExp = new Date(Date.now() + 15 * 60 * 1000);
        const newRefreshExp = session.remember ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000);

        session.refreshToken = hashedRefreshToken;
        session.accessTokenExpiresAt = newAccessExp;
        session.refreshTokenExpiresAt = newRefreshExp;
        await session.save();

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.APP_MODE === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production"
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: session.remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            secure: process.env.APP_MODE === "production"
        });

        return res.status(200).json({
            success: true,
            code: "REFRESH_OK",
            message: "Phiên đã được làm mới thành công"
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
                message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"
            });
        }

        if (error.name === "JsonWebTokenError") {
            res.clearCookie("accessToken", { path: "/" });
            res.clearCookie("refreshToken", { path: "/" });
            res.clearCookie("deviceId", { path: "/" });

            return res.status(401).json({
                success: false,
                code: "INVALID_REFRESH_TOKEN",
                message: "Refresh token không hợp lệ"
            });
        }

        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const listSessions = async (req, res) => {
    try {
        const sessions = await Token.find({ userId: req.user.id }).select({ deviceId: 1, deviceName: 1, ipAddress: 1, createdAt: 1, refreshTokenExpiresAt: 1 }).sort({ createdAt: -1 }).lean();

        const processedSessions = transformIds(sessions).map(session => ({ ...session, isCurrent: session.deviceId === req.session.deviceId }));

        return res.status(200).json({
            success: true,
            code: "SESSIONS_OK",
            data: processedSessions
        });
    } catch (error) {
        console.error("List sessions error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ",
        });
    }
};

export const logout = async (req, res) => {
    try {
        const session = await Token.findOneAndDelete({ userId: req.user.id, deviceId: req.session.deviceId });
        if (session) {
            io.to(req.user.id).emit("sessionLoggedOut", [session._id.toString()]);
        }

        res.clearCookie("deviceId");
        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_OK",
            message: "Đăng xuất thành công"
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

export const logoutSession = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_SESSION_ID",
                message: "Các trường bắt buộc bị thiếu"
            });
        }

        const session = await Token.findOneAndDelete({
            _id: id,
            userId: req.user.id,
            deviceId: { $ne: req.session.deviceId }
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                code: "TARGET_SESSION_NOT_FOUND",
                message: "Không thể đăng xuất phiên này"
            });
        }

        io.to(req.user.id).emit("loggedOut", {id});
        io.to(req.user.id).emit("sessionLoggedOut", [id]);

        return res.status(200).json({
            success: true,
            code: "LOGOUT_SESSION_OK",
            message: "Đăng xuất phiên thành công"
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

export const logoutAll = async (req, res) => {
    try {
        const id = req.user.id;
        await Token.deleteMany({ userId: id });

        io.to(id).emit("loggedOut");

        res.clearCookie("deviceId");
        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_ALL_OK",
            message: "Tất cả các phiên đã được đăng xuất thành công"
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