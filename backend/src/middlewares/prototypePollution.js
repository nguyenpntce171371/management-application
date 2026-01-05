export const prototypePollutionMiddleware = (req, res, next) => {
    const checkForPollution = (obj, path = "") => {
        if (!obj || typeof obj !== "object") return false;

        const dangerousKeys = ["__proto__", "constructor", "prototype"];
        for (const key of Object.keys(obj)) {
            if (dangerousKeys.includes(key)) {
                console.error(
                    `🚨 [Security] Prototype pollution attempt detected from ${req.ip} at ${path}.${key}`
                );
                return true;
            }
            if (typeof obj[key] === "object" && obj[key] !== null) {
                if (checkForPollution(obj[key], `${path}.${key}`)) return true;
            }
        }
        return false;
    };

    if (
        checkForPollution(req.body, "body") ||
        checkForPollution(req.query, "query") ||
        checkForPollution(req.params, "params")
    ) {
        return res.status(400).json({
            success: false,
            code: "FORBIDDEN_INPUT",
            message: "Dữ liệu đầu vào không hợp lệ.",
        });
    }

    next();
};
