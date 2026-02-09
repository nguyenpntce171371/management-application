import { io } from "../index.js";
import User from "../models/User.js";
import { normalize } from "../utils/string.js";
import { uploadMultipleImages, deleteImage, deleteMultipleImages } from "../services/storage.service.js";
import { getCachedImageUrl } from "../utils/cachedImage.js";
import Token from "../models/Token.js";
import { parseSort } from "../utils/query.js";
import { executeCursorPaginatedQuery } from "../utils/query.js";
import { transformIds } from "../utils/normalizeMongoIds.js";

export const getUser = async (req, res) => {
    try {
        const id = req.user.id;
        const sessionId = req.session.id;
        const user = await User.findById(id).select({ email: 1, role: 1, fullName: 1, address: 1, avatar: 1, provider: 1 }).lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "USER_FETCHED",
            data: {
                id,
                sessionId,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                address: user.address,
                avatar: avatarUrl,
                provider: user.provider
            }
        });
    } catch (error) {
        console.error("Get user error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getUsers = async (req, res) => {
    try {
        const baseQuery = {};

        if (req.query.role && req.query.role !== "all") {
            baseQuery.role = req.query.role;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["createdAt"]);
        const options = {
            select: "fullName email address role",
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(User, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "USER_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(data)
        });
    } catch (error) {
        console.error("Get User Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedUsers = async (req, res) => {
    try {
        const baseQuery = { deletedAt: { $ne: null } };

        if (req.query.role && req.query.role !== "all") {
            baseQuery.role = req.query.role;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["createdAt"]);
        const options = {
            select: "fullName email address role deletedAt",
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            populate: {
                path: "deletedBy",
                select: "fullName"
            },
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(User, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "DELETED_USER_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(data)
        });
    } catch (error) {
        console.error("Get User Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_USER_ID",
                message: "Thiếu User Id"
            });
        }

        const user = await User.findById(id).lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy bản ghi"
            });
        }

        return res.status(200).json({
            success: true,
            code: "USER_FOUND",
            data: transformIds(user)
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
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

export const updateUserProfile = async (req, res) => {
    try {
        const id = req.user.id;
        const sessionId = req.session.id;

        const { fullName: rawFullName, address } = req.body;

        const update = {};
        let avatarPath;

        if (rawFullName !== undefined) {
            const fullName = rawFullName.trim();
            if (fullName) {
                update.fullName = fullName;
            }
        }

        if (address !== undefined) {
            update.address = address;
        }

        if (req.file) {
            [avatarPath] = await uploadMultipleImages([req.file], "avatars");
            update.avatar = avatarPath;
        }

        if (!Object.keys(update).length) {
            return res.status(200).json({
                success: true,
                code: "NO_CHANGES",
                message: "Không có thay đổi nào"
            });
        }

        const result = await User.updateOne(
            { _id: id },
            { $set: update }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }

        if (avatarPath) {
            const user = await User.findById(id).select({ avatar: 1 }).lean();
            if (user?.avatar && user.avatar !== avatarPath) {
                await deleteMultipleImages([user.avatar]);
            }
        }

        const avatarUrl = await getCachedImageUrl(update.avatar);

        io.to(id).emit("profileUpdated");
        io.to("Admin").emit("userUpdated");

        return res.status(200).json({
            success: true,
            code: "USER_UPDATED",
            message: "Cập nhật hồ sơ người dùng thành công",
            data: {
                id,
                sessionId,
                fullName: update.fullName,
                address: update.address,
                avatar: avatarUrl
            }
        });
    } catch (error) {
        console.error("Update User Profile Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteUserAvatar = async (req, res) => {
    try {
        const id = req.user.id;
        const sessionId = req.session.id;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }

        if (!user.avatar) {
            return res.status(400).json({
                success: false,
                code: "NO_AVATAR",
                message: "Không có avatar để xóa"
            });
        }

        const avatarPath = user.avatar;

        if (avatarPath && !avatarPath.startsWith("http")) {
            await deleteImage([avatarPath]);
        }

        user.avatar = null;
        await user.save();

        io.to(id).emit("profileUpdated");

        return res.status(200).json({
            success: true,
            code: "AVATAR_DELETED",
            message: "Xóa avatar thành công",
            data: {
                id,
                sessionId,
                fullName: user.fullName,
                address: user.address,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Delete Avatar Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const updateUserRole = async (req, res) => {
    try {
        const { id, role } = req.body;
        if (!id || !role) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Các trường bắt buộc bị thiếu",
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: id, role: { $ne: role } },
            { $set: { role: role } },
            { new: true, runValidators: true }
        ).select({ email: 1 }).lean();

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND_OR_NO_CHANGE",
                message: "User không tồn tại hoặc vai trò không đổi"
            });
        }

        await Token.deleteMany({ userId: id });

        io.to(id).emit("usergedOut");
        io.to("Admin").emit("userUpdated");

        return res.status(200).json({
            success: true,
            code: "ROLE_UPDATED",
            message: "Cập nhật vai trò thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error fetching user stats:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND_OR_NO_CHANGE",
                message: "User không tồn tại hoặc vai trò không đổi"
            });
        } else if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                code: "INVALID_ROLE",
                message: "Vai trò không hợp lệ"
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_USER_ID",
                message: "Thiếu User Id"
            });
        }

        if (req.user.role !== "Admin" && req.user.id !== id) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: "Không được phép"
            });
        }

        const result = await User.updateOne(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user.id } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }

        io.to(id).emit("accountDeleted");
        io.to("Admin").emit("userDeleted");

        return res.status(200).json({
            success: true,
            code: "USER_DELETED",
            message: `Xóa tài khoản thành công`,
            data: { id }
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng"
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_USER_ID",
                message: "Thiếu User Id"
            });
        }

        const result = await User.updateOne(
            { _id: id, deletedAt: { $ne: null } },
            { $set: { deletedAt: null, deletedBy: null } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }

        io.to("Admin").emit("userRestored");

        return res.status(200).json({
            success: true,
            code: "USER_RESTORED",
            message: "Khôi phục người dùng thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error restoring user:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const permanentDeleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_USER_ID",
                message: "Thiếu User Id"
            });
        }

        const result = await User.deleteOne({ _id: id, deletedAt: { $ne: null } });
        if (!result.deletedCount) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }

        io.to("Admin").emit("userPermanentlyDeleted");

        return res.status(200).json({
            success: true,
            code: "USER_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn người dùng thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting user:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

