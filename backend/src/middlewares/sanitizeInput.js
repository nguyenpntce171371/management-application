export const sanitizeInputMiddleware = (req, res, next) => {
    const sanitize = (obj) => {
        if (!obj || typeof obj !== "object") return;

        const dangerousOps = [
            "$where", "$regex", "$gt", "$gte", "$lt", "$lte",
            "$ne", "$in", "$nin", "$or", "$and", "$not",
            "$nor", "$exists", "$type", "$expr", "$jsonSchema",
            "$mod", "$text", "$search", "$all", "$elemMatch",
            "$size", "$comment", "$meta"
        ];

        for (const key of Object.keys(obj)) {
            if (dangerousOps.includes(key)) {
                console.warn(`⚠️ Blocked operator "${key}" from ${req.ip}`);
                delete obj[key];
                continue;
            }

            const value = obj[key];
            if (typeof value === "object" && value !== null) {
                sanitize(value);
            } else if (typeof value === "string") {
                obj[key] = value.replace(/\0/g, "").slice(0, 10000);
            }
        }
    };

    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
};
