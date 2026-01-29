import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";
import NodeCache from "node-cache";
import { uploadMultipleImagesToOCI, deleteMultipleImagesFromOCI, generateReadPAR } from "../services/oci.service.js";
import { normalize, removePrefix } from "../utils/string.js";

const imageUrlCache = new NodeCache({
    stdTTL: 1800,
    checkperiod: 600,
    useClones: false,
    maxKeys: 10000
});

const getCachedImageUrl = async (imagePath) => {
    if (!(imagePath && !imagePath.startsWith("http"))) return imagePath;

    const cachedUrl = imageUrlCache.get(imagePath);
    if (cachedUrl) return cachedUrl;

    try {
        const url = await generateReadPAR(imagePath, 30);
        imageUrlCache.set(imagePath, url);
        return url;
    } catch (error) {
        console.error(`Failed to generate URL for ${imagePath}:`, error);
        return null;
    }
};

export const getRealEstate = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const type = req.query.type || "all";
        const location = req.query.location || "all";
        const status = req.query.status || "all";
        const sortBy = req.query.sortBy || "listedAt";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const query = {};

        if (status !== "all") {
            query.status = status;
        }

        if (type !== "all") {
            query.propertyTypeSearch = normalize(type);
        }

        if (location !== "all") {
            const normalizedLocation = normalize(location);
            query.$or = [
                { addressSearch: { $regex: normalizedLocation, $options: "i" } },
                { provinceSearch: { $regex: normalizedLocation, $options: "i" } },
                { districtSearch: { $regex: normalizedLocation, $options: "i" } }
            ];
        }

        if (search) {
            const normalizedSearch = normalize(search);
            query.$or = [
                { propertyTypeSearch: { $regex: normalizedSearch, $options: "i" } },
                { addressSearch: { $regex: normalizedSearch, $options: "i" } }
            ];
        }

        const [total, data] = await Promise.all([
            RealEstate.countDocuments(query),
            RealEstate.find(query)
                .select("propertyType price address province district ward street images listedAt status bedrooms bathrooms area")
                .sort({ [sortBy]: sortOrder, _id: sortOrder })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const processedData = await Promise.all(
            data.map(async (item) => {
                if (item.images?.length) {
                    const processedImages = await Promise.all(
                        item.images.map(img =>
                            img && !img.startsWith("http") ? getCachedImageUrl(img) : Promise.resolve(img)
                        )
                    );
                    return {
                        ...item,
                        images: processedImages.filter(Boolean)
                    };
                }
                return item;
            })
        );

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_LIST",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            },
            data: processedData
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
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }

        const item = await RealEstate.findById(id).lean();

        const processedItem = { ...item };
        if (item.images?.length) {
            processedItem.images = await Promise.all(
                item.images.map(img =>
                    img && !img.startsWith("http") ? getCachedImageUrl(img) : Promise.resolve(img)
                )
            );
        }

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_FOUND",
            data: processedItem,
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

export const deleteRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const item = await RealEstate.findOne({ _id: id, deletedAt: null });

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }

        if (currentUser.role === "User" && (String(item.postedBy) !== String(currentUser.id))) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN_IDOR",
                message: "Không được phép xóa bất động sản không thuộc sở hữu của bạn",
            });
        }

        await item.softDelete(currentUser.id);

        io.to("User").emit("realEstateDeleted", { id });

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_DELETED",
            message: "Xóa bất động sản thành công",
            data: { id },
        });

    } catch (error) {
        console.error("Delete Real Estate Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const getDeletedRealEstates = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const currentUser = req.user;

        let query = { deletedAt: { $ne: null } };

        if (currentUser.role === "User") {
            query.postedBy = currentUser.id;
        }

        const deletedItems = await RealEstate.findDeleted()
            .select("propertyType address province district price status images deletedAt deletedBy postedBy")
            .populate("deletedBy", "fullName email")
            .populate("postedBy", "fullName email")
            .sort({ deletedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await RealEstate.countDocuments(query);

        return res.status(200).json({
            success: true,
            code: "DELETED_REAL_ESTATES_FETCHED",
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            data: deletedItems,
        });
    } catch (error) {
        console.error("Error fetching deleted real estates:", error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.APP_MODE === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const restoreRealEstate = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const item = await RealEstate.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản đã xóa",
            });
        }

        if (currentUser.role === "User" && (String(item.postedBy) !== String(currentUser.id))) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN",
                message: "Không được phép khôi phục bất động sản không thuộc sở hữu của bạn",
            });
        }

        await item.restore();

        io.to("User").emit("realEstateRestored", { id });

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_RESTORED",
            message: "Khôi phục bất động sản thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error restoring real estate:", error);
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

        const item = await RealEstate.findOne({ _id: id, deletedAt: { $ne: null } });

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản đã xóa",
            });
        }

        if (item.images?.length) {
            await deleteMultipleImagesFromOCI(item.images);
        }

        await item.deleteOne();

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_PERMANENTLY_DELETED",
            message: "Xóa vĩnh viễn bất động sản thành công",
            data: { id },
        });
    } catch (error) {
        console.error("Error permanently deleting real estate:", error);
        res.status(500).json({
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
                message: processing.env.APP_MODE === "development" ? `Validation errors: ${validationErrors.join(", ")}` : "Các trường bắt buộc bị thiếu",
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
            objectNames = await uploadMultipleImagesToOCI(req.files, "real-estate");
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

        const newRealEstate = new RealEstate({
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
            address: `${street}, ${ward}, ${district}, ${province}`,
            description: description || "",
            images: objectNames,
            contacts,
            location,
            postedBy,
            status: "Chờ duyệt",
            listedAt: new Date()
        });

        const created = await newRealEstate.save();

        const createdObj = created.toObject();

        let processedCreated = createdObj;
        if (createdObj.images?.length) {
            const processedImages = await Promise.all(createdObj.images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : Promise.resolve(img)));
            processedCreated = { ...createdObj, images: processedImages.filter(Boolean) };
        }

        io.to("User").emit("realEstateCreated", processedCreated);

        return res.status(201).json({
            success: true,
            code: "REAL_ESTATE_CREATED",
            message: "Tạo bất động sản thành công",
            data: processedCreated
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
        const currentUser = req.user;
        const updateData = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                code: "MISSING_ID",
                message: "ID bất động sản là bắt buộc",
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

        const item = await RealEstate.findById(id);

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }

        if (currentUser.role === "User" && String(item.postedBy) !== String(currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN_IDOR",
                message: "Không được phép cập nhật bất động sản không thuộc sở hữu của bạn",
            });
        }

        const allowedFields = ["propertyType", "length", "width", "area", "usableArea", "floors", "bedrooms", "bathrooms", "direction", "price", "legalStatus", "address", "description", "contacts", "location", "status"];

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

        const updatedObj = updated.toObject();

        let processedUpdated = updatedObj;
        if (updatedObj.images?.length) {
            const processedImages = await Promise.all(updatedObj.images.map(img => img && !img.startsWith("http") ? getCachedImageUrl(img) : Promise.resolve(img)));
            processedUpdated = { ...updatedObj, images: processedImages.filter(Boolean) };
        }

        io.to("User").emit("realEstateUpdated", processedUpdated);

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_UPDATED",
            message: "Cập nhật bất động sản thành công",
            data: processedUpdated,
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
            code: "REAL_ESTATE_STATS",
            data: {
                total: totalRealEstate,
                topProvinces,
                propertyTypeDistribution
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

const buildMatchPipeline = ({ street, ward, district, province, locationFilter }) => {
    const streetSearch = normalize(street);
    const wardSearch = normalize(ward);
    const districtSearch = normalize(district);
    const provinceSearch = normalize(province);

    return [
        {
            $match: {
                provinceSearch: { $exists: true, $nin: [null, ""] },
                districtSearch: { $exists: true, $nin: [null, ""] },
                wardSearch: { $exists: true, $nin: [null, ""] },
                streetSearch: { $exists: true, $nin: [null, ""] },
                ...locationFilter
            }
        },
        {
            $addFields: {
                priority: {
                    $switch: {
                        branches: [
                            {
                                case: {
                                    $and: [
                                        { $eq: [{ $toLower: "$provinceSearch" }, provinceSearch] },
                                        { $eq: [{ $toLower: "$districtSearch" }, districtSearch] },
                                        { $eq: [{ $toLower: "$wardSearch" }, wardSearch] },
                                        { $eq: [{ $toLower: "$streetSearch" }, streetSearch] }
                                    ]
                                },
                                then: 2
                            },
                            {
                                case: {
                                    $and: [
                                        { $eq: [{ $toLower: "$provinceSearch" }, provinceSearch] },
                                        { $eq: [{ $toLower: "$districtSearch" }, districtSearch] },
                                        { $eq: [{ $toLower: "$wardSearch" }, wardSearch] }
                                    ]
                                },
                                then: 1
                            }
                        ],
                        default: 0
                    }
                }
            }
        },
        { $match: { priority: { $gt: 0 } } }
    ];
};

const buildPipeline = ({ street, ward, district, province, page, limit, locationFilter }) => {
    const skip = (page - 1) * limit;

    return [
        ...buildMatchPipeline({ street, ward, district, province, locationFilter }),
        { $sort: { priority: -1, street: 1, listedAt: -1 } },
        { $skip: skip },
        { $limit: limit }
    ];
};

export const getNearbyRealEstate = async (req, res) => {
    try {
        const { street, ward, district, province, page = 1, limit = 12 } = req.query;

        if (!province || !district || !ward || !street) {
            return res.status(400).json({
                success: false,
                code: "MISSING_PARAMS",
                message: "Thiếu tham số địa chỉ cần thiết"
            });
        }

        const locationFilter = {};
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const [countResult, data] = await Promise.all([
            RealEstate.aggregate([
                ...buildMatchPipeline({ street, ward, district, province, locationFilter }),
                { $count: "total" }
            ]),
            RealEstate.aggregate([
                ...buildPipeline({
                    street,
                    ward,
                    district,
                    province,
                    page: pageNum,
                    limit: limitNum,
                    locationFilter
                })
            ])
        ]);

        const total = countResult.length > 0 ? countResult[0].total : 0;

        const processedData = await Promise.all(
            data.map(async (item) => {
                if (item.images?.length) {
                    const processedImages = await Promise.all(
                        item.images.map(img =>
                            img && !img.startsWith("http") ? getCachedImageUrl(img) : Promise.resolve(img)
                        )
                    );
                    return {
                        ...item,
                        images: processedImages.filter(Boolean)
                    };
                }
                return item;
            })
        );

        return res.status(200).json({
            success: true,
            code: "NEARBY_REAL_ESTATE",
            message: "Lấy bất động sản gần đây thành công",
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: pageNum * limitNum < total
            },
            data: processedData
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