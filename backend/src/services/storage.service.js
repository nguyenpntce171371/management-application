import sharp from "sharp";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = "/app/uploads";
const TEMP_LINKS_FILE = path.join(UPLOADS_DIR, ".temp-links.json");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const SUBDIRS = ["real-estates", "avatars", "backups/mongodb"];
SUBDIRS.forEach(subdir => {
    const fullPath = path.join(UPLOADS_DIR, subdir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

export const STORAGE_CONFIG = {
    UPLOADS_DIR,
    DEFAULT_EXPIRY: 3600
};

function generateTempToken(filePath, expirySeconds = 3600) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + (expirySeconds * 1000);

    let tempLinks = {};
    if (fs.existsSync(TEMP_LINKS_FILE)) {
        try {
            tempLinks = JSON.parse(fs.readFileSync(TEMP_LINKS_FILE, "utf-8"));
        } catch (err) {
            console.error("Error reading temp links file:", err);
        }
    }

    tempLinks[token] = {
        filePath,
        expiresAt
    };

    fs.writeFileSync(TEMP_LINKS_FILE, JSON.stringify(tempLinks, null, 2));

    return token;
};

export function verifyTempToken(token) {
    if (!fs.existsSync(TEMP_LINKS_FILE)) {
        return null;
    }

    try {
        const tempLinks = JSON.parse(fs.readFileSync(TEMP_LINKS_FILE, "utf-8"));
        const link = tempLinks[token];

        if (!link) {
            return null;
        }

        if (Date.now() > link.expiresAt) {
            delete tempLinks[token];
            fs.writeFileSync(TEMP_LINKS_FILE, JSON.stringify(tempLinks, null, 2));
            return null;
        }

        return link.filePath;
    } catch (err) {
        console.error("Error verifying temp token:", err);
        return null;
    }
};

export function isTokenExpired(token) {
    if (!fs.existsSync(TEMP_LINKS_FILE)) {
        return true;
    }

    try {
        const tempLinks = JSON.parse(fs.readFileSync(TEMP_LINKS_FILE, "utf-8"));
        const link = tempLinks[token];

        if (!link) {
            return true;
        }

        return Date.now() > link.expiresAt;
    } catch (err) {
        console.error("Error checking token expiry:", err);
        return true;
    }
};

export function findValidTokenForFile(fileName) {
    if (!fs.existsSync(TEMP_LINKS_FILE)) {
        return null;
    }

    try {
        const tempLinks = JSON.parse(fs.readFileSync(TEMP_LINKS_FILE, "utf-8"));
        const now = Date.now();

        for (const [token, link] of Object.entries(tempLinks)) {
            if (link.filePath === fileName && now <= link.expiresAt) {
                return token;
            }
        }

        return null;
    } catch (err) {
        console.error("Error finding valid token:", err);
        return null;
    }
};

export function cleanupExpiredTokens() {
    if (!fs.existsSync(TEMP_LINKS_FILE)) {
        return { cleaned: 0, remaining: 0 };
    }

    try {
        const tempLinks = JSON.parse(fs.readFileSync(TEMP_LINKS_FILE, "utf-8"));
        const now = Date.now();

        const totalBefore = Object.keys(tempLinks).length;

        const validLinks = Object.fromEntries(
            Object.entries(tempLinks).filter(([_, link]) => now <= link.expiresAt)
        );

        const cleaned = totalBefore - Object.keys(validLinks).length;

        fs.writeFileSync(TEMP_LINKS_FILE, JSON.stringify(validLinks, null, 2));

        return {
            cleaned,
            remaining: Object.keys(validLinks).length
        };
    } catch (err) {
        console.error("Error cleaning up expired tokens:", err);
        return { cleaned: 0, remaining: 0 };
    }
};

export async function uploadImage(buffer, folder = "real-estates") {
    const SOFT_TARGET_SIZE = 35 * 1024;
    const MAX_ITERATIONS = 10;
    let quality = 88;
    let optimized;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        optimized = await sharp(buffer)
            .resize(640, 640, {
                fit: "inside",
                withoutEnlargement: true
            })
            .webp({
                quality,
                effort: 4,
                smartSubsample: true
            })
            .toBuffer();

        if (optimized.length <= SOFT_TARGET_SIZE) break;
        quality -= 2;
        if (quality < 60) break;
    }

    if (!optimized || optimized.length > 50 * 1024) {
        optimized = await sharp(buffer)
            .resize(600, 600, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 65, effort: 4 })
            .toBuffer();
    }

    const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    const folderPath = path.dirname(filePath);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    fs.writeFileSync(filePath, optimized);

    return fileName;
};

