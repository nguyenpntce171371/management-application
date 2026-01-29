import Backup from "../models/Backup.js";
import BackupConfig from "../models/BackupConfig.js";
import { backupMongoDB, restoreMongoDB, deleteBackup, permanentDeleteBackup, importBackup, cleanupOldBackups, getBackupDownloadUrl } from "../services/backup.service.js";

export const getBackups = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const type = req.query.type || "all";
        const source = req.query.source || "all";
        const status = req.query.status || "all";
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const query = {};

        if (type !== "all") {
            query.type = type;
        }

        if (source !== "all") {
            query.source = source;
        }

        if (status !== "all") {
            query.status = status;
        }

        const data = await Backup.find(query)
            .select("type filename size ociPath source status error mongoVersion metadata createdAt")
            .sort({ [sortBy]: sortOrder, _id: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Backup.countDocuments(query);

        const dataWithUrls = await Promise.all(
            data.map(async (backup) => {
                if (backup.status === "completed") {
                    try {
                        const { url } = await getBackupDownloadUrl(backup._id);
                        return { ...backup, downloadUrl: url };
                    } catch (error) {
                        console.error(`Failed to generate URL for backup ${backup._id}:`, error);
                        return backup;
                    }
                }
                return backup;
            })
        );

        return res.status(200).json({
            success: true,
            code: "BACKUPS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: dataWithUrls,
        });
    } catch (error) {
        console.error("Error fetching backups:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const createBackup = async (req, res) => {
    try {
        const mongoResult = await backupMongoDB("manual");
        const result = { success: true, results: { mongodb: mongoResult.backup } };

        return res.status(200).json({
            success: true,
            code: "BACKUP_CREATED",
            message: "Backup đã được tạo thành công",
            data: result.results
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
    try {
        const { backupId } = req.body;

        if (!backupId) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu backupId"
            });
        }

        const result = await restoreMongoDB(backupId);

        return res.status(200).json({
            success: true,
            code: "RESTORE_COMPLETED",
            message: result.message
        });
    } catch (error) {
        console.error("Error restoring backup:", error);
        res.status(500).json({
            success: false,
            code: "RESTORE_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteBackupById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_BACKUP_ID",
                message: "Thiếu backup ID"
            });
        }

        await deleteBackup(id, req.user.id);

        return res.status(200).json({
            success: true,
            code: "BACKUP_DELETED",
            message: "Backup đã được xóa thành công"
        });

    } catch (error) {
        console.error("Error deleting backup:", error);
        res.status(500).json({
            success: false,
            code: "DELETE_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedBackups = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const deletedBackups = await Backup.findDeleted()
            .select("type filename size source status deletedAt deletedBy createdAt metadata")
            .populate("deletedBy", "fullName email")
            .sort({ deletedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Backup.countDocuments({ deletedAt: { $ne: null } });

        return res.status(200).json({
            success: true,
            code: "DELETED_BACKUPS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: deletedBackups,
        });
    } catch (error) {
        console.error("Error fetching deleted backups:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreDeletedBackup = async (req, res) => {
    try {
        const { id } = req.params;

        const backup = await Backup.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!backup) {
            return res.status(404).json({
                success: false,
                code: "BACKUP_NOT_FOUND",
                message: "Không tìm thấy backup đã xóa",
            });
        }

        await backup.restore();

        return res.status(200).json({
            success: true,
            code: "BACKUP_RESTORED",
            message: "Khôi phục backup thành công",
            data: { id: backup._id, filename: backup.filename },
        });
    } catch (error) {
        console.error("Error restoring backup:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const permanentDeleteBackupById = async (req, res) => {
    try {
        const { id } = req.params;

        await permanentDeleteBackup(id);

        return res.status(200).json({
            success: true,
            code: "BACKUP_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn backup thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting backup:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const importBackupFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                code: "NO_FILE",
                message: "Không có file được upload"
            });
        }

        if (!req.file.originalname.endsWith(".tar.gz") && !req.file.originalname.endsWith(".tgz")) {
            return res.status(400).json({
                success: false,
                code: "INVALID_FILE_FORMAT",
                message: "File phải có định dạng .tar.gz hoặc .tgz"
            });
        }

        const result = await importBackup(req.file.path, "mongodb", req.file.originalname);

        return res.status(200).json({
            success: true,
            code: "IMPORT_SUCCESS",
            message: "Import backup thành công",
            data: result.backup
        });

    } catch (error) {
        console.error("Error importing backup:", error);
        res.status(500).json({
            success: false,
            code: "IMPORT_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getBackupConfig = async (req, res) => {
    try {
        const config = await BackupConfig.getConfig();

        return res.status(200).json({
            success: true,
            code: "CONFIG_FETCHED",
            data: {
                schedule: config.schedule,
                enabled: config.enabled,
                retention: config.retention,
                lastBackupAt: config.lastBackupAt,
                nextBackupAt: config.nextBackupAt,
                lastBackupStatus: config.lastBackupStatus
            }
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

        const config = await BackupConfig.getConfig();

        if (schedule !== undefined) {
            const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|2\d|3[01])) (\*|([1-9]|1[0-2])) (\*|([0-6]))$/;
            if (!cronRegex.test(schedule)) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_SCHEDULE",
                    message: "Cron expression không hợp lệ"
                });
            }
            config.schedule = schedule;
        }

        if (enabled !== undefined) {
            config.enabled = enabled;
        }

        if (retention !== undefined) {
            if (retention < 1 || retention > 365) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_RETENTION",
                    message: "Retention phải từ 1 đến 365 ngày"
                });
            }
            config.retention = retention;
        }

        await config.save();

        const { updateCronJob } = await import("../utils/cronScheduler.js");
        await updateCronJob();

        return res.status(200).json({
            success: true,
            code: "CONFIG_UPDATED",
            message: "Cấu hình đã được cập nhật",
            data: {
                schedule: config.schedule,
                enabled: config.enabled,
                retention: config.retention
            }
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

export const cleanupBackups = async (req, res) => {
    try {
        const result = await cleanupOldBackups();

        return res.status(200).json({
            success: true,
            code: "CLEANUP_COMPLETED",
            message: `Đã xóa ${result.deletedCount} backup cũ`,
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error("Error cleaning up backups:", error);
        res.status(500).json({
            success: false,
            code: "CLEANUP_FAILED",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getBackupStats = async (req, res) => {
    try {
        const totalBackups = await Backup.countDocuments({ status: "completed", deletedAt: null });
        const totalSize = await Backup.aggregate([
            { $match: { status: "completed", deletedAt: null } },
            { $group: { _id: null, totalSize: { $sum: "$size" } } }
        ]);

        const byType = await Backup.aggregate([
            { $match: { status: "completed", deletedAt: null } },
            { $group: { _id: "$type", count: { $sum: 1 }, size: { $sum: "$size" } } }
        ]);

        const bySource = await Backup.aggregate([
            { $match: { status: "completed", deletedAt: null } },
            { $group: { _id: "$source", count: { $sum: 1 } } }
        ]);

        const recentBackups = await Backup.find({ status: "completed", deletedAt: null })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("type filename size createdAt source");

        return res.status(200).json({
            success: true,
            code: "STATS_FETCHED",
            data: {
                totalBackups,
                totalSize: totalSize[0]?.totalSize || 0,
                byType,
                bySource,
                recentBackups
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