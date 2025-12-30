import mongoose from "mongoose";

const LandSchema = new mongoose.Schema({
    landType: String,
    streetDescription: String,
    location: String,
    landArea: String,
    ontLandPrice: String
}, { _id: false });

const RealEstateSchema = new mongoose.Schema({
    propertyType: { type: String, index: true },
    length: String,
    width: String,
    area: String,
    usableArea: String,
    floors: Number,
    bedrooms: Number,
    bathrooms: Number,
    direction: String,
    price: { type: String, index: true },
    legalStatus: String,
    address: { type: String, index: true },
    province: { type: String, index: true },
    district: { type: String, index: true },
    ward: { type: String, index: true },
    street: { type: String, index: true },

    propertyTypeSearch: { type: String, index: true },
    addressSearch: { type: String, index: true },
    provinceSearch: { type: String, index: true },
    districtSearch: { type: String, index: true },
    wardSearch: { type: String, index: true },
    streetSearch: { type: String, index: true },

    addressNote: { type: String, index: true },
    description: { type: String, index: true },
    images: [String],
    imageUrls: [String],
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
    status: { type: String, default: "Chờ duyệt" },
    listedAt: { type: Date, default: Date.now },
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
});

RealEstateSchema.index({
    propertyTypeSearch: "text",
    addressSearch: "text",
    streetSearch: "text",
    provinceSearch: "text",
    districtSearch: "text",
    wardSearch: "text"
});

function removePrefix(str) {
    if (!str) return "";
    return str
        .replace(/^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\s+/i, "")
        .trim();
}

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

RealEstateSchema.pre("save", function (next) {
    if (this.propertyType) {
        this.propertyTypeSearch = normalize(this.propertyType);
    }
    if (this.address) {
        this.addressSearch = normalize(this.address);
    }
    if (this.street) {
        this.streetSearch = normalize(this.street);
    }
    if (this.ward) {
        this.wardSearch = normalize(this.ward);
    }
    if (this.district) {
        this.districtSearch = normalize(this.district);
    }
    if (this.province) {
        this.provinceSearch = normalize(this.province);
    }
    next();
});

RealEstateSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();

    const fields = update.$set || update;

    if (fields.propertyType) {
        fields.propertyTypeSearch = normalize(fields.propertyType);
    }
    if (fields.address) {
        fields.addressSearch = normalize(fields.address);
    }
    if (fields.street) {
        fields.streetSearch = normalize(fields.street);
    }
    if (fields.ward) {
        fields.wardSearch = normalize(fields.ward);
    }
    if (fields.district) {
        fields.districtSearch = normalize(fields.district);
    }
    if (fields.province) {
        fields.provinceSearch = normalize(fields.province);
    }

    if (update.$set) {
        this.setUpdate({ ...update, $set: fields });
    } else {
        this.setUpdate(fields);
    }

    next();
});

export default mongoose.model("RealEstate", RealEstateSchema);