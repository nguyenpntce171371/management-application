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

function buildSearchText(doc) {
    let searchText = "";

    if (doc.code) {
        searchText += normalize(doc.code).replace(/-/g, " ") + " ";
    }

    if (doc.customerName) {
        searchText += normalize(doc.customerName) + " ";
    }

    if (doc.appraiser) {
        searchText += normalize(doc.appraiser);
    }

    return searchText.trim();
}

AppraisalSchema.pre("save", function (next) {
    this.searchText = buildSearchText(this);
    next();
});

AppraisalSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (fields.code || fields.customerName || fields.appraiser) {
        const docToUpdate = await this.model.findOne(this.getQuery());

        if (docToUpdate) {
            const mergedDoc = {
                code: fields.code !== undefined ? fields.code : docToUpdate.code,
                customerName: fields.customerName !== undefined ? fields.customerName : docToUpdate.customerName,
                appraiser: fields.appraiser !== undefined ? fields.appraiser : docToUpdate.appraiser
            };

            fields.searchText = buildSearchText(mergedDoc);

            if (update.$set) {
                update.$set = fields;
            } else {
                this.setUpdate(fields);
            }
        }
    }

    next();
});

AppraisalSchema.pre("updateOne", async function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (fields.code || fields.customerName || fields.appraiser) {
        const docToUpdate = await this.model.findOne(this.getQuery());

        if (docToUpdate) {
            const mergedDoc = {
                code: fields.code !== undefined ? fields.code : docToUpdate.code,
                customerName: fields.customerName !== undefined ? fields.customerName : docToUpdate.customerName,
                appraiser: fields.appraiser !== undefined ? fields.appraiser : docToUpdate.appraiser
            };

            fields.searchText = buildSearchText(mergedDoc);

            if (update.$set) {
                update.$set = fields;
            } else {
                this.setUpdate(fields);
            }
        }
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