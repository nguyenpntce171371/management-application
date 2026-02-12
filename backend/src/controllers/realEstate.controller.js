import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";
import { uploadMultipleImages, verifyTempToken } from "../services/storage.service.js";
import { normalize, removePrefix } from "../utils/string.js";
import { getCachedImageUrl } from "../utils/cachedImage.js";
import { executeCursorPaginatedQuery, parseSort } from "../utils/query.js";
import { transformIds } from "../utils/normalizeMongoIds.js";
import { Role } from "../config/role.js";

export const getRealEstate = async (req, res) => {
    try {
        const baseQuery = {};

        if (req.query.status && req.query.status !== "all") {
            baseQuery.status = req.query.status;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["price", "createdAt"]);

        const userLevel = Role[req.user.role] ?? 0;
        const requiredLevel = Role["STAFF"] ?? 999;

        const select = userLevel < requiredLevel ? "propertyType price images address width length status" : "propertyType price images address width length status location area usableArea constructionValue landUseRightUnitPrice";

        const options = {
            select,
            sortBy,
            sortOrder,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true
        }

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(RealEstate, baseQuery, options);

        const processedData = await Promise.all(
            data.map(async ({ images, ...rest }) => ({
                ...rest,
                ...(images?.length && {
                    images: (await Promise.all(images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : img))).filter(Boolean)
                })
            }))
        );

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(processedData)
        });
    } catch (error) {
        console.error("Get Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getNearbyRealEstate = async (req, res) => {
    try {
        const { street, ward, district, province } = req.query;

        if (!street || !ward || !district || !province) {
            return res.status(400).json({
                success: false,
                code: "MISSING_PARAMS",
                message: "Thiếu tham số địa chỉ cần thiết"
            });
        }

        const baseQuery = {};

        baseQuery.provinceSearch = normalize(province);
        baseQuery.districtSearch = normalize(district);
        baseQuery.wardSearch = normalize(ward);
        const streetSearch = normalize(street);

        const userLevel = Role[req.user.role] ?? 0;
        const requiredLevel = Role["STAFF"] ?? 999;

        const select = userLevel < requiredLevel ? "propertyType price images address width length status" : "propertyType price images address width length status location area usableArea constructionValue landUseRightUnitPrice";

        const options = {
            select,
            sortBy: "priority",
            sortOrder: -1,
            cursor: req.query.cursor,
            direction: req.query.direction,
            limit: req.query.limit,
            lean: true,

            extraStages: [
                {
                    $addFields: {
                        priority: {
                            $cond: [
                                { $eq: ["$streetSearch", streetSearch] },
                                2,
                                1
                            ]
                        }
                    }
                }
            ]
        };

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(RealEstate, baseQuery, options);

        const processedData = await Promise.all(
            data.map(async ({ images, ...rest }) => ({
                ...rest,
                ...(images?.length && {
                    images: (await Promise.all(images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : img))).filter(Boolean)
                })
            }))
        );

        return res.status(200).json({
            success: true,
            code: "NEARBY_REAL_ESTATE_LIST",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(processedData)
        });
    } catch (error) {
        console.error("Get Nearby Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedRealEstates = async (req, res) => {
    try {
        const baseQuery = { deletedAt: { $ne: null } };

        if (req.query.status && req.query.status !== "all") {
            baseQuery.status = req.query.status;
        }

        const searchText = normalize(req.query.search);
        if (searchText) {
            baseQuery.$text = { $search: searchText };
        }

        const { sortBy, sortOrder } = parseSort(req.query, ["price", "createdAt"]);
        const options = {
            select: "propertyType address price deletedAt",
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

        const { data, hasMore, hasPrev, nextCursor, prevCursor } = await executeCursorPaginatedQuery(RealEstate, baseQuery, options);

        return res.status(200).json({
            success: true,
            code: "DELETED_REAL_ESTATES_FETCHED",
            pagination: {
                hasMore,
                hasPrev,
                nextCursor,
                prevCursor
            },
            data: transformIds(data)
        });
    } catch (error) {
        console.error("Get Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_REAL_ESTATE_ID",
                message: "Thiếu Real Estate Id"
            });
        }

        const item = await RealEstate.findById(id).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }

        const processedItem = {
            ...item,
            ...(item.images?.length && {
                images: await Promise.all(item.images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : img))
            })
        };

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_FOUND",
            data: transformIds(processedItem)
        });
    } catch (error) {
        console.error("Get Real Estate Error:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const filter = { _id: id, deletedAt: null };
        if (currentUser.role === "User") {
            filter.postedBy = currentUser.id;
        }

        const result = await RealEstate.updateOne(
            filter,
            { $set: { deletedAt: new Date(), deletedBy: currentUser.id } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND_OR_FORBIDDEN",
                message: "Không tìm thấy bất động sản hoặc bạn không có quyền xóa",
            });
        }

        io.to("User").emit("realEstateDeleted");

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_DELETED",
            message: "Xóa bất động sản thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Delete Real Estate Error:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreRealEstate = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_APPRAISAL_ID",
                message: "Thiếu Appraisal Id"
            });
        }

        const currentUser = req.user;

        const filter = {
            _id: id,
            deletedAt: { $ne: null },
            ...(currentUser.role === "User" && { postedBy: currentUser.id })
        };

        const result = await RealEstate.updateOne(
            filter,
            { $set: { deletedAt: null, deletedBy: null } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND_OR_FORBIDDEN",
                message: "Không tìm thấy hoặc bạn không có quyền khôi phục bất động sản này",
            });
        }

        io.to("User").emit("realEstateRestored");

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_RESTORED",
            message: "Khôi phục bất động sản thành công",
            data: { id }
        });
    } catch (error) {
        console.error("Error restoring real estate:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const permanentDeleteRealEstate = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_REAL_ESTATE_ID",
                message: "Thiếu Real Estate Id"
            });
        }

        const item = await RealEstate.findOneAndDelete({ _id: id, deletedAt: { $ne: null } }).select({ images: 1 }).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản đã xóa",
            });
        }

        if (item.images?.length) {
            await deleteMultipleImages(item.images);
        }

        io.to("Admin").emit("realEstatePermanentlyDeleted");

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn bất động sản thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting real estate:", error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản đã xóa",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const createComparisonRealEstate = async (req, res) => {
    try {
        const { propertyType, province, district, ward, street, location } = req.body;

        if (!propertyType || !province || !district || !ward || !street) {
            return res.status(400).json({
                success: false,
                code: "MISSING_FIELDS",
                message: "Thiếu thông tin địa chỉ"
            });
        }

        if (location.lat !== undefined) {
            const latNum = parseFloat(location.lat);
            if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Tọa độ không hợp lệ",
                });
            }
        }

        if (location.lng !== undefined) {
            const lngNum = parseFloat(location.lng);
            if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Tọa độ không hợp lệ",
                });
            }
        }

        const item = await RealEstate.create({
            propertyType,
            province,
            district,
            ward,
            street,
            location: {
                description: location?.description || "",
                landParcel: location?.landParcel || "",
                lat: location?.lat || "",
                lng: location?.lng || ""
            },
            status: "Chờ duyệt",
            postedBy: req.user.id,
            contacts: {}
        });

        return res.status(201).json({
            success: true,
            code: "COMPARISON_REAL_ESTATE_CREATED",
            data: item._id.toString()
        });
    } catch (error) {
        console.error("Create Comparison Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const createRealEstate = async (req, res) => {
    try {
        const {
            propertyType,
            price,
            length,
            width,
            area,
            usableArea,
            bedrooms,
            bathrooms,
            province,
            district,
            ward,
            street,
            description,
            lat,
            lng,
            name,
            phone
        } = req.body;
        let objectNames = [];

        const validationErrors = [];

        if (!propertyType) validationErrors.push("propertyType is required");
        if (!length) validationErrors.push("length is required");
        if (!width) validationErrors.push("width is required");
        if (!street || !province || !district || !ward) validationErrors.push("address fields are required");
        if (!phone) validationErrors.push("phone is required");

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                message: process.env.APP_MODE === "development" ? `Validation errors: ${validationErrors.join(", ")}` : "Các trường bắt buộc bị thiếu",
            });
        }

        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                message: "Số điện thoại không hợp lệ",
            });
        }

        const lengthNum = parseFloat(length);
        const widthNum = parseFloat(width);

        if (isNaN(lengthNum) || isNaN(widthNum) || lengthNum <= 0 || widthNum <= 0) {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                message: "Kich thước dài và rộng không hợp lệ",
            });
        }

        if (bedrooms !== undefined) {
            const bedroomsNum = parseInt(bedrooms);
            if (isNaN(bedroomsNum) || bedroomsNum < 0) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Số phòng ngủ không hợp lệ",
                });
            }
        }

        if (bathrooms !== undefined) {
            const bathroomsNum = parseInt(bathrooms);
            if (isNaN(bathroomsNum) || bathroomsNum < 0) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Số phòng tắm không hợp lệ",
                });
            }
        }

        if (lat !== undefined) {
            const latNum = parseFloat(lat);
            if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Tọa độ không hợp lệ",
                });
            }
        }

        if (lng !== undefined) {
            const lngNum = parseFloat(lng);
            if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Tọa độ không hợp lệ",
                });
            }
        }

        if (req.files?.length) {
            objectNames = await uploadMultipleImages(req.files, "real-estates");
        }

        const location = {
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null
        };

        const contacts = [{
            name: name || "",
            phone,
            email: "",
            note: ""
        }];

        const postedBy = req.user.id;

        const item = await RealEstate.create({
            propertyType,
            price: price || "",
            length: lengthNum.toString(),
            width: widthNum.toString(),
            area: area || (lengthNum * widthNum).toFixed(2),
            usableArea: usableArea || "",
            bedrooms: bedrooms ? parseInt(bedrooms) : null,
            bathrooms: bathrooms ? parseInt(bathrooms) : null,
            province: removePrefix(province),
            district: removePrefix(district),
            ward: removePrefix(ward),
            street: removePrefix(street),
            description: description || "",
            images: objectNames,
            contacts,
            location,
            postedBy,
            status: "Chờ duyệt",
            listedAt: new Date()
        });

        const processedItem = {
            ...item,
            ...(item.images?.length && {
                images: await Promise.all(item.images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : img))
            })
        };

        io.to("User").emit("realEstateCreated");

        return res.status(201).json({
            success: true,
            code: "REAL_ESTATE_CREATED",
            message: "Tạo bất động sản thành công",
            data: transformIds(processedItem)
        });
    } catch (error) {
        console.error("Create Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const modifyRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_REAL_ESTATE_ID",
                message: "Thiếu Real Estate Id"
            });
        }

        const currentUser = req.user;
        const updateData = req.body;

        const filter = { _id: id };
        if (currentUser.role === "User") {
            filter.postedBy = currentUser.id;
        }

        const existingProperty = await RealEstate.findOne(filter);
        if (!existingProperty) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND_OR_FORBIDDEN",
                message: "Không tìm thấy hoặc không có quyền cập nhật",
            });
        }

        const ALLOWED_STATUS = ["Chờ duyệt", "Đang bán", "Đã bán"];
        if (updateData.status !== undefined && !ALLOWED_STATUS.includes(updateData.status)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_STATUS",
                message: `Trạng thái phải là một trong các giá trị: ${ALLOWED_STATUS.join(", ")}`,
            });
        }

        const allowedFields = ["propertyType", "length", "width", "area", "usableArea", "floors", "bedrooms", "bathrooms", "direction", "price", "legalStatus", "address", "description", "contacts", "location", "status"];

        const sanitizedData = {};
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                sanitizedData[key] = updateData[key];
            }
        }

        let finalImages = [...(existingProperty.images || [])];

        if (typeof updateData.contacts === "string") {
            try {
                sanitizedData.contacts = JSON.parse(updateData.contacts);
            } catch (e) {
                console.error("Error parsing contacts:", e);
            }
        }

        if (updateData.deletedImages) {
            let deletedImages = [];

            try {
                deletedImages =
                    typeof updateData.deletedImages === "string" ? JSON.parse(updateData.deletedImages) : updateData.deletedImages;
            } catch (e) {
                console.error("Error parsing deletedImages:", e);
            }

            const realFilePathsToDelete = [];

            for (const img of deletedImages) {
                if (!img) continue;

                if (img.startsWith("http")) {
                    const token = img.split("/api/files/temp/")[1];
                    if (!token) continue;

                    const filePath = verifyTempToken(token);
                    if (filePath) {
                        realFilePathsToDelete.push(filePath);
                    }
                } else {
                    realFilePathsToDelete.push(img);
                }
            }

            finalImages = finalImages.filter(
                img => !realFilePathsToDelete.includes(img)
            );
        }

        if (req.files?.length) {
            const newImagePaths = await uploadMultipleImages(req.files, "real-estates");
            finalImages = [...finalImages, ...newImagePaths];
        }

        sanitizedData.images = finalImages;

        const item = await RealEstate.findOneAndUpdate(
            filter,
            { $set: sanitizedData },
            { new: true }
        ).lean();

        const processedItem = {
            ...item,
            ...(item.images?.length && {
                images: await Promise.all(item.images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : img))
            })
        };

        io.to("User").emit("realEstateUpdated");

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_UPDATED",
            message: "Cập nhật bất động sản thành công",
            data: transformIds(processedItem),
        });
    } catch (error) {
        console.error(error);
        if (error.name === "CastError") {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getRealEstateStats = async (req, res) => {
    try {
        const totalRealEstate = await RealEstate.countDocuments();

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_STATS",
            data: {
                total: totalRealEstate
            }
        });
    } catch (error) {
        console.error("Error fetching real estate statistics:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};