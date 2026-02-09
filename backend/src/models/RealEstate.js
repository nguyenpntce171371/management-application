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

realEstateSchema.pre("save", function (next) {
    let searchText = "";

    if (this.propertyType) {
        searchText += normalize(this.propertyType) + " ";
    }

    if (this.province) {
        this.provinceSearch = normalize(this.province);
        searchText += this.provinceSearch + " ";
    }

    if (this.district) {
        this.districtSearch = normalize(this.district);
        searchText += this.districtSearch + " ";
    }

    if (this.ward) {
        this.wardSearch = normalize(this.ward);
        searchText += this.wardSearch + " ";
    }

    if (this.street) {
        this.streetSearch = normalize(this.street);
        searchText += this.streetSearch + " ";
    }

    this.address = `${this.street}, ${this.ward}, ${this.district}, ${this.province}`;

    this.searchText = searchText.trim();
    next();
});

realEstateSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.propertyType || fields.street || fields.ward || fields.district || fields.province)) return next();

    let searchText = "";

    if (fields.propertyType) {
        searchText += normalize(fields.propertyType) + " ";
    }

    if (fields.province) {
        fields.provinceSearch = normalize(fields.province);
        searchText += fields.provinceSearch + " ";
    }

    if (fields.district) {
        fields.districtSearch = normalize(fields.district);
        searchText += fields.districtSearch + " ";
    }

    if (fields.ward) {
        fields.wardSearch = normalize(fields.ward);
        searchText += fields.wardSearch + " ";
    }

    if (fields.street) {
        fields.streetSearch = normalize(fields.street);
        searchText += fields.streetSearch + " ";
    }

    if (fields.street || fields.ward || fields.district || fields.province) {
        fields.address = `${fields.street || ""}, ${fields.ward || ""}, ${fields.district || ""}, ${fields.province || ""}`;
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
    }

    next();
});

realEstateSchema.pre("updateOne", function (next) {
    const update = this.getUpdate();
    const fields = update.$set || update;

    if (!(fields.propertyType || fields.street || fields.ward || fields.district || fields.province)) return next();

    let searchText = "";

    if (fields.propertyType) {
        searchText += normalize(fields.propertyType) + " ";
    }

    if (fields.province) {
        fields.provinceSearch = normalize(fields.province);
        searchText += fields.provinceSearch + " ";
    }

    if (fields.district) {
        fields.districtSearch = normalize(fields.district);
        searchText += fields.districtSearch + " ";
    }

    if (fields.ward) {
        fields.wardSearch = normalize(fields.ward);
        searchText += fields.wardSearch + " ";
    }

    if (fields.street) {
        fields.streetSearch = normalize(fields.street);
        searchText += fields.streetSearch + " ";
    }

    if (fields.street || fields.ward || fields.district || fields.province) {
        fields.address = `${fields.street || ""}, ${fields.ward || ""}, ${fields.district || ""}, ${fields.province || ""}`;
    }

    fields.searchText = searchText.trim();

    if (update.$set) {
        update.$set = fields;
    } else {
        this.setUpdate(fields);
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