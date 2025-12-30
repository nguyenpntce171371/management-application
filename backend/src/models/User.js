import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    fullName: { type: String },
    fullNameSearch: { type: String, index: true },
    email: { type: String, required: true, unique: true, index: true },
    password: {
        type: String,
        required: function () {
            return this.provider === "local" || !this.provider;
        },
    },
    role: { type: String, enum: ["Admin", "Staff", "User"], default: "User", index: true },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    providerId: { type: String, default: null },
    avatar: { type: String, default: "" },
});

userSchema.index({ fullNameSearch: "text", email: "text"});

function normalize(str) {
    if (!str) return "";
    const cleaned = removePrefix(str);
    return cleaned
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

userSchema.pre("save", async function (next) {
    if (this.isModified("fullName") || this.isNew) {
        this.fullNameSearch = normalize(this.fullName || "");
    }

    if (this.provider === "local" || !this.provider) {
        if (this.isModified("password")) {
            this.password = bcrypt.hash(this.password, 10);
        }
    }

    next();
});

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);