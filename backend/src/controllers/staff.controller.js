import mongoose from "mongoose";
import RealEstate from "../models/RealEstate.js";
import Appraisal from "../models/Appraisal.js";
import { io } from "../index.js";
import convert from "../services/address.service.js";

export const modifyRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_ID",
                message: "Real estate ID is required",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_OBJECT_ID",
                message: "Provided ID is not a valid ObjectId",
            });
        }

        const item = await RealEstate.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Real estate not found",
            });
        }

        if (currentUser.role === "User" && String(item.postedBy) !== String(currentUser.userId)) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN_IDOR",
                message: "You are not allowed to modify real estate you do not own",
            });
        }

        const allowedFields = ["propertyType", "length", "width", "area", "usableArea", "floors", "bedrooms", "bathrooms", "direction", "price", "legalStatus", "address", "description", "images", "contacts", "location", "status"];

        const sanitizedData = {};
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                sanitizedData[key] = updateData[key];
            }
        }

        const updated = await RealEstate.findByIdAndUpdate(
            id,
            { $set: sanitizedData },
            { new: true }
        );

        io.emit("real_estate:updated", JSON.parse(JSON.stringify(updated)));

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_UPDATED",
            message: "Real estate updated successfully",
            data: updated,
        });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to update real estate",
        });
    }
};

