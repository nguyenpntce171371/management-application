import jwt from "jsonwebtoken";
import Token from "../models/Token.js";
import { Role } from "../config/role.js";
import crypto from "crypto";

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

            const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
            req.user = decoded;

            const deviceId = req.cookies.deviceId;
            if (!deviceId) {
                return res.status(401).json({
                    success: false,
                    code: "DEVICE_ID_MISSING",
                    message: "Thiết bị không được nhận dạng.",
                });
            }

            const sessions = await Token.find({ userId: req.user.id });
            const session = sessions.find(s => s.compareDeviceId(deviceId));

            if (!session) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_NOT_FOUND",
                    message: "Phiên không tồn tại.",
                });
            }

            if (new Date() > session.accessTokenExpiresAt) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_EXPIRED",
                    message: "Phiên làm việc đã hết hạn.",
                });
            }

            const userRoleLevel = Role[req.user.role?.toUpperCase()] ?? 0;
            const requiredRoleLevel = Role[requiredRole?.toUpperCase()] ?? 999;

            if (userRoleLevel < requiredRoleLevel) {
                return res.status(403).json({
                    success: false,
                    code: "FORBIDDEN",
                    message: "Quyền truy cập không đủ.",
                });
            }

            return next();
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    code: "TOKEN_EXPIRED",
                    message: "Phiên làm việc đã hết hạn.",
                });
            }

            if (err instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    success: false,
                    code: "INVALID_TOKEN",
                    message: "Token không hợp lệ.",
                });
            }

            console.error("Verify middleware error:", err);
            return res.status(500).json({
                success: false,
                code: "SERVER_ERROR",
                message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
            });
        }
    };
};
