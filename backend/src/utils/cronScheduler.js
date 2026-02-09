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

export async function initializeBackupCronJob() {
    try {
        if (backupJob) {
            backupJob.stop();
            backupJob = null;
        }

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
        );

        if (!config.enabled) {
            console.log("Auto backup is disabled");
            return;
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

export async function initializeSoftDeleteCleanupJob() {
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

export function initializeTempTokenCleanupJob() {
    try {
        if (tokenCleanupJob) {
            tokenCleanupJob.stop();
        }

        tokenCleanupJob = cron.schedule("*/30 * * * *", () => {
            console.log("Starting expired temp tokens cleanup...");

            try {
                const result = cleanupExpiredTokens();
                console.log(`Temp tokens cleanup completed - Cleaned: ${result.cleaned}, Remaining: ${result.remaining}`);
            } catch (error) {
                console.error("Temp tokens cleanup failed:", error);
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });

        console.log("Temp token cleanup scheduler initialized");
        console.log("Cleanup runs every 30 minutes");

        console.log("Running initial temp tokens cleanup...");
        try {
            const result = cleanupExpiredTokens();
            console.log(`Initial cleanup completed - Cleaned: ${result.cleaned}, Remaining: ${result.remaining}`);
        } catch (error) {
            console.error("Initial temp tokens cleanup failed:", error);
        }
    } catch (error) {
        console.error("Failed to initialize temp token cleanup job:", error);
    }
};

export async function initializeCronJobs() {
    console.log("Initializing cron jobs...");
    await initializeBackupCronJob();
    initializeSoftDeleteCleanupJob();
    initializeTempTokenCleanupJob();
    console.log("All cron jobs initialized");
};

export async function updateBackupCronJob() {
    console.log("Updating backup cron job...");
    await initializeBackupCronJob();
};

export function stopCronJobs() {
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

    if (tokenCleanupJob) {
        tokenCleanupJob.stop();
        tokenCleanupJob = null;
        console.log("Token cleanup scheduler stopped");
    }
};