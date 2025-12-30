import { logEvent } from "../services/log.service.js";

export const loggingMiddleware = (req, res, next) => {
    const oldJson = res.json;
    let responseBody = null;

    res.json = function (body) {
        responseBody = body;
        return oldJson.call(this, body);
    };
    res.on("finish", async () => {
        try {
            if (req.originalUrl.split("?")[0] === "/api/user") return;
            if (req.originalUrl.split("?")[0] === "/api/auth/refresh-token") return;
            if (req.originalUrl.split("?")[0] === "/api/staff/convert-address") return;
            if (req.method === "GET" && (res.statusCode === 200 || res.statusCode === 304)) return;
            if (responseBody?.code === "TOKEN_EXPIRED") return;
            const user = req.user || {};
            await logEvent({
                userId: user.userId,
                email: user.email,
                role: user.role,
                userAgent: req.headers["user-agent"] || "Unknown",
                ipAddress: req.ip,
                method: req.method,
                endpoint: req.originalUrl,
                statusCode: res.statusCode,
                referrer: req.headers["referer"] || "",
                message: responseBody?.message || `Response ${res.statusCode}`,
            });
        } catch (err) {
            console.error("Logging middleware error:", err.message);
        }
    });

    next();
};
