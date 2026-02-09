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
            if (!refreshToken) {
                return next(new Error("REFRESH_TOKEN_MISSING"));
            }
            const hashedRefreshToken = Token.hashValue(refreshToken);
            const deviceId = cookies.deviceId;
            if (!deviceId) {
                return next(new Error("DEVICE_ID_MISSING"));
            }
            const hashedDeviceId = Token.hashValue(deviceId);

            if (!accessToken) {
                return next(new Error(refreshToken ? "TOKEN_EXPIRED" : "NO_TOKEN"));
            }

            let decoded;
            try {
                decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
            } catch (error) {
                return next(new Error("INVALID_TOKEN"));
            }

            if (!deviceId) {
                return next(new Error("DEVICE_ID_MISSING"));
            }

            const session = await Token.findOne(
                { userId: decoded.id, deviceId: hashedDeviceId, refreshToken: hashedRefreshToken }
            ).select({ _id: 1, accessTokenExpiresAt: 1 }).lean();

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
            socket.session = {
                id: session._id.toString(),
                deviceId: hashedDeviceId
            };

            next();
        } catch (error) {
            console.log(error);
            return next(new Error("SERVER_ERROR"));
        }
    };
};