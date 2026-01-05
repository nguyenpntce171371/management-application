import multer from "multer";
import { OCI_CONFIG } from "../config/oci.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    OCI_CONFIG.ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid file type"), false);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: OCI_CONFIG.MAX_FILE_SIZE,
        files: 20,
    },
});

export const uploadSingle = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: OCI_CONFIG.MAX_FILE_SIZE,
        files: 1,
    },
});