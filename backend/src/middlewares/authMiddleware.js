import jwt from "jsonwebtoken";
import Token from "../models/Token.js";
import { Role } from "../config/role.js";

export const verify = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const accessToken = req.cookies.accessToken;
            const refreshToken = req.cookies.refreshToken;
            if (!accessToken) {
                return res.status(401).json({
                    success: false,
                    code: refreshToken ? "TOKEN_EXPIRED" : "NO_TOKEN",
                    message: refreshToken ? "Phiên làm việc đã hết hạn." : "Không có token được cung cấp.",
                });
            }
            const deviceId = req.cookies.deviceId;
            if (!deviceId) {
                return res.status(401).json({
                    success: false,
                    code: "DEVICE_ID_MISSING",
                    message: "Thiết bị không được nhận dạng.",
                });
            }

            const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
            req.user = decoded;

            if (requiredRole) {
                const userLevel = Role[decoded.role?.toUpperCase()] ?? 0;
                const requiredLevel = Role[requiredRole?.toUpperCase()] ?? 999;

                if (userLevel < requiredLevel) {
                    return res.status(403).json({
                        success: false,
                        code: "FORBIDDEN",
                        message: "Quyền truy cập không đủ.",
                    });
                }
            }

            const now = Math.floor(Date.now() / 1000);
            const ttl = typeof decoded.exp === "number" ? decoded.exp - now : 0;

            if (ttl <= 0) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_EXPIRED",
                    message: "Phiên làm việc đã hết hạn.",
                });
            } else {
                const hashedDeviceId = Token.hashValue(deviceId);
                const session = await Token.findOne({ userId: decoded.id, deviceId: hashedDeviceId, accessTokenExpiresAt: { $gt: new Date() } });
                if (!session) {
                    return res.status(401).json({
                        success: false,
                        code: "SESSION_REVOKED",
                        message: "Phiên đăng nhập đã bị thu hồi.",
                    });
                } else {
                    req.session = {
                        id: session._id,
                        deviceId: session.deviceId
                    };
                }
            }

            return next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_EXPIRED",
                    message: "Phiên làm việc đã hết hạn.",
                });
            }

            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    success: false,
                    code: "INVALID_TOKEN",
                    message: "Token không hợp lệ.",
                });
            }

            console.error("Verify middleware error:", error);
            return res.status(500).json({
                success: false,
                code: "SERVER_ERROR",
                message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    };
};
