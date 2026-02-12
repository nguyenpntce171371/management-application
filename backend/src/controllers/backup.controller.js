import { io } from "../index.js";
import { redis } from "../middlewares/rateLimitRedis.js";
import Backup from "../models/Backup.js";
import BackupConfig from "../models/BackupConfig.js";
import { backupMongoDB, restoreMongoDB } from "../services/backup.service.js";
import { deleteFile } from "../services/storage.service.js";
import { updateBackupCronJob } from "../utils/cronScheduler.js";
import cron from "node-cron";
import { executeCursorPaginatedQuery } from "../utils/query.js";
import { transformIds } from "../utils/normalizeMongoIds.js";

export const getBackups = async (req, res) => {
    try {
        const baseQuery = {};
        const options = {
            select: "type filename size source createdAt",
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(Backup, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "BACKUP_LIST",
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

export const getDeletedBackups = async (req, res) => {
    try {
        const baseQuery = { deletedAt: { $ne: null } };

        const options = {
            select: "filename size source deletedAt",
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            populate: {
                path: "deletedBy",
                select: "fullName"
            },
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(Backup, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "DELETED_BACKUP_LIST",
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

export const getBackupById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu Backup Id"
            });
        }

        const backup = await Backup.findById(id).lean();

        if (!backup) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy bản ghi"
            });
        }

        return res.status(200).json({
            success: true,
            code: "BACKUP_FOUND",
            data: transformIds(backup)
        });
    } catch (error) {
        console.error("Error fetching backup:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
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

export const createBackup = async (req, res) => {
    try {
        const mongoResult = await backupMongoDB("manual");
        return res.status(200).json({
            success: true,
            code: "BACKUP_CREATED",
            message: "Backup đã được tạo thành công",
            data: transformIds(mongoResult)
        });
    } catch (error) {
        console.error("Error creating backup:", error);
        res.status(500).json({
            success: false,
            code: "BACKUP_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreBackup = async (req, res) => {
    let backupId = null;
    try {
        const locked = await redis.set("system:lock:mongo_restore", "1", "NX", "PX", 30 * 60 * 1000);

        if (!locked) {
            return res.status(409).json({
                success: false,
                code: "RESTORE_LOCKED",
                message: "Hệ thống đang restore dữ liệu"
            });
        }

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu Backup Id"
            });
        }

        const backup = await Backup.findOneAndUpdate(
            { _id: id, type: "mongodb", status: "completed", deletedAt: null },
            { $set: { status: "in_progress" } },
            { new: true }
        ).select({ path: 1 }).lean();
        if (!backup) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy bản ghi backup"
            });
        }
        backupId = id;

        await restoreMongoDB(backup.path);

        await Backup.updateOne(
            { _id: id },
            { $set: { status: "completed" } }
        );

        io.to("Admin").emit("appraisalUpdated");
        io.to("Admin").emit("realEstateUpdated");
        io.to("Admin").emit("userUpdated");

        return res.status(200).json({
            success: true,
            code: "RESTORE_COMPLETED",
            message: "Khôi phục bản ghi backup thành công"
        });
    } catch (error) {
        console.error("Error restoring backup:", error);
        if (backupId) {
            await Backup.updateOne(
                { _id: backupId },
                { $set: { status: "completed" } }
            );
        }
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy bản ghi backup"
            });
        }
        return res.status(500).json({
            success: false,
            code: "RESTORE_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    } finally {
        await redis.del("system:lock:mongo_restore");
    }
};

export const deleteBackup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu backup ID"
            });
        }

        const backup = await Backup.updateOne(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user.id } }
        );

        if (!backup.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy bản ghi backup"
            });
        }

        io.to("Admin").emit("backupDeleted");

        return res.status(200).json({
            success: true,
            code: "BACKUP_DELETED",
            message: "Backup đã được xóa thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error deleting backup:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy bản ghi backup"
            });
        }
        res.status(500).json({
            success: false,
            code: "DELETE_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreDeletedBackup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu Backup Id"
            });
        }

        const result = await Backup.updateOne(
            { _id: id, deletedAt: { $ne: null } },
            { $set: { deletedAt: null, deletedBy: null } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy backup đã xóa",
            });
        }

        io.to("Admin").emit("backupRestored");

        return res.status(200).json({
            success: true,
            code: "BACKUP_RESTORED",
            message: "Khôi phục backup thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error restoring backup:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy backup đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const permanentDeleteBackup = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu Backup Id"
            });
        }

        const item = await Backup.findOneAndDelete({ _id: id, deletedAt: { $ne: null } }).select({ path: 1 }).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy backup đã xóa",
            });
        };

        if (item.path) {
            await deleteFile(item.path);
        }

        io.to("Admin").emit("backupPermanentlyDeleted");

        return res.status(200).json({
            success: true,
            code: "BACKUP_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn backup thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error permanently deleting backup:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy backup đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getBackupConfig = async (req, res) => {
    try {
        const config = await BackupConfig.findOneAndUpdate(
            {},
            {
                $setOnInsert: {
                    schedule: "0 0 * * *",
                    enabled: true,
                    retention: 7,
                }
            },
            { new: true, upsert: true }
        ).select({ schedule: 1, enabled: 1, retention: 1, lastBackupAt: 1, nextBackupAt: 1, lastBackupStatus: 1 }).lean();

        return res.status(200).json({
            success: true,
            code: "CONFIG_FETCHED",
            data: transformIds(config)
        });
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const updateBackupConfig = async (req, res) => {
    try {
        const { schedule, enabled, retention } = req.body;
        const update = {};
        let shouldRestartCron = false;

        if (schedule !== undefined) {
            if (!cron.validate(schedule)) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_SCHEDULE",
                    message: "Cron expression không hợp lệ"
                });
            }
            update.schedule = schedule;
            shouldRestartCron = true;
        }

        if (enabled !== undefined) {
            update.enabled = enabled;
            shouldRestartCron = true;
        }

        if (retention !== undefined) {
            if (retention < 1 || retention > 365) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_RETENTION",
                    message: "Retention phải từ 1 đến 365 ngày"
                });
            }
            update.retention = retention;
        }

        const config = await BackupConfig.findOneAndUpdate(
            {},
            { $set: update },
            { upsert: true, new: true }
        ).select({ schedule: 1, enabled: 1, retention: 1, lastBackupAt: 1, nextBackupAt: 1, lastBackupStatus: 1 }).lean();

        if (shouldRestartCron) {
            await updateBackupCronJob();
        }

        io.to("Admin").emit("backupUpdated");

        return res.status(200).json({
            success: true,
            code: "CONFIG_UPDATED",
            message: "Cấu hình đã được cập nhật",
            data: transformIds(config)
        });
    } catch (error) {
        console.error("Error updating config:", error);
        res.status(500).json({
            success: false,
            code: "UPDATE_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getBackupStats = async (req, res) => {
    try {
        const [stats] = await Backup.aggregate([
            {
                $match: {
                    status: "completed",
                    deletedAt: null
                }
            },
            {
                $group: {
                    _id: null,
                    totalBackups: { $sum: 1 },
                    totalSize: { $sum: "$size" }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            code: "STATS_FETCHED",
            data: {
                totalBackups: stats?.totalBackups || 0,
                totalSize: stats?.totalSize || 0
            }
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};