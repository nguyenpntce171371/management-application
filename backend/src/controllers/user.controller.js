import mongoose from "mongoose";
import RealEstate from "../models/RealEstate.js";
import { io } from "../index.js";
import { createImageFingerprint, uploadMultipleImagesToOCI, deleteMultipleImagesFromOCI, generateReadPAR } from "../services/oci.service.js";
import { redis } from "../middlewares/rateLimitRedis.js";
import NodeCache from "node-cache";
import User from "../models/User.js";

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
        const user = await User.findById(req.user.userId).lean();
        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found"
            });
        }

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "USER_FETCHED",
            message: "User fetched successfully",
            data: {
                id: user.userId,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                address: user.address,
                avatar: avatarUrl
            }
        });
    } catch (error) {
        console.error("Get user error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Something went wrong while fetching user info"
        });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);

        const { fullName, address } = req.body;
        const updateData = {};
        let hasChange = false;

        if (fullName !== undefined && fullName !== user.fullName) {
            updateData.fullName = fullName;
            hasChange = true;
        }

        if (address !== undefined && address !== user.address) {
            updateData.address = address;
            hasChange = true;
        }

        if (req.file) {
            const [avatarPath] = await uploadMultipleImagesToOCI([req.file], "avatars");

            if (user.avatar) {
                await deleteMultipleImagesFromOCI([user.avatar]);
            }

            updateData.avatar = avatarPath;
            hasChange = true;
        }

        if (!hasChange) {
            return res.status(200).json({
                success: true,
                code: "NO_CHANGES",
                message: "No changes detected",
                data: user
            });
        }

        Object.assign(user, updateData);
        await user.save();

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "USER_UPDATED",
            message: "Profile updated successfully",
            data: {
                id: user._id,
                fullName: user.fullName,
                address: user.address,
                email: user.email,
                avatar: avatarUrl,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Update User Profile Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to update profile"
        });
    }
};

export const deleteUserAvatar = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                code: "USER_NOT_FOUND",
                message: "User not found"
            });
        }

        if (!user.avatar) {
            return res.status(400).json({
                success: false,
                code: "NO_AVATAR",
                message: "User does not have an avatar to delete"
            });
        }

        const avatarPath = user.avatar;

        if (avatarPath && !avatarPath.startsWith("http")) {
            await deleteMultipleImagesFromOCI([avatarPath]);
            imageUrlCache.del(avatarPath);
        }

        user.avatar = null;
        await user.save();

        return res.status(200).json({
            success: true,
            code: "AVATAR_DELETED",
            message: "Avatar deleted successfully",
            data: {
                id: user._id,
                fullName: user.fullName,
                address: user.address,
                email: user.email,
                avatar: null,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Delete Avatar Error:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: "Failed to delete avatar"
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
            message: "Fetched real estate data successfully",
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

        if (!id) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Real estate not found",
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
            message: "Fetched real estate successfully",
            data: processedItem,
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

        await Promise.all([item.images?.length ? deleteMultipleImagesFromOCI(item.images) : Promise.resolve(), RealEstate.deleteOne({ _id: id })]);

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

        const ALLOWED_STATUS = ["Chờ duyệt", "Đang bán", "Đã bán"];
        if (updateData.status !== undefined && !ALLOWED_STATUS.includes(updateData.status)) {
            return res.status(400).json({
                success: false,
                code: "INVALID_STATUS",
                message: `Status must be one of: ${ALLOWED_STATUS.join(", ")}`,
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