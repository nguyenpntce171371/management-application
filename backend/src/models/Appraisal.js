import mongoose from "mongoose";
import { normalize } from "../utils/string.js";
import { AssetSchema } from "./AppraisalAsset.js";
import { ConstructionSchema } from "./ConstructionAsset.js";

const AppraisalSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    customerName: String,
    propertyType: String,
    appraiser: String,
    completedAt: Date,
    status: String,
    notes: String,
    assets: [AssetSchema],
    constructions: [ConstructionSchema],
    searchText: String,
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

AppraisalSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
AppraisalSchema.index({ searchText: "text" });

AppraisalSchema.pre("save", function (next) {
    let searchText = "";

    if (this.code) {
        searchText += normalize(this.code).replace("-", " ") + " ";
    }

    if (this.customerName) {
        searchText += normalize(this.customerName) + " ";
    }

    if (this.notes) {
        searchText += normalize(this.notes) + " ";
    }

    if (this.propertyType) {
        searchText += normalize(this.propertyType) + " ";
    }

    if (this.assets.length) {
        this.assets.forEach((asset) => {
            if (asset.name) {
                searchText += normalize(asset.name) + " ";
            }
        });
    }

    this.searchText = searchText.trim();
    next();
});

AppraisalSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.code || fields.customerName || fields.notes || fields.propertyType || fields.assets)) return next();

    let searchText = "";

    if (fields.code) {
        searchText += normalize(fields.code).replace("-", " ") + " ";
    }

    if (fields.customerName) {
        searchText += normalize(fields.customerName) + " ";
    }

    if (fields.notes) {
        searchText += normalize(fields.notes) + " ";
    }

    if (fields.propertyType) {
        searchText += normalize(fields.propertyType) + " ";
    }

    if (fields.assets.length) {
        if (Array.isArray(fields.assets)) {
            fields.assets.forEach((asset) => {
                if (asset.name) {
                    searchText += normalize(asset.name) + " ";
                }
            });
        }
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
    }

    next();
});

AppraisalSchema.pre("updateOne", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.code || fields.customerName || fields.notes || fields.propertyType || fields.assets)) return next();

    let searchText = "";

    if (fields.code) {
        searchText += normalize(fields.code).replace("-", " ") + " ";
    }

    if (fields.customerName) {
        searchText += normalize(fields.customerName) + " ";
    }

    if (fields.notes) {
        searchText += normalize(fields.notes) + " ";
    }

    if (fields.propertyType) {
        searchText += normalize(fields.propertyType) + " ";
    }

    if (fields.assets.length) {
        if (Array.isArray(fields.assets)) {
            fields.assets.forEach((asset) => {
                if (asset.name) {
                    searchText += normalize(asset.name) + " ";
                }
            });
        }
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
    }

    next();
});

AppraisalSchema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
        this.where({ deletedAt: null });
    }
    next();
});

export default mongoose.model("Appraisal", AppraisalSchema);