import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { normalize, normalizeEmail } from "../utils/string.js";

const userSchema = new mongoose.Schema({
    fullName: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
        type: String, required: function () {
            return this.provider === "local" || !this.provider;
        }
    },
    role: { type: String, enum: ["Admin", "Staff", "User"], default: "User" },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    providerId: { type: String, default: null },
    avatar: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    searchText: String,
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

userSchema.index({ role: 1, deletedAt: 1, createdAt: -1, _id: -1 });
userSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
userSchema.index({ searchText: "text" });

userSchema.pre("save", async function (next) {
    if (this.isModified("fullName") || this.isModified("address") || this.isModified("email") || this.isNew) {
        this.searchText = normalize(this.fullName) + " " + normalize(this.address) + " " + normalizeEmail(this.email);
    }

    next();
});

userSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.fullName || fields.address || fields.email)) return next();

    let searchText = "";

    if (fields.fullName) {
        searchText += normalize(fields.fullName) + " ";
    }

    if (fields.address) {
        searchText += normalize(fields.address) + " ";
    }

    if (fields.email) {
        searchText += normalizeEmail(fields.email);
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
    }

    next();
});

userSchema.pre("updateOne", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.fullName || fields.address || fields.email)) return next();

    let searchText = "";

    if (fields.fullName) {
        searchText += normalize(fields.fullName) + " ";
    }

    if (fields.address) {
        searchText += normalize(fields.address) + " ";
    }

    if (fields.email) {
        searchText += normalizeEmail(fields.email);
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
    }

    next();
});

userSchema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
        this.where({ deletedAt: null });
    }
    next();
});

userSchema.statics.hashPassword = async function (value) {
    return bcrypt.hash(value, 10);
};

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);