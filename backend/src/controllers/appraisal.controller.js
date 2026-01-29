import Appraisal from "../models/Appraisal.js";
import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";

export const getAppraisals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";
        const status = req.query.status || "all";
        const sortBy = req.query.sortBy || "createdDate";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const filter = {};

        if (status !== "all") {
            filter.status = status;
        }

        if (search.trim()) {
            filter.$or = [
                { code: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                { "assets.name": { $regex: search, $options: "i" } },
            ];
        }

        const query = Appraisal.find(filter).select("code customerName propertyType appraiser createdDate completedDate status notes").sort({ [sortBy]: sortOrder, _id: sortOrder }).skip(skip).limit(limit);

        const [data, total] = await Promise.all([
            query,
            Appraisal.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            code: "APPRAISALS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            },
            data
        });
    } catch (error) {
        console.error("Error fetching appraisals:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
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

        io.to("Staff").emit("appraisalCreated", JSON.parse(JSON.stringify(newAppraisal)));

        return res.status(201).json({
            success: true,
            code: "APPRAISAL_CREATED",
            message: "Tạo hồ sơ thành công",
            data: newAppraisal
        });
    } catch (error) {
        console.error("Error creating appraisal:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getAppraisalById = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await Appraisal.findById(id);

        if (!appraisal)
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_STATS",
            data: appraisal
        });
    } catch (error) {
        console.error("Error fetching appraisal:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const updateAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_ID",
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
                code: "NO_FIELDS_TO_UPDATE",
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
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }

        io.to("Staff").emit("appraisalUpdated", JSON.parse(JSON.stringify(appraisal)));

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_UPDATED",
            message: "Cập nhật hồ sơ thành công",
            data: appraisal
        });
    } catch (error) {
        console.error("Error updating appraisal:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await Appraisal.findOne({ _id: id, deletedAt: null });

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }

        await appraisal.softDelete(req.user.id);

        io.to("Staff").emit("appraisalDeleted", id);

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_DELETED",
            message: "Xóa hồ sơ thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error deleting appraisal:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedAppraisals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const deletedAppraisals = await Appraisal.findDeleted()
            .select("code customerName propertyType status deletedAt deletedBy")
            .populate("deletedBy", "fullName email")
            .sort({ deletedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Appraisal.countDocuments({ deletedAt: { $ne: null } });

        return res.status(200).json({
            success: true,
            code: "DELETED_APPRAISALS_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: deletedAppraisals,
        });
    } catch (error) {
        console.error("Error fetching deleted appraisals:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await Appraisal.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }

        await appraisal.restore();

        io.to("Staff").emit("appraisalRestored", id);

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_RESTORED",
            message: "Khôi phục hồ sơ thành công",
            data: { id, code: appraisal.code },
        });
    } catch (error) {
        console.error("Error restoring appraisal:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const permanentDeleteAppraisal = async (req, res) => {
    try {
        const { id } = req.params;

        const appraisal = await Appraisal.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }

        await appraisal.deleteOne();

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn hồ sơ thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting appraisal:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const updateAppraisalAssets = async (req, res) => {
    try {
        const { id } = req.params;
        const { assets, constructions } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_ID",
                message: "Thiếu id để xác định hồ sơ cần cập nhật"
            });
        }

        if (!assets || !Array.isArray(assets) || assets.length === 0) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ASSETS",
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
        })) : [];

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
                code: "APPRAISAL_NOT_FOUND",
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

        io.to("Staff").emit("appraisalUpdated", JSON.parse(JSON.stringify(appraisal)));
        for (const asset of assets) {
            for (const comp of asset.selectedComparisons) {
                io.to("User").emit("realEstateUpdated", JSON.parse(JSON.stringify(comp)));
            }
        }

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_ASSETS_UPDATED",
            message: "Cập nhật tài sản hồ sơ thành công",
            data: appraisal
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};