export const getRealEstateStats = async (req, res) => {
    try {
        const totalRealEstate = await RealEstate.countDocuments();

        const topProvinces = await RealEstate.aggregate([
            {
                $group: {
                    _id: "$province",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $project: {
                    _id: 0,
                    province: "$_id",
                    count: 1
                }
            }
        ]);

        const propertyTypeAggregation = await RealEstate.aggregate([
            {
                $group: {
                    _id: "$propertyType",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const propertyTypeDistribution = propertyTypeAggregation.map(item => ({
            propertyType: item._id,
            count: item.count,
            percent: ((item.count / totalRealEstate) * 100).toFixed(1) + "%"
        }));

        return res.status(200).json({
            success: true,
            data: {
                total: totalRealEstate,
                topProvinces,
                propertyTypeDistribution
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

export const convertAddress = async (req, res) => {
    try {
        const address = req.query.address || req.body.address;
        const newAddress = convert(address);
        return res.status(200).json({
            success: true,
            code: "SUCCESS",
            data: {
                old: address,
                new: newAddress
            }
        });

    } catch (err) {
        console.error("Convert Address Error:", err);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to convert address"
        });
    }
};

export const getAppraisals = async (req, res) => {
    try {
        const { search = "", status = "all" } = req.query;
        const filter = {};
        if (status !== "all") filter.status = status;

        if (search) {
            filter.$or = [
                { code: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                { "assets.name": { $regex: search, $options: "i" } },
            ];
        }

        const appraisals = await Appraisal
            .find(filter)
            .select("code customerName propertyType appraiser createdDate completedDate status notes")
            .sort({ createdDate: -1 });
        res.json({ success: true, data: appraisals });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const createAppraisal = async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();

        const lastAppraisal = await Appraisal.findOne({
            code: { $regex: `^HS-${year}-` }
        }).sort({ code: -1 }).select("code");

        let nextNumber = 1;
        if (lastAppraisal) {
            const lastSeq = parseInt(lastAppraisal.code.split("-")[2], 10);
            nextNumber = lastSeq + 1;
        }

        const code = `HS-${year}-${String(nextNumber).padStart(3, "0")}`;
        const status = "pending";
        const newAppraisal = new Appraisal({
            ...req.body,
            code,
            status,
            createdDate: now
        });

        await newAppraisal.save();
        io.emit("appraisal:created", JSON.parse(JSON.stringify(newAppraisal)));

        res.status(201).json({ success: true, data: newAppraisal });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getAppraisalById = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await Appraisal.findById(id);

        if (!appraisal)
            return res.status(404).json({ success: false, message: "Not found" });

        res.json({ success: true, data: appraisal });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const updateAppraisalInfo = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Thiếu id để xác định hồ sơ cần cập nhật"
            });
        }

        const allowedFields = ["customerName", "propertyType", "status", "appraiser"];
        const updateData = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Không có trường nào để cập nhật"
            });
        }

        updateData.updatedAt = new Date();

        const appraisal = await Appraisal.findByIdAndUpdate(
            id,
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        );

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ"
            });
        }

        io.emit("appraisal:updated", JSON.parse(JSON.stringify(appraisal)));

        res.json({
            success: true,
            data: appraisal
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

export const deleteAppraisal = async (req, res) => {
    try {
        const { id } = req.params;
        const appraisal = await Appraisal.findById(id);
        if (!appraisal) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ" });

        if (appraisal.assets && appraisal.assets.length > 0) {
            const assetIds = appraisal.assets.map(a => a._id);
            await RealEstate.deleteMany({ _id: { $in: assetIds } });
        }

        await appraisal.deleteOne();
        io.emit("appraisal:deleted", id);
        res.json({ success: true, message: "Đã xóa hồ sơ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

export const updateAppraisalAssets = async (req, res) => {
    try {
        const { id } = req.params;
        const { assets, constructions } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Thiếu id để xác định hồ sơ cần cập nhật"
            });
        }

        if (!assets || !Array.isArray(assets) || assets.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin assets hoặc assets không đúng định dạng"
            });
        }

        const requiredAssetFields = ["district", "guidedPriceAverage", "id", "land", "location", "name", "province", "selectedComparisons", "street", "ward", "_id"];
        const requiredComparisonFields = ["id", "_id"];
        const requiredConstructionFields = ["id"];

        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const missingFields = [];

            for (const field of requiredAssetFields) {
                if (asset[field] === undefined) {
                    missingFields.push(`assets[${i}].${field}`);
                }
            }

            if (asset.land) {
                if (!Array.isArray(asset.land)) {
                    missingFields.push(`assets[${i}].land (phải là array)`);
                } 
            }

            if (asset.location) {
                if (typeof asset.location !== "object" || asset.location === null) {
                    missingFields.push(`assets[${i}].location (phải là object)`);
                }
            }

            if (asset.selectedComparisons) {
                if (!Array.isArray(asset.selectedComparisons)) {
                    missingFields.push(`assets[${i}].selectedComparisons (phải là array)`);
                } else {
                    asset.selectedComparisons.forEach((comp, j) => {
                        for (const field of requiredComparisonFields) {
                            if (comp[field] === undefined) {
                                missingFields.push(`assets[${i}].selectedComparisons[${j}].${field}`);
                            }
                        }
                    });
                }
            }

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    code: "MISSING_FIELD",
                    message: `Các trường sau bị thiếu hoặc undefined: ${missingFields.join(", ")}`
                });
            }
        }

        if (constructions && Array.isArray(constructions)) {
            for (let i = 0; i < constructions.length; i++) {
                const construction = constructions[i];
                const missingFields = [];

                for (const field of requiredConstructionFields) {
                    if (construction[field] === undefined) {
                        missingFields.push(`constructions[${i}].${field}`);
                    }
                }

                if (missingFields.length > 0) {
                    return res.status(400).json({
                        success: false,
                        code: "MISSING_FIELD",
                        message: `Các trường sau bị thiếu hoặc undefined: ${missingFields.join(", ")}`
                    });
                }
            }
        }

        const assetsForAppraisal = assets.map(asset => ({
            _id: asset._id,
            id: asset.id,
            name: asset.name,
            area: asset.area,
            businessAdvantage: asset.businessAdvantage,
            convertibleAreaLimit: asset.convertibleAreaLimit,
            currentUsageStatus: asset.currentUsageStatus,
            district: asset.district,
            guidedPriceAverage: asset.guidedPriceAverage,
            infrastructure: asset.infrastructure,
            land: asset.land.map(l => ({
                landType: l.landType,
                streetDescription: l.streetDescription,
                location: l.location,
                landArea: l.landArea,
                ontLandPrice: l.ontLandPrice
            })),
            legalStatus: asset.legalStatus,
            length: asset.length,
            livingEnvironment: asset.livingEnvironment,
            location: {
                description: asset.location.description,
                landParcel: asset.location.landParcel
            },
            province: asset.province,
            selectedComparisons: asset.selectedComparisons.map(comp => ({
                id: comp.id,
                _id: comp._id,
                areaRate: comp.areaRate,
                businessRate: comp.businessRate,
                environmentRate: comp.environmentRate,
                isComparison: comp.isComparison,
                adjustedLandUnitPrice: comp.adjustedLandUnitPrice,
                locationRate: comp.locationRate,
                shapeRate: comp.shapeRate,
                sizeRate: comp.sizeRate,
                guidedPrice: comp.guidedPrice
            })),
            shape: asset.shape,
            street: asset.street,
            updatedAt: new Date(),
            ward: asset.ward,
            width: asset.width
        }));

        const constructionsForAppraisal = constructions && Array.isArray(constructions) ? constructions.map(construction => ({
            id: construction.id,
            area: construction.area,
            description: construction.description,
            qualityRemaining: construction.qualityRemaining,
            unitPrice: construction.unitPrice,
            updatedAt: new Date()
        }))
            : [];

        const appraisal = await Appraisal.findByIdAndUpdate(
            id,
            {
                $set: {
                    assets: assetsForAppraisal,
                    constructions: constructionsForAppraisal,
                    updatedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy hồ sơ"
            });
        }

        const realEstatePromises = [];

        for (const asset of assets) {
            if (!Array.isArray(asset.selectedComparisons)) continue;

            for (const comp of asset.selectedComparisons) {
                const currentRealEstate = await RealEstate.findById(comp._id);

                const realEstateData = {
                    area: comp.area,
                    businessAdvantage: comp.businessAdvantage,
                    constructionUnitPrice: comp.constructionUnitPrice,
                    constructionValue: comp.constructionValue,
                    convertibleAreaLimit: comp.convertibleAreaLimit,
                    currentUsageStatus: comp.currentUsageStatus,
                    estimatedPrice: comp.estimatedPrice,
                    infrastructure: comp.infrastructure,
                    land: comp.land.map(l => ({
                        landArea: l.landArea,
                        landType: l.landType,
                        location: l.location,
                        ontLandPrice: l.ontLandPrice,
                        streetDescription: l.streetDescription
                    })),
                    landUseRightUnitPrice: comp.landUseRightUnitPrice,
                    legalStatus: comp.legalStatus,
                    length: comp.length,
                    livingEnvironment: comp.livingEnvironment,
                    location: {
                        lat: currentRealEstate?.location?.lat,
                        lng: currentRealEstate?.location?.lng,
                        description: comp.location.description,
                        landParcel: comp.location.landParcel
                    },
                    percent: comp.percent,
                    price: comp.price,
                    qualityRemainingPercent: comp.qualityRemainingPercent,
                    shape: comp.shape,
                    source: comp.source,
                    transactionTime: comp.transactionTime,
                    updatedAt: new Date(),
                    usableArea: comp.usableArea,
                    width: comp.width
                };

                realEstatePromises.push(
                    RealEstate.findOneAndUpdate(
                        { _id: comp._id },
                        [
                            { $set: realEstateData },
                            {
                                $set: {
                                    contacts: {
                                        $cond: [
                                            { $gt: [{ $size: { $ifNull: ["$contacts", []] } }, 0] },
                                            [{ $mergeObjects: [{ $arrayElemAt: ["$contacts", 0] }, { phone: comp.contactInfo }] }],
                                            [{ phone: comp.contactInfo }]
                                        ]
                                    }
                                }
                            }
                        ],
                        { new: true }
                    )
                );
            }
        }

        await Promise.all(realEstatePromises);

        res.json({
            success: true,
            data: appraisal
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};