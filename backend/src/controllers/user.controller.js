import mongoose from "mongoose";
import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";
import { createImageFingerprint, uploadMultipleImagesToOCI, deleteMultipleImagesFromOCI, generateReadPAR } from "../services/oci.service.js";
import { redis } from "../middlewares/rateLimitRedis.js";
import NodeCache from "node-cache";

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

const removePrefix = (str) => {
    return str?.replace(/^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn|Đường|Đ\.|Đg|Street)\s+/i, "").trim() || "";
};

const normalize = (str) => {
    const cleaned = removePrefix(str);
    return cleaned?.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase() || "";
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

async function cleanupLocks(locks) {
    if (!locks?.length) return;

    try {
        await Promise.all(locks.map(lock => redis.del(lock)));
    } catch (error) {
        console.error("Failed to cleanup locks:", error);
    }
}

export const getUser = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found",
            });
        }

        return res.status(200).json({
            success: true,
            code: "USER_FETCHED",
            message: "User fetched successfully",
            data: {
                id: user.userId,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        console.error("Get user error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong while fetching user info",
        });
    }
};

export const getRealEstateData = async (req, res) => {
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

        await Promise.all(
            data.map(async (item) => {
                if (item.images?.length) {
                    const firstImage = item.images[0];
                    if (firstImage && !firstImage.startsWith("http")) {
                        const url = await getCachedImageUrl(firstImage);
                        item.imageUrls = url ? [url] : [];
                    } else {
                        item.imageUrls = [firstImage];
                    }
                }
            })
        );

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_LIST",
            message: "Fetched real estate data successfully",
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
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to get real estate data",
        });
    }
};

const detailCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

export const getRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                message: "Invalid real estate ID",
            });
        }

        const cacheKey = `detail:${id}`;
        let item = detailCache.get(cacheKey);

        if (!item) {
            item = await RealEstate.findById(id).lean();

            if (!item) {
                return res.status(404).json({
                    success: false,
                    code: "REAL_ESTATE_NOT_FOUND",
                    message: "Real estate not found",
                });
            }

            detailCache.set(cacheKey, item);
        }


        if (item.images?.length) {
            item.imageUrls = await Promise.all(
                item.images.map(img => {
                    if (img && !img.startsWith("http")) {
                        return getCachedImageUrl(img);
                    }
                    return img;
                })
            );
        }

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_FOUND",
            message: "Fetched real estate successfully",
            data: item,
        });
    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to get real estate data",
        });
    }
};

export const deleteRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                message: "Invalid real estate ID",
            });
        }

        const item = await RealEstate.findById(id).lean();

        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Real estate not found",
            });
        }

        if (currentUser.role === "User" && (String(item.postedBy) !== String(currentUser.userId))) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN_IDOR",
                message: "You are not allowed to delete real estate you do not own",
            });
        }

        await Promise.all([
            item.images?.length ? deleteMultipleImagesFromOCI(item.images) : Promise.resolve(),
            RealEstate.deleteOne({ _id: id }),
            Promise.resolve().then(() => {
                detailCache.del(`detail:${id}`);
                item.images?.forEach(img => imageUrlCache.del(img));
            })
        ]);

        io.emit("real_estate:deleted", { id });

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_DELETED",
            message: "Real estate has been deleted successfully",
            data: { id },
        });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to delete real estate",
        });
    }
};

export const getNearbyRealEstate = async (req, res) => {
    try {
        const { street, ward, district, province, page = 1, limit = 12 } = req.query;

        if (!province || !district || !ward || !street) {
            return res.status(400).json({
                success: false,
                code: "MISSING_PARAMS",
                message: "Province, district, ward, and street are required"
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

        await Promise.all(
            data.map(async (item) => {
                if (item.images?.length) {
                    const firstImage = item.images[0];
                    if (firstImage && !firstImage.startsWith("http")) {
                        const url = await getCachedImageUrl(firstImage);
                        item.imageUrls = url ? [url] : [];
                    } else {
                        item.imageUrls = [firstImage];
                    }
                }
            })
        );

        return res.status(200).json({
            success: true,
            code: "NEARBY_REAL_ESTATE",
            message: "Fetched nearby real estate successfully",
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: pageNum * limitNum < total
            },
            data
        });

    } catch (err) {
        console.error("Nearby Real Estate Error:", err);
        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to get nearby real estate"
        });
    }
};

