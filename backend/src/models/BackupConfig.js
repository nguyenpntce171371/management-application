import mongoose from "mongoose";

const backupConfigSchema = new mongoose.Schema({
    schedule: { type: String, default: "0 0 * * *", required: true },
    enabled: { type: Boolean, default: true },
    retention: { type: Number, default: 7, min: 1, max: 365 },
    lastBackupAt: { type: Date },
    nextBackupAt: { type: Date },
    lastBackupStatus: { type: String, enum: ["success", "failed", "in_progress"], default: null },
    lastBackupError: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model("BackupConfig", backupConfigSchema);