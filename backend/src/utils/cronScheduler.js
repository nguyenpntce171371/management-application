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
            return;
        }

        if (!cron.validate(config.schedule)) {
            console.error("Invalid cron expression:", config.schedule);
            return;
        }

        backupJob = cron.schedule(config.schedule, async () => {
            try {
                config.lastBackupAt = new Date();
                config.lastBackupStatus = "in_progress";
                await config.save();

                await backupMongoDB("auto");
                await cleanupOldBackups();

                config.lastBackupStatus = "success";
                config.lastBackupError = null;
                await config.save();
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
            try {
                await runSoftDeleteCleanup();
            } catch (error) {
                console.error("Soft delete cleanup failed:", error);
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });
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
            try {
                const result = cleanupExpiredTokens();
            } catch (error) {
                console.error("Temp tokens cleanup failed:", error);
            }
        }, { timezone: "Asia/Ho_Chi_Minh" });

        try {
            const result = cleanupExpiredTokens();
        } catch (error) {
            console.error("Initial temp tokens cleanup failed:", error);
        }
    } catch (error) {
        console.error("Failed to initialize temp token cleanup job:", error);
    }
};

export async function initializeCronJobs() {
    await initializeBackupCronJob();
    initializeSoftDeleteCleanupJob();
    initializeTempTokenCleanupJob();
};

export async function updateBackupCronJob() {
    await initializeBackupCronJob();
};

export function stopCronJobs() {
    if (backupJob) {
        backupJob.stop();
        backupJob = null;
    }

    if (cleanupJob) {
        cleanupJob.stop();
        cleanupJob = null;
    }

    if (tokenCleanupJob) {
        tokenCleanupJob.stop();
        tokenCleanupJob = null;
    }
};