export const createRealEstate = async (req, res) => {
    let objectNames = [];
    let fingerprints = [];
    let fpLocks = [];

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
                message: validationErrors.join(", "),
            });
        }

        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                message: "Invalid phone number format (10-11 digits required)",
            });
        }

        const lengthNum = parseFloat(length);
        const widthNum = parseFloat(width);

        if (isNaN(lengthNum) || isNaN(widthNum) || lengthNum <= 0 || widthNum <= 0) {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                message: "Length and width must be positive numbers",
            });
        }

        if (bedrooms !== undefined) {
            const bedroomsNum = parseInt(bedrooms);
            if (isNaN(bedroomsNum) || bedroomsNum < 0) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Bedrooms must be a non-negative number",
                });
            }
        }

        if (bathrooms !== undefined) {
            const bathroomsNum = parseInt(bathrooms);
            if (isNaN(bathroomsNum) || bathroomsNum < 0) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Bathrooms must be a non-negative number",
                });
            }
        }

        if (lat !== undefined) {
            const latNum = parseFloat(lat);
            if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Latitude must be between -90 and 90",
                });
            }
        }

        if (lng !== undefined) {
            const lngNum = parseFloat(lng);
            if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
                return res.status(400).json({
                    success: false,
                    code: "VALIDATION_ERROR",
                    message: "Longitude must be between -180 and 180",
                });
            }
        }

        if (req.files?.length) {
            const fingerprintPromises = req.files.map(file => createImageFingerprint(file.buffer));
            const allFingerprints = await Promise.all(fingerprintPromises);

            for (let i = 0; i < allFingerprints.length; i++) {
                const fp = allFingerprints[i];
                if (!fp) {
                    await cleanupLocks(fpLocks);
                    return res.status(400).json({
                        success: false,
                        code: "FINGERPRINT_ERROR",
                        message: `Failed to create fingerprint for image: ${req.files[i].originalname}`,
                    });
                }

                const exist = await redis.get(`imgfp:${fp}`);
                if (exist) {
                    await cleanupLocks(fpLocks);
                    return res.status(400).json({
                        success: false,
                        code: "DUPLICATE_IMAGE",
                        message: `Image "${req.files[i].originalname}" already exists in another listing`,
                    });
                }

                fingerprints.push(fp);
            }

            const lockPromises = fingerprints.map(fp => {
                const lockKey = `imgfp_lock:${fp}`;
                fpLocks.push(lockKey);
                return redis.setex(lockKey, 600, "pending");
            });
            await Promise.all(lockPromises);

            try {
                objectNames = await uploadMultipleImagesToOCI(req.files, "real-estate");

                await Promise.all([
                    ...fingerprints.map(fp => redis.del(`imgfp:${fp}`)),
                    cleanupLocks(fpLocks)
                ]);
                fpLocks = [];

            } catch (uploadError) {
                console.error("Upload error:", uploadError);
                await cleanupLocks(fpLocks);

                return res.status(500).json({
                    success: false,
                    code: "UPLOAD_ERROR",
                    message: "Failed to upload images to Object Storage",
                    error: uploadError.message,
                });
            }
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

        const postedBy = req.user?.userId || null;

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
        io.emit("real_estate:created", JSON.parse(JSON.stringify(created)));

        return res.status(201).json({
            success: true,
            code: "REAL_ESTATE_CREATED",
            message: "Real estate created successfully",
            data: created
        });

    } catch (error) {
        console.error("Create Real Estate Error:", error);

        await Promise.all([
            objectNames.length ? deleteMultipleImagesFromOCI(objectNames) : Promise.resolve(),
            cleanupLocks(fpLocks)
        ]);

        return res.status(500).json({
            success: false,
            code: "DATABASE_ERROR",
            message: "Failed to create real estate listing"
        });
    }
};