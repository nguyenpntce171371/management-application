import Redis from "ioredis";
import crypto from "crypto";

export const redis = new Redis(`redis://:${process.env.REDIS_PASSWORD}@redis-${process.env.NODE_ENV}:6379/0`);
redis.on("error", (err) => console.error("Redis Client Error:", err));

export const rateLimitRedis = (maxRequests, windowSeconds, identityType = "ip") => {
    return async (req, res, next) => {
        try {
            const identity = resolveIdentity(req, identityType);
            if (!identity)
                return res.status(400).json({ success: false, message: "Missing identity" });

            const key = `ratelimit:${identity}`;
            const pipeline = redis.pipeline();

            pipeline.incr(key);
            pipeline.expire(key, windowSeconds);
            pipeline.ttl(key);

            const result = await pipeline.exec();

            const count = result[0][1];
            const ttl = result[2][1];

            if (count > maxRequests) {
                return res.status(429).json({
                    success: false,
                    message: "Too many requests",
                    retryAfter: ttl,
                    limit: maxRequests,
                    window: windowSeconds
                });
            }

            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));
            res.setHeader("X-RateLimit-Reset", Date.now() + ttl * 1000);

            next();
        } catch (err) {
            console.error("RateLimit error:", err);
            next();
        }
    };
};

function resolveIdentity(req, type) {
    const ip = req.ip || req.headers["x-real-ip"];
    const deviceId = req.headers["x-device-id"] || req.body?.deviceId;
    const email = req.body?.email;
    const userId = req.user?.userId;

    switch (type) {
        case "email":
            return email ? hash(`email:${email}`) : null;

        case "user":
            return userId ? hash(`user:${userId}`) : null;

        case "device":
            return deviceId ? hash(`device:${deviceId}`) : hash(`ip:${ip}`);

        case "both":
            return hash(`device:${deviceId || "none"}|ip:${ip}`);

        case "ip":
        default:
            return hash(`ip:${ip}`);
    }
}

function hash(str) {
    return crypto.createHash("sha256").update(str).digest("hex");
}