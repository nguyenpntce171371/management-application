import mongoose from "mongoose";
import crypto from "crypto";

const tokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    refreshToken: { type: String, default: null },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    deviceName: { type: String, default: "Unknown device" },
    deviceId: { type: String, required: true },
    ipAddress: { type: String, default: "" },
    remember: { type: Boolean, default: false },
}, {
    timestamps: true,
    versionKey: false,
});

tokenSchema.index({ userId: 1, deviceId: 1, refreshToken: 1 });
tokenSchema.index({ refreshTokenExpiresAt: 1 }, { expireAfterSeconds: 0 });

tokenSchema.statics.hashValue = function (value) {
    return crypto.createHash("sha256").update(value).digest("hex");
};

export default mongoose.model("Token", tokenSchema);