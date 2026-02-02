import cron from "node-cron";
import pkg from "cron-parser";
const { CronExpressionParser } = pkg;
import BackupConfig from "../models/BackupConfig.js";
import { backupMongoDB, cleanupOldBackups } from "../services/backup.service.js";
import { runSoftDeleteCleanup } from "../services/softDelete.service.js";
import { cleanupExpiredTokens } from "../services/storage.service.js";

let backupJob = null;
let cleanupJob = null;
let tokenCleanupJob = null;

export const initializeBackupCronJob = async () => {
    try {
        const config = await BackupConfig.getConfig();

        if (!config.enabled) {
            console.log("Auto backup is disabled");
            return;
        }

        if (backupJob) {
            backupJob.stop();
        }

        if (!cron.validate(config.schedule)) {
            console.error("Invalid cron expression:", config.schedule);
            return;
        }

        backupJob = cron.schedule(config.schedule, async () => {
            console.log("Starting scheduled backup...");

            try {
                config.lastBackupAt = new Date();
                config.lastBackupStatus = "in_progress";
                await config.save();

                await backupMongoDB("auto");
                await cleanupOldBackups();

                config.lastBackupStatus = "success";
                config.lastBackupError = null;
                await config.save();

                console.log("Scheduled backup completed successfully");
            } catch (error) {
                console.error("Scheduled backup failed:", error);

                config.lastBackupStatus = "failed";
                config.lastBackupError = error.message;
                await config.save();
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });

        const interval = CronExpressionParser.parse(config.schedule, { tz: "Asia/Ho_Chi_Minh" });
        const nextRun = interval.next().toDate();
        config.nextBackupAt = nextRun;
        await config.save();

        console.log("Backup scheduler initialized");
        console.log(`Next backup scheduled for: ${nextRun.toLocaleString("vi-VN")}`);
    } catch (error) {
        console.error("Failed to initialize backup cron job:", error);
    }
};

export const initializeSoftDeleteCleanupJob = () => {
    try {
        if (cleanupJob) {
            cleanupJob.stop();
        }

        cleanupJob = cron.schedule("0 0 * * *", async () => {
            console.log("Starting soft delete cleanup...");

            try {
                await runSoftDeleteCleanup();
                console.log("Soft delete cleanup completed");
            } catch (error) {
                console.error("Soft delete cleanup failed:", error);
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });

        console.log("Soft delete cleanup scheduler initialized");
        console.log("Cleanup runs daily at 00:00 (Vietnam time)");
    } catch (error) {
        console.error("Failed to initialize soft delete cleanup job:", error);
    }
};

export const initializeTempTokenCleanupJob = () => {
    try {
        if (tokenCleanupJob) {
            tokenCleanupJob.stop();
        }

        tokenCleanupJob = cron.schedule("0 * * * *", () => {
            console.log("Cleaning up expired temporary tokens...");
            
            try {
                cleanupExpiredTokens();
                console.log("Temporary tokens cleanup completed");
            } catch (error) {
                console.error("Temporary tokens cleanup failed:", error);
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });

        console.log("Temp token cleanup scheduler initialized");
        console.log("Cleanup runs every hour");
    } catch (error) {
        console.error("Failed to initialize temp token cleanup job:", error);
    }
};

export const initializeCronJobs = async () => {
    console.log("Initializing cron jobs...");
    await initializeBackupCronJob();
    initializeSoftDeleteCleanupJob();
    initializeTempTokenCleanupJob();
    console.log("All cron jobs initialized");
};

export const updateBackupCronJob = async () => {
    console.log("Updating backup cron job...");
    await initializeBackupCronJob();
};

export const stopCronJobs = () => {
    if (backupJob) {
        backupJob.stop();
        backupJob = null;
        console.log("Backup scheduler stopped");
    }

    if (cleanupJob) {
        cleanupJob.stop();
        cleanupJob = null;
        console.log("Cleanup scheduler stopped");
    }
};

export const initializeCronJob = initializeBackupCronJob;
export const updateCronJob = updateBackupCronJob;
export const stopCronJob = stopCronJobs;