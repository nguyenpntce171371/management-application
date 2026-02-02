import { io } from "../index.js";
import User from "../models/User.js";
import NodeCache from "node-cache";
import { normalize } from "../utils/string.js";
import { uploadMultipleImages, deleteMultipleImages, generatePresignedUrl } from "../services/storage.service.js";

const imageUrlCache = new NodeCache({
    stdTTL: 1800,
    checkperiod: 600,
    useClones: false,
    maxKeys: 10000
});

const getCachedImageUrl = async (imagePath) => {
    if (!(imagePath && !imagePath.startsWith("http"))) return imagePath;

    const cachedUrl = imageUrlCache.get(imagePath);
    if (cachedUrl) return cachedUrl;

    try {
        const url = await generatePresignedUrl(imagePath, 30);
        imageUrlCache.set(imagePath, url);
        return url;
    } catch (error) {
        console.error(`Failed to generate URL for ${imagePath}:`, error);
        return null;
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
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
                userId: user._id.toString(),
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

export const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        const { fullName, address } = req.body;
        const updateData = {};
        let hasChange = false;

        if (fullName !== undefined && fullName !== user.fullName) {
            updateData.fullName = fullName;
            hasChange = true;
        }

        if (address !== undefined && address !== user.address) {
            updateData.address = address;
            hasChange = true;
        }

        if (req.file) {
            const [avatarPath] = await uploadMultipleImages([req.file], "avatars");

            if (user.avatar) {
                await deleteMultipleImages([user.avatar]);
            }

            updateData.avatar = avatarPath;
            hasChange = true;
        }

        if (!hasChange) {
            return res.status(200).json({
                success: true,
                code: "NO_CHANGES",
                message: "Không có thay đổi nào được thực hiện",
                data: user
            });
        }

        Object.assign(user, updateData);
        await user.save();

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        io.to(user._id.toString()).emit("profileUpdated", {
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            address: user.address,
            avatar: avatarUrl
        });

        io.to("Admin").emit("userUpdated", {
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            address: user.address,
            avatar: avatarUrl
        });

        return res.status(200).json({
            success: true,
            code: "USER_UPDATED",
            message: "Cập nhật hồ sơ người dùng thành công",
            data: {
                id: user._id,
                fullName: user.fullName,
                address: user.address,
                email: user.email,
                avatar: avatarUrl,
                role: user.role
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
        const user = await User.findById(req.user.id);

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
            await deleteMultipleImages([avatarPath]);
            imageUrlCache.del(avatarPath);
        }

        user.avatar = null;
        await user.save();

        io.to(user._id).emit("profileUpdated", {
            id: user.userId,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            address: user.address,
            avatar: null
        });

        return res.status(200).json({
            success: true,
            code: "AVATAR_DELETED",
            message: "Xóa avatar thành công",
            data: {
                id: user._id,
                fullName: user.fullName,
                address: user.address,
                email: user.email,
                avatar: null,
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

        io.to(updatedUser._id.toString()).emit("roleUpdated");
        io.to("Admin").emit("userRoleChanged", {
            userId: updatedUser._id.toString(),
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
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
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
            query.$or = [
                { fullNameSearch: { $regex: normalizedSearch, $options: "i" } },
                { addressSearch: { $regex: normalizedSearch, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        if (role !== "all") {
            query.role = role;
        }

        const data = await User.find(query, "fullName email role address _id createdAt avatar").sort({ [sortBy]: sortOrder, _id: sortOrder }).skip(skip).limit(limit).lean();;
        const users = data.map(({ _id, ...rest }) => ({
            id: _id.toString(),
            ...rest,
        }));
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
            data: users,
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

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(req.user.id);
        const userToDelete = await User.findOne({ _id: id, deletedAt: null });

        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng",
            });
        }

        if (currentUser.role !== "Admin" && !user.equals(userToDelete)) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: "Quyền truy cập không đủ.",
            });
        }

        await userToDelete.softDelete(userToDelete._id);

        io.to(userToDelete._id.toString()).emit("accountDeleted", { _id: userToDelete._id });
        io.to("Admin").emit("userDeleted", {
            id: userToDelete._id,
            email: userToDelete.email,
            role: userToDelete.role
        });

        return res.status(200).json({
            success: true,
            code: "USER_DELETED",
            message: `User ${userToDelete.email} has been deleted successfully`,
            data: {
                id: userToDelete._id,
                email: userToDelete.email,
                role: userToDelete.role,
            },
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const deletedUsers = await User.findDeleted()
            .select("fullName email role deletedAt deletedBy")
            .populate("deletedBy", "fullName email")
            .sort({ deletedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments({ deletedAt: { $ne: null } });

        return res.status(200).json({
            success: true,
            code: "DELETED_USERS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: deletedUsers,
        });
    } catch (error) {
        console.error("Error fetching deleted users:", error);
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

        const user = await User.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }

        await user.restore();

        io.to("Admin").emit("userRestored", {
            userId: user._id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            success: true,
            code: "USER_RESTORED",
            message: "Khôi phục người dùng thành công",
            data: {
                id: user._id,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Error restoring user:", error);
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

        const user = await User.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "Không tìm thấy người dùng đã xóa",
            });
        }

        await user.deleteOne();

        return res.status(200).json({
            success: true,
            code: "USER_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn người dùng thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting user:", error);
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

