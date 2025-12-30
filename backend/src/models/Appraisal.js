import mongoose from "mongoose";

const LandSchema = new mongoose.Schema({
    landType: String,
    streetDescription: String,
    location: String,
    landArea: String,
    ontLandPrice: String
}, { _id: false });

const AssetComparisonSchema = new mongoose.Schema({
    id: String,
    _id: String,
    areaRate: String,
    businessRate: String,
    environmentRate: String,
    isComparison: Boolean,
    adjustedLandUnitPrice: Number,
    locationRate: String,
    shapeRate: String,
    sizeRate: String,
    guidedPrice: Number
}, { _id: false });

const AssetSchema = new mongoose.Schema({
    area: String,
    businessAdvantage: String,
    createdAt: Number,
    currentUsageStatus: String,
    district: String,
    guidedPriceAverage: Number,
    guidedPrice: Number,
    id: { type: String, required: true },
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
    updatedAt: Date,
    ward: String,
    width: String,
    _id: { type: String, required: true }
}, { _id: false });

const ConstructionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    area: String,
    description: String,
    qualityRemaining: String,
    unitPrice: String,
    updatedAt: String
});

const AppraisalSchema = new mongoose.Schema({
    code: { type: String, required: true, index: true },
    customerName: { type: String },
    propertyType: { type: String },
    appraiser: { type: String },
    createdDate: { type: Date },
    completedDate: { type: Date },
    status: { type: String },
    notes: String,
    assets: [AssetSchema],
    constructions: [ConstructionSchema]
}, { timestamps: true });

AppraisalSchema.index({
    code: "text",
    customerName: "text",
    notes: "text",
    propertyType: "text",
    "assets.name": "text",
    "assets.district": "text",
    "assets.province": "text",
    "assets.ward": "text",
    "assets.street": "text"
});

export default mongoose.model("Appraisal", AppraisalSchema);
