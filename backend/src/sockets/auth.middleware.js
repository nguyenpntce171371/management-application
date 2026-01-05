import jwt from "jsonwebtoken";
import cookie from "cookie";
import crypto from "crypto";
import Token from "../models/Token.js";

export const socketAuthMiddleware = () => {
    return async (socket, next) => {
        try {
            const rawCookie = socket.handshake.headers.cookie;
            if (!rawCookie) {
                return next(new Error("NO_COOKIE"));
            }

            const cookies = cookie.parse(rawCookie);
            const accessToken = cookies.accessToken;
            const refreshToken = cookies.refreshToken;
            const deviceId = cookies.deviceId;

            if (!accessToken) {
                return next(new Error(refreshToken ? "TOKEN_EXPIRED" : "NO_TOKEN"));
            }

            let decoded;
            try {
                decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
            } catch (err) {
                return next(new Error("INVALID_TOKEN"));
            }

            if (!deviceId) {
                return next(new Error("DEVICE_ID_MISSING"));
            }

            const hashedDeviceId = crypto.createHash("sha256").update(deviceId).digest("hex");

            const tokenRecord = await Token.findOne({
                userId: decoded.userId,
                deviceId: hashedDeviceId,
            });

            if (!tokenRecord) {
                return next(new Error("TOKEN_NOT_FOUND"));
            }

            if (!tokenRecord.compareDeviceId(deviceId)) {
                return next(new Error("INVALID_DEVICE"));
            }

            if (new Date() > tokenRecord.accessTokenExpiresAt) {
                return next(new Error("TOKEN_EXPIRED"));
            }

            socket.user = {
                userId: decoded.userId,
                role: decoded.role
            };
            socket.deviceId = hashedDeviceId;

            next();
        } catch (err) {
            return next(new Error("SERVER_ERROR"));
        }
    };
};