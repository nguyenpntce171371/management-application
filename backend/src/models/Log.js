import mongoose from "mongoose";
import { normalize } from "../utils/string.js";

const logSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: String,
    role: String,
    userAgent: String,
    ipAddress: { type: String },
    method: { type: String, enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], required: true },
    endpoint: { type: String },
    statusCode: { type: Number, min: 100, max: 599 },
    referrer: String,
    message: String,
    searchText: String
}, { timestamps: true });

logSchema.index({ method: 1, statusCode: 1, deletedAt: 1, createdAt: -1, _id: -1 });
logSchema.index({ statusCode: 1, deletedAt: 1, createdAt: -1, _id: -1 });
logSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
logSchema.index({ searchText: 1, createdAt: -1, _id: -1 });

logSchema.pre("save", function (next) {
    if (!this.isNew && !this.isModified()) return next();

    const parts = [
        this.email,
        this.userAgent,
        this.ipAddress,
        this.endpoint,
        this.message
    ];

    this.searchText = normalize(parts.filter(Boolean).join(" "));

    next();
});

export default mongoose.model("Log", logSchema);