export async function uploadMultipleImages(files, folder) {
    const objectNames = [];
    for (const file of files) {
        const name = await uploadImage(file.buffer, folder);
        objectNames.push(name);
        file.buffer = null;
    }
    return objectNames;
};

export async function deleteImage(fileName) {
    if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
        return;
    }

    try {
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Delete error:", error);
    }
};

export async function deleteMultipleImages(fileNames = []) {
    for (const name of fileNames) {
        await deleteImage(name);
    }
};

export async function createImageFingerprint(buffer) {
    const resized = await sharp(buffer).resize(8, 8, { fit: "fill", kernel: sharp.kernel.nearest }).grayscale().raw().toBuffer();
    return crypto.createHash("sha256").update(resized).digest("hex");
};

export async function generatePresignedUrl(fileName, expirySeconds = 3600) {
    const filePath = path.join(UPLOADS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${fileName}`);
    }

    const existingToken = findValidTokenForFile(fileName);

    if (existingToken) {
        return `https://${process.env.DOMAIN}/api/files/temp/${existingToken}`;
    }

    const token = generateTempToken(fileName, expirySeconds);
    const url = `https://${process.env.DOMAIN}/api/files/temp/${token}`;

    return url;
};

export async function uploadFile(filePath, fileName) {
    try {
        const stats = fs.statSync(filePath);
        const destinationPath = path.join(UPLOADS_DIR, fileName);

        const dir = path.dirname(destinationPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.copyFileSync(filePath, destinationPath);

        return {
            success: true,
            fileName,
            size: stats.size
        };
    } catch (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload: ${error.message}`);
    }
};

export async function downloadFile(fileName, destinationPath) {
    try {
        const sourcePath = path.join(UPLOADS_DIR, fileName);

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`File not found: ${fileName}`);
        }

        const dir = path.dirname(destinationPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, destinationPath);

        const stats = fs.statSync(destinationPath);

        return {
            success: true,
            fileName,
            path: destinationPath,
            size: stats.size
        };
    } catch (error) {
        console.error("Download error:", error);
        throw new Error(`Failed to download: ${error.message}`);
    }
};

export async function deleteFile(fileName) {
    try {
        const filePath = path.join(UPLOADS_DIR, fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return {
            success: true,
            fileName
        };
    } catch (error) {
        console.error("Delete error:", error);
        throw new Error(`Failed to delete: ${error.message}`);
    }
};

export async function listFiles(prefix = "") {
    try {
        const dirPath = path.join(UPLOADS_DIR, prefix);

        if (!fs.existsSync(dirPath)) {
            return [];
        }

        const files = [];
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
            if (item.isFile()) {
                const filePath = path.join(dirPath, item.name);
                const stats = fs.statSync(filePath);
                const relativePath = path.relative(UPLOADS_DIR, filePath);

                files.push({
                    name: relativePath.replace(/\\/g, "/"),
                    size: stats.size,
                    lastModified: stats.mtime
                });
            }
        }

        return files;
    } catch (error) {
        console.error("List files error:", error);
        throw new Error(`Failed to list files: ${error.message}`);
    }
};

export async function fileExists(fileName) {
    try {
        const filePath = path.join(UPLOADS_DIR, fileName);
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
};

export async function getFileMetadata(fileName) {
    try {
        const filePath = path.join(UPLOADS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${fileName}`);
        }

        const stats = fs.statSync(filePath);

        return {
            size: stats.size,
            lastModified: stats.mtime,
            created: stats.birthtime
        };
    } catch (error) {
        console.error("Get metadata error:", error);
        throw new Error(`Failed to get file metadata: ${error.message}`);
    }
};

export async function copyFile(sourceFileName, destinationFileName) {
    try {
        const sourcePath = path.join(UPLOADS_DIR, sourceFileName);
        const destPath = path.join(UPLOADS_DIR, destinationFileName);

        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source file not found: ${sourceFileName}`);
        }

        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, destPath);

        return {
            success: true,
            source: sourceFileName,
            destination: destinationFileName
        };
    } catch (error) {
        console.error("Copy file error:", error);
        throw new Error(`Failed to copy file: ${error.message}`);
    }
};