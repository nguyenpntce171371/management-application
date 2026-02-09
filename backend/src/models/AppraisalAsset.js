import mongoose from "mongoose";
import { LandSchema } from "./Land.js";

const AssetComparisonSchema = new mongoose.Schema({
    realEstateId: { type: mongoose.Schema.Types.ObjectId, ref: "RealEstate", required: true },
    areaRate: String,
    businessRate: String,
    environmentRate: String,
    isComparison: Boolean,
    adjustedLandUnitPrice: Number,
    locationRate: String,
    shapeRate: String,
    sizeRate: String,
    guidedPrice: Number
});

export const AssetSchema = new mongoose.Schema({
    area: String,
    businessAdvantage: String,
    convertibleAreaLimit: String,
    currentUsageStatus: String,
    district: String,
    guidedPriceAverage: Number,
    guidedPrice: Number,
    infrastructure: String,
    land: [LandSchema],
    legalStatus: String,
    length: String,
    livingEnvironment: String,
    shape: String,
    location: {
        description: String,
        landParcel: String
    },
    name: String,
    province: String,
    selectedComparisons: [AssetComparisonSchema],
    street: String,
    ward: String,
    width: String
});

