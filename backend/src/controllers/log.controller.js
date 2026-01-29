import Log from "../models/Log.js";

function normalize(str) {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

export const getLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const method = req.query.method || "all";
        const statusCode = req.query.statusCode || "all";
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const query = {};
        if (search.trim()) {
            const normalizedSearch = normalize(search);
            query.$text = { $search: normalizedSearch };
        }

        if (method !== "all") {
            query.method = method;
        }

        if (statusCode !== "all") {
            query.statusCode = parseInt(statusCode);
        }

        const data = await Log
            .find(query)
            .populate("userId", "email role")
            .sort({ [sortBy]: sortOrder, _id: sortOrder })
            .skip(skip)
            .limit(limit);

        const total = await Log.countDocuments(query);

        return res.status(200).json({
            success: true,
            code: "LOGS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            },
            data,
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};