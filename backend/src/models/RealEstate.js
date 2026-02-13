import mongoose from "mongoose";
import { normalize } from "../utils/string.js";
import { LandSchema } from "./Land.js";

const realEstateSchema = new mongoose.Schema({
    propertyType: String,
    length: Number,
    width: Number,
    area: Number,
    usableArea: Number,
    floors: Number,
    bedrooms: Number,
    bathrooms: Number,
    direction: String,
    price: Number,
    legalStatus: String,
    address: String,
    province: String,
    provinceSearch: String,
    district: String,
    districtSearch: String,
    ward: String,
    wardSearch: String,
    street: String,
    streetSearch: String,
    addressNote: String,
    description: String,
    images: [String],
    contacts: [{
        name: String,
        phone: String,
        email: String,
        note: String
    }],
    location: {
        lat: Number,
        lng: Number,
        description: String,
        landParcel: String
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["Chờ duyệt", "Đang bán", "Đã bán"], default: "Chờ duyệt" },
    adjustedLandUnitPrice: Number,
    businessAdvantage: String,
    constructionUnitPrice: Number,
    constructionValue: Number,
    currentUsageStatus: String,
    estimatedPrice: Number,
    infrastructure: String,
    isComparison: Boolean,
    land: [LandSchema],
    landUseRightUnitPrice: Number,
    livingEnvironment: Number,
    percent: String,
    qualityRemainingPercent: String,
    shape: String,
    source: String,
    transactionTime: String,
    convertibleAreaLimit: String,
    searchText: String,
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

realEstateSchema.index({ status: 1, deletedAt: 1, createdAt: -1, _id: -1 });
realEstateSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
realEstateSchema.index({ searchText: "text" });

function buildSearchText(doc) {
    let searchText = "";

    if (doc.propertyType) {
        searchText += normalize(doc.propertyType) + " ";
    }

    if (doc.province) {
        searchText += normalize(doc.province) + " ";
    }

    if (doc.district) {
        searchText += normalize(doc.district) + " ";
    }

    if (doc.ward) {
        searchText += normalize(doc.ward) + " ";
    }

    if (doc.street) {
        searchText += normalize(doc.street);
    }

    return searchText.trim();
}

realEstateSchema.pre("save", function (next) {
    if (this.province) {
        this.provinceSearch = normalize(this.province);
    }

    if (this.district) {
        this.districtSearch = normalize(this.district);
    }

    if (this.ward) {
        this.wardSearch = normalize(this.ward);
    }

    if (this.street) {
        this.streetSearch = normalize(this.street);
    }

    this.address = `${this.street || ""}, ${this.ward || ""}, ${this.district || ""}, ${this.province || ""}`;
    this.searchText = buildSearchText(this);
    next();
});

realEstateSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (fields.propertyType || fields.street || fields.ward || fields.district || fields.province) {
        const docToUpdate = await this.model.findOne(this.getQuery());

        if (docToUpdate) {
            const mergedDoc = {
                propertyType: fields.propertyType !== undefined ? fields.propertyType : docToUpdate.propertyType,
                province: fields.province !== undefined ? fields.province : docToUpdate.province,
                district: fields.district !== undefined ? fields.district : docToUpdate.district,
                ward: fields.ward !== undefined ? fields.ward : docToUpdate.ward,
                street: fields.street !== undefined ? fields.street : docToUpdate.street
            };

            if (mergedDoc.province) {
                fields.provinceSearch = normalize(mergedDoc.province);
            }

            if (mergedDoc.district) {
                fields.districtSearch = normalize(mergedDoc.district);
            }

            if (mergedDoc.ward) {
                fields.wardSearch = normalize(mergedDoc.ward);
            }

            if (mergedDoc.street) {
                fields.streetSearch = normalize(mergedDoc.street);
            }

            fields.address = `${mergedDoc.street || ""}, ${mergedDoc.ward || ""}, ${mergedDoc.district || ""}, ${mergedDoc.province || ""}`;
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

realEstateSchema.pre("updateOne", async function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (fields.propertyType || fields.street || fields.ward || fields.district || fields.province) {
        const docToUpdate = await this.model.findOne(this.getQuery());

        if (docToUpdate) {
            const mergedDoc = {
                propertyType: fields.propertyType !== undefined ? fields.propertyType : docToUpdate.propertyType,
                province: fields.province !== undefined ? fields.province : docToUpdate.province,
                district: fields.district !== undefined ? fields.district : docToUpdate.district,
                ward: fields.ward !== undefined ? fields.ward : docToUpdate.ward,
                street: fields.street !== undefined ? fields.street : docToUpdate.street
            };

            if (mergedDoc.province) {
                fields.provinceSearch = normalize(mergedDoc.province);
            }

            if (mergedDoc.district) {
                fields.districtSearch = normalize(mergedDoc.district);
            }

            if (mergedDoc.ward) {
                fields.wardSearch = normalize(mergedDoc.ward);
            }

            if (mergedDoc.street) {
                fields.streetSearch = normalize(mergedDoc.street);
            }

            fields.address = `${mergedDoc.street || ""}, ${mergedDoc.ward || ""}, ${mergedDoc.district || ""}, ${mergedDoc.province || ""}`;
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

realEstateSchema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
        this.where({ deletedAt: null });
    }
    next();
});

export default mongoose.model("RealEstate", realEstateSchema);