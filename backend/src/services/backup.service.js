import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import mongoose from "mongoose";
import { uploadFile, downloadFile, deleteFile, generatePresignedUrl } from "./storage.service.js";
import Backup from "../models/Backup.js";
import BackupConfig from "../models/BackupConfig.js";

const execPromise = promisify(exec);

const BACKUP_DIR = "/tmp/backups";
const MONGO_CONTAINER = process.env.APP_MODE === "production" ? "mongo-production" : "mongo-development";
const MONGO_URI = `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@${MONGO_CONTAINER}:27017/${process.env.MONGO_DB_NAME}?authSource=admin`;

const EXCLUDED_COLLECTIONS = [
    "backups",
    "backupconfigs",
    "logs",
    "tokens"
];

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const getTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
};

const compressDirectory = async (sourceDir, outputPath) => {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("tar", {
            gzip: true,
            gzipOptions: { level: 9 }
        });

        output.on("close", () => {
            resolve({
                size: archive.pointer(),
                path: outputPath
            });
        });

        archive.on("error", reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
};

const extractTarGz = async (archivePath, outputDir) => {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = `tar -xzf ${archivePath} -C ${outputDir}`;
    await execPromise(command);
};

export const backupMongoDB = async (source = "manual") => {
    const timestamp = getTimestamp();
    const filename = `mongo_${source}_${timestamp}.tar.gz`;
    const dumpDir = path.join(BACKUP_DIR, `mongo_dump_${timestamp}`);
    const archivePath = path.join(BACKUP_DIR, filename);

    let backupRecord = null;

    try {
        backupRecord = await Backup.create({
            type: "mongodb",
            filename,
            size: 0,
            path: `backups/mongodb/${filename}`,
            source,
            status: "in_progress"
        });

        const excludeParams = EXCLUDED_COLLECTIONS
            .map(col => `--excludeCollection=${col}`)
            .join(" ");

        const dumpCommand = `mongodump --uri="${MONGO_URI}" --out="${dumpDir}" --gzip ${excludeParams}`;

        console.log(`📦 Creating MongoDB backup (excluding: ${EXCLUDED_COLLECTIONS.join(", ")})`);
        await execPromise(dumpCommand);

        const { size } = await compressDirectory(dumpDir, archivePath);

        const storagePath = `backups/mongodb/${filename}`;
        await uploadFile(archivePath, storagePath);

        const db = mongoose.connection.db;
        const allCollections = await db.listCollections().toArray();

        const includedCollections = allCollections.filter(
            col => !EXCLUDED_COLLECTIONS.includes(col.name)
        );

        let totalDocuments = 0;
        for (const col of includedCollections) {
            try {
                const count = await db.collection(col.name).countDocuments();
                totalDocuments += count;
            } catch (err) {
                console.warn(`Could not count documents in ${col.name}:`, err.message);
            }
        }

        backupRecord.size = size;
        backupRecord.status = "completed";
        backupRecord.mongoVersion = mongoose.version;
        backupRecord.metadata = {
            dbName: process.env.MONGO_DB_NAME,
            collections: includedCollections.length,
            documents: totalDocuments,
            compressedSize: size,
            compressionRatio: 0,
            excludedCollections: EXCLUDED_COLLECTIONS
        };
        await backupRecord.save();

        fs.rmSync(dumpDir, { recursive: true, force: true });
        fs.unlinkSync(archivePath);

        console.log(`✅ MongoDB backup completed: ${includedCollections.length} collections, ${totalDocuments} documents`);

        return {
            success: true,
            backup: backupRecord
        };

    } catch (error) {
        console.error("MongoDB backup error:", error);

        if (backupRecord) {
            backupRecord.status = "failed";
            backupRecord.error = error.message;
            await backupRecord.save();
        }

        try {
            if (fs.existsSync(dumpDir)) fs.rmSync(dumpDir, { recursive: true, force: true });
            if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
        } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError);
        }

        throw error;
    }
};

export const createFullBackup = async (source = "manual") => {
    console.log("🔄 Starting MongoDB backup");
    
    try {
        const mongoResult = await backupMongoDB(source);

        return {
            success: true,
            results: {
                mongodb: mongoResult.backup
            }
        };
    } catch (error) {
        console.error("Backup error:", error);
        throw error;
    }
};

