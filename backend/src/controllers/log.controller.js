import Log from "../models/Log.js";
import { transformIds } from "../utils/normalizeMongoIds.js";
import { parseSort, executeCursorPaginatedQuery } from "../utils/query.js";
import { normalize } from "../utils/string.js";

export const getLogs = async (req, res) => {
    try {
        const baseQuery = {};

        if (req.query.method && req.query.method !== "all") {
            baseQuery.method = req.query.method;
        }

        if (req.query.statusCode && req.query.statusCode !== "all") {
            baseQuery.statusCode = req.query.statusCode;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.searchText = { $regex: searchText, $options: "i" };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["createdAt"]);
        const options = {
            select: "method endpoint statusCode message email role userAgent ipAddress referrer createdAt searchText",
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(Log, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "LOG_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(data)
        });
    } catch (error) {
        console.error("Get Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getLogById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_LOG_ID",
                message: "Thiếu Log Id"
            });
        }

        const log = await Log.findById(id).lean();

        if (!log) {
            return res.status(404).json({
                success: false,
                code: "LOG_NOT_FOUND",
                message: "Không tìm thấy bản ghi"
            });
        }

        return res.status(200).json({
            success: true,
            code: "LOG_FOUND",
            data: transformIds(log)
        });
    } catch (error) {
        console.error("Error fetching log:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "LOG_NOT_FOUND",
                message: "Không tìm thấy bản ghi"
            });
        }
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};