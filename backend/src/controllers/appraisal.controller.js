import Appraisal from "../models/Appraisal.js";
import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";
import { executeCursorPaginatedQuery, parseSort } from "../utils/query.js";
import { normalize } from "../utils/string.js";
import { transformIds } from "../utils/normalizeMongoIds.js";

export const getAppraisals = async (req, res) => {
    try {
        const baseQuery = {};

        if (req.query.status && req.query.status !== "all") {
            baseQuery.status = req.query.status;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["createdAt"]);

        const options = {
            select: "code customerName propertyType appraiser createdAt completedAt status notes searchText",
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(Appraisal, baseQuery, options);

        const processedData = data.map(({ _id, ...rest }) => ({
            ...rest,
            id: _id.toString()
        }));

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: processedData
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

export const getDeletedAppraisals = async (req, res) => {
    try {
        const baseQuery = { deletedAt: { $ne: null } };

        if (req.query.status && req.query.status !== "all") {
            baseQuery.status = req.query.status;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["createdAt"]);

        const options = {
            select: "code customerName propertyType status deletedAt",
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            populate: {
                path: "deletedBy",
                select: "fullName"
            },
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(Appraisal, baseQuery, options);

        const processedData = data.map(({ _id, ...rest }) => ({
            ...rest,
            id: _id.toString()
        }));

        return res.status(200).json({
            success: true,
            code: "DELETED_APPRAISAL_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: processedData
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

export const getAppraisalById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_APPRAISAL_ID",
                message: "Thiếu Appraisal Id"
            });
        }

        const appraisal = await Appraisal.findById(id).lean();

        if (!appraisal) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_FOUND",
            data: transformIds(appraisal)
        });
    } catch (error) {
        console.error("Error fetching appraisal:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }
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
            code: { $regex: `^HS-${year}-` },
            deletedAt: { $exists: true }
        }).sort({ code: -1 }).select("code").lean();

        let nextNumber = 1;
        if (lastAppraisal) {
            const lastSeq = parseInt(lastAppraisal.code.split("-")[2], 10);
            nextNumber = lastSeq + 1;
        }

        const newAppraisal = new Appraisal({
            code: `HS-${year}-${String(nextNumber).padStart(3, "0")}`,
            status: "pending"
        });

        await newAppraisal.save();

        io.to("Staff").emit("appraisalCreated");

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

        const allowedFields = [
            "customerName",
            "propertyType",
            "status",
            "appraiser",
            "createdAt",
            "completedAt",
            "notes"
        ];

        const update = {};

        for (const field of allowedFields) {
            if (field in req.body) {
                if (field === "createdAt" || field === "completedAt") {
                    update[field] = req.body[field] ? new Date(req.body[field]) : null;
                } else {
                    update[field] = req.body[field];
                }
            }
        }

        if (!Object.keys(update).length) {
            return res.status(400).json({
                success: false,
                code: "NO_FIELDS_TO_UPDATE",
                message: "Không có dữ liệu để cập nhật"
            });
        }

        const result = await Appraisal.findByIdAndUpdate(
            id,
            { $set: update },
            { new: true, runValidators: true }
        ).lean();

        if (!result) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }

        io.to("Staff").emit("appraisalUpdated");

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_PATCHED",
            message: "Cập nhật hồ sơ thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error patching appraisal:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }
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
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_APPRAISAL_ID",
                message: "Thiếu Appraisal ID"
            });
        }

        const appraisal = await Appraisal.updateOne(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date(), deletedBy: req.user.id } }
        );

        if (!appraisal.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }

        io.to("Staff").emit("appraisalDeleted");

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_DELETED",
            message: "Xóa hồ sơ thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error deleting appraisal:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }
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
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_APPRAISAL_ID",
                message: "Thiếu Appraisal Id"
            });
        }

        const result = await Appraisal.updateOne(
            { _id: id, deletedAt: { $ne: null } },
            { $set: { deletedAt: null, deletedBy: null } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }

        io.to("Staff").emit("appraisalRestored");

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_RESTORED",
            message: "Khôi phục hồ sơ thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error restoring appraisal:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }
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
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_APPRAISAL_ID",
                message: "Thiếu Appraisal Id"
            });
        }

        const result = await Appraisal.deleteOne({ _id: id, deletedAt: { $ne: null } });
        if (!result.deletedCount) {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }

        io.to("Admin").emit("appraisalPermanentlyDeleted");

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn hồ sơ thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting appraisal:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ đã xóa",
            });
        }
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
                message: "Thiếu thông tin hoặc không đúng định dạng"
            });
        }

        const requiredAssetFields = ["district", "guidedPriceAverage", "land", "location", "name", "province", "selectedComparisons", "street", "ward"];
        const requiredComparisonFields = ["id"];
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

        const assetsForAppraisal = assets.map((asset) => ({
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
            selectedComparisons: asset.selectedComparisons.map((comp) => ({
                realEstateId: comp.id,
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
            ward: asset.ward,
            width: asset.width
        }));

        const constructionsForAppraisal = (constructions && Array.isArray(constructions)) ? constructions.map((construction) => ({
            area: construction.area,
            description: construction.description,
            qualityRemaining: construction.qualityRemaining,
            unitPrice: construction.unitPrice,
        })) : [];

        const appraisal = await Appraisal.findByIdAndUpdate(
            id,
            {
                $set: {
                    assets: assetsForAppraisal,
                    constructions: constructionsForAppraisal
                }
            },
            {
                new: true,
                runValidators: true
            }
        ).lean();

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
                const currentRealEstate = await RealEstate.findById(comp.id).select({ location: 1 }).lean();

                const realEstateData = {
                    area: comp.area,
                    businessAdvantage: comp.businessAdvantage,
                    constructionUnitPrice: comp.constructionUnitPrice,
                    constructionValue: comp.constructionValue,
                    convertibleAreaLimit: comp.convertibleAreaLimit,
                    currentUsageStatus: comp.currentUsageStatus,
                    estimatedPrice: comp.estimatedPrice,
                    infrastructure: comp.infrastructure,
                    land: comp.land.map((land) => ({
                        landArea: land.landArea,
                        landType: land.landType,
                        location: land.location,
                        ontLandPrice: land.ontLandPrice,
                        streetDescription: land.streetDescription
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
                    usableArea: comp.usableArea,
                    width: comp.width
                };

                realEstatePromises.push(
                    RealEstate.findOneAndUpdate(
                        { _id: comp.id },
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

        io.to("Staff").emit("appraisalUpdated");
        io.to("User").emit("realEstateUpdated");

        return res.status(200).json({
            success: true,
            code: "APPRAISAL_ASSETS_UPDATED",
            message: "Cập nhật tài sản hồ sơ thành công",
            data: transformIds(appraisal)
        });
    } catch (error) {
        console.error(error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "APPRAISAL_NOT_FOUND",
                message: "Không tìm thấy hồ sơ"
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};