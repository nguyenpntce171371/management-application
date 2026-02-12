import User from "../models/User.js";
import RealEstate from "../models/RealEstate.js";
import Appraisal from "../models/Appraisal.js";
import Backup from "../models/Backup.js";
import { deleteImage, deleteMultipleImages, deleteFile } from "./storage.service.js";

const RETENTION_DAYS = 7;

export async function cleanupDeletedUsers() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredUsers = await User.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        for (const user of expiredUsers) {
            if (user.avatar) {
                await deleteImage(user.avatar);
            }

            await User.findByIdAndDelete(user._id);
        }
    } catch (error) {
        console.error("Error cleaning up deleted users:", error);
        throw error;
    }
};

export async function cleanupDeletedRealEstates() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredRealEstates = await RealEstate.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        for (const item of expiredRealEstates) {
            if (item.images?.length) {
                await deleteMultipleImages(item.images);
            }

            await RealEstate.findByIdAndDelete(item._id);
        }
    } catch (error) {
        console.error("Error cleaning up deleted real estates:", error);
        throw error;
    }
};

export async function cleanupDeletedAppraisals() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredAppraisals = await Appraisal.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        for (const appraisal of expiredAppraisals) {
            await Appraisal.DeleteOne(appraisal._id);
        }
    } catch (error) {
        console.error("Error cleaning up deleted appraisals:", error);
        throw error;
    }
};

export async function cleanupDeletedBackups() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const expiredBackups = await Backup.find({
            deletedAt: { $ne: null, $lt: cutoffDate }
        });

        for (const backup of expiredBackups) {
            if (backup.path) {
                await deleteFile(backup.path);
            }

            await Backup.findByIdAndDelete(backup._id);
        }
    } catch (error) {
        console.error("Error cleaning up deleted backups:", error);
        throw error;
    }
};

export async function runSoftDeleteCleanup() {
    try {
        await cleanupDeletedUsers();

        await cleanupDeletedRealEstates();

        await cleanupDeletedAppraisals();

        await cleanupDeletedBackups();
    } catch (error) {
        throw error;
    }
};