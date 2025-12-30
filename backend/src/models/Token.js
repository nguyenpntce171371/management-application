import mongoose from "mongoose";
import bcrypt from "bcryptjs";
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

tokenSchema.pre("save", async function (next) {
    if (this.isModified("refreshToken") && this.refreshToken) {
        const salt = await bcrypt.genSalt(10);
        this.refreshToken = await bcrypt.hash(this.refreshToken, salt);
    }
    if (this.isModified("deviceId") && this.deviceId) {
        this.deviceId = crypto.createHash("sha256").update(this.deviceId).digest("hex");
    }
    next();
});

tokenSchema.methods.compareRefreshToken = function (plainToken) {
    return bcrypt.compare(plainToken, this.refreshToken);
};

tokenSchema.methods.compareDeviceId = function (rawDeviceId) {
    const hashed = crypto.createHash("sha256").update(rawDeviceId).digest("hex");
    return this.deviceId === hashed;
};

tokenSchema.index({ refreshTokenExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Token", tokenSchema);