export const restoreMongoDB = async (backupId) => {
    const backup = await Backup.findOne({ _id: backupId, deletedAt: null });

    if (!backup) {
        throw new Error("Backup not found or has been deleted");
    }

    if (backup.type !== "mongodb") {
        throw new Error("Invalid backup type for MongoDB restore");
    }

    if (backup.status !== "completed") {
        throw new Error("Cannot restore incomplete backup");
    }

    const timestamp = getTimestamp();
    const archivePath = path.join(BACKUP_DIR, `restore_mongo_${timestamp}.tar.gz`);
    const extractDir = path.join(BACKUP_DIR, `restore_mongo_${timestamp}`);

    try {
        await downloadFile(backup.path, archivePath);
        await extractTarGz(archivePath, extractDir);

        const restoreCommand = `mongorestore --uri="${MONGO_URI}" --drop --gzip "${extractDir}/${process.env.MONGO_DB_NAME}"`;

        console.log(`🔄 Restoring MongoDB backup (excluded collections will be preserved)`);
        await execPromise(restoreCommand);

        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(archivePath);

        console.log(`✅ MongoDB restored successfully (${EXCLUDED_COLLECTIONS.join(", ")} preserved)`);

        return {
            success: true,
            message: "MongoDB restored successfully"
        };

    } catch (error) {
        console.error("MongoDB restore error:", error);

        try {
            if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
            if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
        } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError);
        }

        throw error;
    }
};

export const importBackup = async (path, type, originalFilename) => {
    const timestamp = getTimestamp();
    const filename = `${type}_imported_${timestamp}.tar.gz`;
    const verifyDir = path.join(BACKUP_DIR, `verify_${timestamp}`);

    let backupRecord = null;

    try {
        await extractTarGz(path, verifyDir);

        if (type === "mongodb") {
            const dbDir = path.join(verifyDir, process.env.MONGO_DB_NAME);
            if (!fs.existsSync(dbDir)) {
                throw new Error("Invalid MongoDB backup: database directory not found");
            }
        } else {
            throw new Error("Only MongoDB backups are supported");
        }

        const stats = fs.statSync(path);

        backupRecord = await Backup.create({
            type,
            filename,
            size: stats.size,
            path: `backups/${type}/${filename}`,
            source: "imported",
            status: "in_progress"
        });

        const storagePath = `backups/${type}/${filename}`;
        await uploadFile(path, storagePath);

        backupRecord.status = "completed";
        backupRecord.metadata = {
            originalFilename,
            importedAt: new Date()
        };
        await backupRecord.save();

        fs.rmSync(verifyDir, { recursive: true, force: true });

        return {
            success: true,
            backup: backupRecord
        };

    } catch (error) {
        console.error("Import backup error:", error);

        if (backupRecord) {
            backupRecord.status = "failed";
            backupRecord.error = error.message;
            await backupRecord.save();
        }

        try {
            if (fs.existsSync(verifyDir)) fs.rmSync(verifyDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError);
        }

        throw error;
    }
};

export const deleteBackup = async (backupId, deletedBy = null) => {
    const backup = await Backup.findOne({ _id: backupId, deletedAt: null });
    if (!backup) {
        throw new Error("Backup not found");
    }

    try {
        await backup.softDelete(deletedBy);

        return {
            success: true,
            message: "Backup deleted successfully (can be restored within 7 days)"
        };
    } catch (error) {
        console.error("Delete backup error:", error);
    }
};

export const permanentDeleteBackup = async (backupId) => {
    const backup = await Backup.findOne({ _id: backupId, deletedAt: { $ne: null } });

    if (!backup) {
        throw new Error("Backup not found in deleted items");
    }

    try {
        await deleteFile(backup.path);
        
        await backup.deleteOne();

        return {
            success: true,
            message: "Backup permanently deleted"
        };
    } catch (error) {
        console.error("Permanent delete backup error:", error);
    }
};

export const cleanupOldBackups = async () => {
    try {
        const config = await BackupConfig.getConfig();
        const retention = config.retention;

        const allBackups = await Backup.find({
            status: "completed",
            type: "mongodb",
            deletedAt: null
        }).sort({ createdAt: -1 });

        const groups = {
            "mongodb-auto": [],
            "mongodb-manual": [],
            "mongodb-imported": []
        };

        allBackups.forEach(backup => {
            const key = `${backup.type}-${backup.source}`;
            if (groups[key]) {
                groups[key].push(backup);
            }
        });

        const deletedBackups = [];

        for (const [key, backups] of Object.entries(groups)) {
            if (backups.length > retention) {
                const toDelete = backups.slice(retention);

                for (const backup of toDelete) {
                    try {
                        await backup.softDelete(null, "Automatic cleanup");
                        deletedBackups.push(backup);
                    } catch (error) {
                        console.error(`Failed to delete backup ${backup._id}:`, error);
                    }
                }
            }
        }

        return {
            success: true,
            deletedCount: deletedBackups.length,
            deletedBackups
        };
    } catch (error) {
        console.error("Cleanup error:", error);
        throw error;
    }
};

export const getBackupDownloadUrl = async (backupId) => {
    const backup = await Backup.findOne({ _id: backupId, deletedAt: null });

    if (!backup) {
        throw new Error("Backup not found");
    }

    if (backup.status !== "completed") {
        throw new Error("Backup is not completed");
    }

    const url = await generatePresignedUrl(backup.path, 3600);

    return {
        success: true,
        url,
        expiresIn: 3600
    };
};