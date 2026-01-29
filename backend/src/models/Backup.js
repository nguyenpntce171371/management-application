import mongoose from "mongoose";

const backupSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ["mongodb"],
        required: true,
        index: true
    },
    filename: { 
        type: String, 
        required: true 
    },
    size: { 
        type: Number, 
        required: true
    },
    ociPath: { 
        type: String, 
        required: true
    },
    source: { 
        type: String, 
        enum: ["auto", "manual", "imported"],
        default: "manual",
        index: true
    },
    status: { 
        type: String, 
        enum: ["completed", "failed", "in_progress"],
        default: "in_progress",
        index: true
    },
    error: { 
        type: String 
    },
    mongoVersion: { 
        type: String 
    },
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
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletionReason: { type: String }
}, { timestamps: true });

backupSchema.index({ createdAt: -1 });
backupSchema.index({ type: 1, status: 1, createdAt: -1 });
backupSchema.index({ deletedAt: 1, createdAt: -1 });

backupSchema.pre(/^find/, function(next) {
    if (!this.getQuery().deletedAt) {
        this.where({ deletedAt: null });
    }
    next();
});

backupSchema.methods.softDelete = async function(deletedBy, reason) {
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    if (reason) this.deletionReason = reason;
    return await this.save();
};

backupSchema.methods.restore = async function() {
    this.deletedAt = null;
    this.deletedBy = null;
    this.deletionReason = null;
    return await this.save();
};

backupSchema.statics.findDeleted = function(conditions = {}) {
    return this.find({ ...conditions, deletedAt: { $ne: null } });
};

backupSchema.statics.permanentDeleteExpired = async function(daysOld = 7) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - daysOld);
    
    const result = await this.deleteMany({
        deletedAt: { $ne: null, $lte: expiryDate }
    });
    
    return result;
};

export default mongoose.model("Backup", backupSchema);