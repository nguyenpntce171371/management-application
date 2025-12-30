import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    email: { type: String, index: true },
    role: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String, index: true },
    method: { type: String, enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], required: true },
    endpoint: { type: String, index: true },
    statusCode: { type: Number, min: 100, max: 599 },
    referrer: { type: String },
    message: { type: String },
    createdAt: { type: Date, default: Date.now },
});

function normalize(str) {
    if (!str) return "";
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
logSchema.index({
    email: "text",
    role: "text",
    userAgent: "text",
    ipAddress: "text",
    endpoint: "text",
    messageSearch: "text"
});

logSchema.pre("save", function (next) {
    if (this.isModified("message") || this.isNew) {
        this.messageSearch = normalize(this.message || "");
    }
    next();
});

export default mongoose.model("Log", logSchema);