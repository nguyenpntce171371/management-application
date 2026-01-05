import Log from "../models/Log.js";
import User from "../models/User.js";
import { io } from "../index.js";

export const updateUserRole = async (req, res) => {
    try {
        let { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const validRoles = ["User", "Staff", "Admin"];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ROLE",
                message: "Vai trò không hợp lệ",
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email: email },
            { $set: { role: role } },
            { new: true }
        ).lean();

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }

        const sessions = await Token.find({ userId: updatedUser._id });
        const sessionIds = sessions.map(s => s._id);
        await Token.deleteMany({ userId: updatedUser._id });

        io.to(updatedUser._id).emit("roleUpdated", { sessionIds });
        io.to("Admin").emit("userRoleChanged", {
            userId: updatedUser._id,
            email: updatedUser.email,
            role: role
        });

        return res.status(200).json({
            success: true,
            code: "ROLE_UPDATED",
            message: "Cập nhật vai trò thành công",
            data: {
                id: updatedUser._id,
                email: updatedUser.email,
                role: updatedUser.role,
            },
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = (req.query.search || "").trim();
        const role = req.query.role || "all";
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const query = {};

        if (search) {
            const normalizedSearch = normalize(search);
            query.$text = { $search: normalizedSearch };
        }

        if (role !== "all") {
            query.role = role;
        }

        const data = await User.find(query, "fullName email role _id createdAt avatar").sort({ [sortBy]: sortOrder, _id: sortOrder }).skip(skip).limit(limit);

        const total = await User.countDocuments(query);

        return res.status(200).json({
            success: true,
            code: "USERS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data,
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

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

export const deleteUser = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                code: "MISSING_EMAIL",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        if (req.user.email === email) {
            return res.status(403).json({
                success: false,
                code: "CANNOT_DELETE_SELF",
                message: "Bạn không thể xóa chính mình.",
            });
        }

        const deletedUser = await User.findOneAndDelete({ email }).lean();

        io.to(deletedUser._id).emit("accountDeleted", { deletedUser });
        io.to("Admin").emit("userDeleted", {
            userId: deletedUser._id,
            email: deletedUser.email,
            role: deletedUser.role
        });

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng",
            });
        }

        return res.status(200).json({
            success: true,
            code: "USER_DELETED",
            message: `User ${email} has been deleted successfully`,
            data: {
                id: deletedUser._id,
                email: deletedUser.email,
                role: deletedUser.role,
            },
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        return res.status(200).json({
            success: true,
            code: "USER_STATS_FETCHED",
            data: totalUsers
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};