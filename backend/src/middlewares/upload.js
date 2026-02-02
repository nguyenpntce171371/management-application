import multer from "multer";
import path from "path";
import fs from "fs";

const IMAGE_CONFIG = {
    ALLOWED_TYPES: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif"
    ],
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_FILES: 20
};

const BACKUP_CONFIG = {
    ALLOWED_EXTENSIONS: [".gz", ".tgz", ".tar.gz"],
    MAX_FILE_SIZE: 1024 * 1024 * 1024,
    UPLOAD_DIR: "/tmp/uploads"
};

if (!fs.existsSync(BACKUP_CONFIG.UPLOAD_DIR)) {
    fs.mkdirSync(BACKUP_CONFIG.UPLOAD_DIR, { recursive: true });
}

const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, BACKUP_CONFIG.UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, `backup-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const imageFileFilter = (req, file, cb) => {
    if (IMAGE_CONFIG.ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only images are allowed."), false);
    }
};

const backupFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (BACKUP_CONFIG.ALLOWED_EXTENSIONS.includes(ext) || file.originalname.endsWith(".tar.gz")) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only .tar.gz or .tgz are allowed."), false);
    }
};

const anyFileFilter = (req, file, cb) => {
    cb(null, true);
};

export const uploadImages = multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: IMAGE_CONFIG.MAX_FILE_SIZE,
        files: IMAGE_CONFIG.MAX_FILES,
    },
});

export const uploadSingleImage = multer({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: IMAGE_CONFIG.MAX_FILE_SIZE,
        files: 1,
    },
});

export const uploadBackup = multer({
    storage: diskStorage,
    fileFilter: backupFileFilter,
    limits: {
        fileSize: BACKUP_CONFIG.MAX_FILE_SIZE,
        files: 1,
    },
});

export const uploadFileToMemory = multer({
    storage: memoryStorage,
    fileFilter: anyFileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
    },
});

export const uploadFileToDisk = multer({
    storage: diskStorage,
    fileFilter: anyFileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 1,
    },
});

export const upload = uploadImages;

export const uploadSingle = uploadSingleImage;

export const cleanupUploadedFiles = async (files) => {
    const fileArray = Array.isArray(files) ? files : [files];
    
    for (const file of fileArray) {
        if (file && file.path) {
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (error) {
                console.error(`Failed to delete file ${file.path}:`, error);
            }
        }
    }
};

export const getUploadDir = () => {
    return BACKUP_CONFIG.UPLOAD_DIR;
};

export const createUploadMiddleware = (options = {}) => {
    return multer({
        storage: options.storage || memoryStorage,
        fileFilter: options.fileFilter || anyFileFilter,
        limits: options.limits || {
            fileSize: 10 * 1024 * 1024,
            files: 1
        }
    });
};