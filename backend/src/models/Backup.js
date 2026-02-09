import mongoose from "mongoose";

const backupSchema = new mongoose.Schema({
    type: { type: String, enum: ["mongodb"], required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    source: { type: String, enum: ["auto", "manual", "imported"], default: "manual" },
    status: { type: String, enum: ["completed", "failed", "in_progress"], default: "in_progress" },
    error: String,
    mongoVersion: String,
    metadata: {
        dbName: String,
        collections: Number,
        documents: Number,
        indexes: Number,
        compressedSize: Number,
        compressionRatio: Number,
        excludedCollections: [String],
        originalFilename: String,
        importedAt: Date
    },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

backupSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });

backupSchema.pre(/^find/, function (next) {
    if (!this.getQuery().deletedAt) {
        this.where({ deletedAt: null });
    }
    next();
});

export default mongoose.model("Backup", backupSchema);