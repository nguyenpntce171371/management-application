import Token from "../models/Token.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { redis } from "../middlewares/rateLimitRedis.js";
import { sendEmail } from "../services/email.service.js";
import axios from "axios";

export const googleCallback = async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) {
            return res.status(400).json({
                success: false,
                code: "NO_CODE",
                message: "Missing authorization code",
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
                message: "No id_token returned from Google",
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
                message: "Google account has no email",
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

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.NODE_ENV === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        return res.redirect(`${process.env.DOMAIN}/`);
    } catch (error) {
        console.log(error);
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
            await Token.deleteOne({ userId: req.user.userId, deviceId: hashedDeviceId });
        }

        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_OK",
            message: "Logged out successfully",
        });
    } catch (e) {
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!",
        });
    }
};

export const logoutAll = async (req, res) => {
    try {
        await Token.deleteMany({ userId: req.user.userId });

        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_ALL_OK",
            message: "Logged out from all devices",
        });
    } catch (e) {
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!",
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
            message: "Sessions fetched successfully",
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
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!"
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
                message: "All fields required",
            });
        }

        const fullNameRegex = /^[A-Za-zÀ-ỹ]+(?:\s[A-Za-zÀ-ỹ]+)+$/;
        if (!fullNameRegex.test(fullName)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_FULLNAME",
                message: "Your fullname is invalid",
            });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Email already registered",
            });
        }

        const verified = await redis.get(`otp_verified:${email}`);
        if (!verified) {
            return res.status(400).json({
                success: false,
                code: "OTP_NOT_VERIFIED",
                message: "Please verify OTP before registering",
            });
        }

        const count = await User.countDocuments();
        const role = (count === 0) ? "Admin" : "User";
        const user = new User({ fullName, email, password, role });
        await user.save();
        await redis.del(`otp_verified:${email}`);

        return res.status(201).json({
            success: true,
            code: "REGISTER_OK",
            message: "Registration successful",
        });

    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!",
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
                message: "Email is required",
            });
        }

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({
                success: false,
                code: "USER_EXISTS",
                message: "Email is already registered",
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashed = crypto.createHash("sha256").update(otp).digest("hex");

        await redis.del(`otp_verified:${email}`);
        await redis.set(`otp:${email}`, hashed, "EX", 300);

        await sendEmail(
            email,
            "Mã OTP đăng ký tài khoản",
            `Mã OTP của bạn là: ${otp}\nHiệu lực 5 phút.`
        );

        return res.json({
            success: true,
            code: "OTP_SENT",
            message: "OTP sent",
        });
    } catch (err) {
        console.error("sendOtpRegister error:", err);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Could not send OTP",
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
                message: "Email and OTP required",
            });
        }

        const stored = await redis.get(`otp:${email}`);
        if (!stored) {
            return res.status(400).json({
                success: false,
                code: "OTP_EXPIRED",
                message: "OTP expired or not found",
            });
        }

        const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
        if (hashedInput !== stored) {
            return res.status(400).json({
                success: false,
                code: "OTP_INVALID",
                message: "Invalid OTP",
            });
        }

        await redis.del(`otp:${email}`);
        await redis.set(`otp_verified:${email}`, "true", "EX", 600);

        return res.json({
            success: true,
            code: "OTP_OK",
            message: "OTP verified",
        });

    } catch (err) {
        console.error("verifyOtpRegister error:", err);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Could not verify OTP",
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
                message: "All fields are required",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.warn(`[Login Warning] Unknown email: ${email}`);
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Invalid credentials",
            });
        }

        const validPassword = await user.comparePassword(password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Invalid credentials",
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

        res.cookie("deviceId", rawDeviceId, {
            httpOnly: true,
            sameSite: "Lax",
            expires: new Date("9999-12-31"),
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: process.env.NODE_ENV === "production" ? 15 * 60 * 1000 : 10 * 365 * 24 * 60 * 60 * 1000,
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "Lax",
            maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            // secure: process.env.NODE_ENV === "production",
            secure: false,
        });

        return res.status(200).json({
            success: true,
            code: "LOGIN_OK",
            message: "Login successful",
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!",
        });
    }
};

export const refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            code: "NO_REFRESH_TOKEN",
            message: "No refresh token provided",
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                code: "NO_DEVICE_ID",
                message: "Missing device identifier",
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
                message: "Potential token reuse detected. All sessions revoked.",
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
                message: "Token reuse detected. All sessions revoked.",
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
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
            message: "Refresh successful",
        });
    } catch (error) {
        console.error("Refresh error:", error);
        return res.status(401).json({
            success: false,
            code: "INVALID_REFRESH",
            message: "Invalid or expired refresh token",
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
                message: "Session id is required",
            });
        }

        const deviceId = req.cookies.deviceId;
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                code: "NO_DEVICE_ID",
                message: "Missing device identifier",
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
                message: "Cannot logout the current session here",
            });
        }

        const session = await Token.findOne({ _id: sessionId, userId: req.user.userId });
        if (!session) {
            return res.status(404).json({
                success: false,
                code: "SESSION_NOT_FOUND",
                message: "Session not found",
            });
        }

        await Token.deleteOne({ _id: sessionId });

        return res.status(200).json({
            success: true,
            code: "LOGOUT_SESSION_OK",
            message: "Session logged out successfully",
        });
    } catch (error) {
        console.error("logoutSession error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong!",
        });
    }
};
