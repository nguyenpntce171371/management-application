import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import mongoose from "mongoose";
import { uploadFile, downloadFile } from "./storage.service.js";
import Backup from "../models/Backup.js";
import BackupConfig from "../models/BackupConfig.js";
import { io } from "../index.js";

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
            } catch (error) {
                console.warn(`Could not count documents in ${col.name}:`, error.message);
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

        io.to("Admin").emit("backupCreated");

        return backupRecord;
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

export const restoreMongoDB = async (storagePath) => {
    const timestamp = getTimestamp();
    const archivePath = path.join(BACKUP_DIR, `restore_mongo_${timestamp}.tar.gz`);
    const extractDir = path.join(BACKUP_DIR, `restore_mongo_${timestamp}`);

    try {
        await downloadFile(storagePath, archivePath);
        await extractTarGz(archivePath, extractDir);

        const restoreCommand = `mongorestore --uri="${MONGO_URI}" --drop --gzip "${extractDir}/${process.env.MONGO_DB_NAME}"`;

        await execPromise(restoreCommand);

        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(archivePath);

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

export const cleanupOldBackups = async () => {
    try {
        const config = await BackupConfig.findOne({}, { retention: 1 }).lean();
        const retention = config?.retention ?? 7;

        const keepIds = await Backup.find(
            {
                status: "completed",
                type: "mongodb",
                deletedAt: null
            },
            { _id: 1 }
        ).sort({ createdAt: -1 }).limit(retention).lean();

        const keepIdList = keepIds.map(b => b._id);

        const result = await Backup.updateMany(
            {
                status: "completed",
                type: "mongodb",
                deletedAt: null,
                _id: { $nin: keepIdList }
            },
            {
                $set: {
                    deletedAt: new Date(),
                    deletedBy: null,
                    deleteReason: "Automatic cleanup"
                }
            }
        );

        return {
            success: true,
            deletedCount: result.modifiedCount
        };
    } catch (error) {
        console.error("Cleanup error:", error);
        throw error;
    }
};