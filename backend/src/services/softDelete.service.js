import User from "../models/User.js";
import RealEstate from "../models/RealEstate.js";
import Appraisal from "../models/Appraisal.js";
import Backup from "../models/Backup.js";
import { deleteMultipleImagesFromOCI, deleteFileFromOCI } from "./oci.service.js";

const RETENTION_DAYS = 7;

export const cleanupDeletedUsers = async () => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredUsers = await User.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        let deletedCount = 0;

        for (const user of expiredUsers) {
            await User.permanentDelete(user._id);
            deletedCount++;
        }

        console.log(`Cleaned up ${deletedCount} expired users`);

        return {
            success: true,
            model: "User",
            deletedCount,
            cutoffDate
        };
    } catch (error) {
        console.error("Error cleaning up deleted users:", error);
        throw error;
    }
};

export const cleanupDeletedRealEstates = async () => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredRealEstates = await RealEstate.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        let deletedCount = 0;
        let imagesDeletedCount = 0;

        for (const item of expiredRealEstates) {
            if (item.images?.length) {
                try {
                    await deleteMultipleImagesFromOCI(item.images);
                    imagesDeletedCount += item.images.length;
                } catch (imageError) {
                    console.error(`Failed to delete images for RealEstate ${item._id}:`, imageError);
                }
            }

            await RealEstate.permanentDelete(item._id);
            deletedCount++;
        }

        console.log(`Cleaned up ${deletedCount} expired real estates (${imagesDeletedCount} images)`);

        return {
            success: true,
            model: "RealEstate",
            deletedCount,
            imagesDeletedCount,
            cutoffDate
        };
    } catch (error) {
        console.error("Error cleaning up deleted real estates:", error);
        throw error;
    }
};

export const cleanupDeletedAppraisals = async () => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredAppraisals = await Appraisal.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        let deletedCount = 0;

        for (const appraisal of expiredAppraisals) {
            await Appraisal.permanentDelete(appraisal._id);
            deletedCount++;
        }

        console.log(`Cleaned up ${deletedCount} expired appraisals`);

        return {
            success: true,
            model: "Appraisal",
            deletedCount,
            cutoffDate
        };
    } catch (error) {
        console.error("Error cleaning up deleted appraisals:", error);
        throw error;
    }
};

export const cleanupDeletedBackups = async () => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredBackups = await Backup.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        let deletedCount = 0;
        let filesDeletedCount = 0;

        for (const backup of expiredBackups) {
            if (backup.ociPath) {
                try {
                    await deleteFileFromOCI(backup.ociPath);
                    filesDeletedCount++;
                } catch (fileError) {
                    console.error(`Failed to delete OCI file for Backup ${backup._id}:`, fileError);
                }
            }

            await Backup.findByIdAndDelete(backup._id);
            deletedCount++;
        }

        console.log(`✅ Cleaned up ${deletedCount} expired backups (${filesDeletedCount} OCI files)`);

        return {
            success: true,
            model: "Backup",
            deletedCount,
            filesDeletedCount,
            cutoffDate
        };
    } catch (error) {
        console.error("Error cleaning up deleted backups:", error);
        throw error;
    }
};

export const runSoftDeleteCleanup = async () => {
    console.log("Starting soft delete cleanup...");

    const startTime = Date.now();
    const results = {
        timestamp: new Date(),
        results: [],
        errors: []
    };

    try {
        try {
            const userResult = await cleanupDeletedUsers();
            results.results.push(userResult);
        } catch (error) {
            results.errors.push({ model: "User", error: error.message });
        }

        try {
            const realEstateResult = await cleanupDeletedRealEstates();
            results.results.push(realEstateResult);
        } catch (error) {
            results.errors.push({ model: "RealEstate", error: error.message });
        }

        try {
            const appraisalResult = await cleanupDeletedAppraisals();
            results.results.push(appraisalResult);
        } catch (error) {
            results.errors.push({ model: "Appraisal", error: error.message });
        }

        try {
            const backupResult = await cleanupDeletedBackups();
            results.results.push(backupResult);
        } catch (error) {
            results.errors.push({ model: "Backup", error: error.message });
        }

        const duration = Date.now() - startTime;

        console.log(`Soft delete cleanup completed in ${duration}ms`);
        console.log(`Summary:`, results);

        return results;
    } catch (error) {
        console.error("Soft delete cleanup failed:", error);
        throw error;
    }
};