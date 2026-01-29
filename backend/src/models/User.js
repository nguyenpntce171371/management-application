import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { normalize } from "../utils/string";

const userSchema = new mongoose.Schema({
    fullName: { type: String },
    fullNameSearch: { type: String, index: true },
    email: { type: String, required: true, unique: true, index: true },
    password: {
        type: String, required: function () {
            return this.provider === "local" || !this.provider;
        }
    },
    role: { type: String, enum: ["Admin", "Staff", "User"], default: "User", index: true },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    providerId: { type: String, default: null },
    avatar: { type: String, default: "" },
    address: { type: String, default: "" },
    addressSearch: { type: String, index: true },
    phone: { type: String, default: "" },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

userSchema.index({ fullNameSearch: "text", email: "text", addressSearch: "text" });

userSchema.pre("save", async function (next) {
    if (this.isModified("fullName") || this.isNew) {
        this.fullNameSearch = normalize(this.fullName);
    }
    if (this.isModified("address") || this.isNew) {
        this.addressSearch = normalize(this.address);
    }
    next();
});

userSchema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
        this.where({ deletedAt: null });
    }
    next();
});

userSchema.methods.softDelete = async function (deletedBy) {
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    return await this.save();
};

userSchema.methods.restore = async function () {
    this.deletedAt = null;
    this.deletedBy = null;
    return await this.save();
};

userSchema.statics.findDeleted = function (conditions = {}) {
    return this.find({ ...conditions, deletedAt: { $ne: null } });
};

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

userSchema.methods.setPassword = async function (password) {
    this.password = await bcrypt.hash(password, 10);
};

export default mongoose.model("User", userSchema);