import path from "path";
import fs from "fs";
import { verifyTempToken, STORAGE_CONFIG } from "../services/storage.service.js";

export const getTemp = async (req, res) => {
    try {
        const { token } = req.params;

        const fileName = verifyTempToken(token);

        if (!fileName) {
            return res.status(404).json({
                success: false,
                code: "LINK_EXPIRED",
                message: "Link đã hết hạn hoặc không hợp lệ"
            });
        }

        const filePath = path.join(STORAGE_CONFIG.UPLOADS_DIR, fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                code: "FILE_NOT_FOUND",
                message: "File không tồn tại"
            });
        }

        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            ".webp": "image/webp",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".gz": "application/gzip",
            ".tar": "application/x-tar",
            ".zip": "application/zip"
        };

        const contentType = contentTypes[ext] || "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on("error", (error) => {
            console.error("File stream error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    code: "STREAM_ERROR",
                    message: "Lỗi khi đọc file"
                });
            }
        });
    } catch (error) {
        console.error("Error serving temp file:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};