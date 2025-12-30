import crypto from "crypto";
import { redis } from "./rateLimitRedis.js";

export const singleFlightLock = (ttlSeconds = 5) => {
    return async (req, res, next) => {
        try {
            const identity = req.user?.userId || hashIdentity(`ip:${req.ip}`);
            const lockKey = `lock:${identity}`;

            const ttlMs = Math.ceil(ttlSeconds * 1000);
            const acquired = await redis.set(lockKey, "1", "NX", "PX", ttlMs);

            if (!acquired) {
                return res.status(429).json({
                    success: false,
                    code: "TOO_MANY_PARALLEL_REQUESTS",
                    message: "Please wait for previous request to finish."
                });
            }

            res.on("finish", () => {
                redis.del(lockKey).catch(() => { });
            });

            next();
        } catch (err) {
            console.error("Lock error:", err);
            next();
        }
    };
};

function hashIdentity(identity) {
    return crypto.createHash("sha256").update(identity).digest("hex");
}