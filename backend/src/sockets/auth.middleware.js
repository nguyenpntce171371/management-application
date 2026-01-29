import jwt from "jsonwebtoken";
import cookie from "cookie";
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

            const sessions = await Token.find({ userId: decoded.id });
            const session = sessions.find(s => s.compareDeviceId(deviceId));

            if (!session) {
                return next(new Error("TOKEN_NOT_FOUND"));
            }

            if (new Date() > session.accessTokenExpiresAt) {
                return next(new Error("TOKEN_EXPIRED"));
            }

            socket.user = {
                id: decoded.id,
                role: decoded.role
            };
            socket.deviceId = deviceId;

            next();
        } catch (err) {
            console.log(err);
            return next(new Error("SERVER_ERROR"));
        }
    };
};