import mongoose from "mongoose";
import crypto from "crypto";

const tokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    refreshToken: { type: String, default: null },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    deviceName: { type: String, default: "Unknown device" },
    deviceId: { type: String, required: true, index: true },
    ipAddress: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    remember: { type: Boolean, default: false },
});

tokenSchema.pre("save", function (next) {
    if (this.isModified("refreshToken") && this.refreshToken) {
        this.refreshToken = crypto.createHash("sha256").update(this.refreshToken).digest("hex");
    }

    if (this.isModified("deviceId") && this.deviceId) {
        this.deviceId = crypto.createHash("sha256").update(this.deviceId).digest("hex");
    }

    next();
});
tokenSchema.methods.compareRefreshToken = function (plainToken) {
    return this.refreshToken === crypto.createHash("sha256").update(plainToken).digest("hex");
};

tokenSchema.methods.compareDeviceId = function (rawDeviceId) {
    return this.deviceId === crypto.createHash("sha256").update(rawDeviceId).digest("hex");
};

tokenSchema.index({ refreshTokenExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Token", tokenSchema);