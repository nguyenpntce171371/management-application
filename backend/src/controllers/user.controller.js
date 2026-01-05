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
                message: "Không tìm thấy người dùng"
            });
        }

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "USER_FETCHED",
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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
                message: "Không có thay đổi nào được thực hiện",
                data: user
            });
        }

        Object.assign(user, updateData);
        await user.save();

        io.to(user._id).emit("profileUpdated", user);
        io.to("Admin").emit("userUpdated", user);

        let avatarUrl = user.avatar;

        if (user.avatar && !user.avatar.startsWith("http")) {
            avatarUrl = await getCachedImageUrl(user.avatar);
        }

        return res.status(200).json({
            success: true,
            code: "USER_UPDATED",
            message: "Cập nhật hồ sơ người dùng thành công",
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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
                message: "Không tìm thấy người dùng"
            });
        }

        if (!user.avatar) {
            return res.status(400).json({
                success: false,
                code: "NO_AVATAR",
                message: "Không có avatar để xóa"
            });
        }

        const avatarPath = user.avatar;

        if (avatarPath && !avatarPath.startsWith("http")) {
            await deleteMultipleImagesFromOCI([avatarPath]);
            imageUrlCache.del(avatarPath);
        }

        user.avatar = null;
        await user.save();

        io.to(user._id).emit("profileUpdated", user);

        return res.status(200).json({
            success: true,
            code: "AVATAR_DELETED",
            message: "Xóa avatar thành công",
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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};

export const deleteRealEstateById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        const item = await RealEstate.findById(id).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                code: "REAL_ESTATE_NOT_FOUND",
                message: "Không tìm thấy bất động sản",
            });
        }

        if (currentUser.role === "User" && (String(item.postedBy) !== String(currentUser.userId))) {
            return res.status(403).json({
                success: false,
                code: "FORBIDDEN_IDOR",
                message: "Không được phép xóa bất động sản không thuộc sở hữu của bạn",
            });
        }

        await Promise.all([item.images?.length ? deleteMultipleImagesFromOCI(item.images) : Promise.resolve(), RealEstate.deleteOne({ _id: id })]);

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
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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
                message: processing.env.NODE_ENV === "development" ? `Validation errors: ${validationErrors.join(", ")}` : "Các trường bắt buộc bị thiếu",
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
            const fingerprintPromises = req.files.map(file => createImageFingerprint(file.buffer));
            const allFingerprints = await Promise.all(fingerprintPromises);

            for (let i = 0; i < allFingerprints.length; i++) {
                const fp = allFingerprints[i];
                if (!fp) {
                    await cleanupLocks(fpLocks);
                    return res.status(400).json({
                        success: false,
                        code: process.env.NODE_ENV === "development" ? "FINGERPRINT_ERROR" : "UPLOAD_ERROR",
                        message: process.env.NODE_ENV === "development" ? `Không thể tạo dấu vân tay hình ảnh cho: ${req.files[i].originalname}` : "Không thể tải hình ảnh lên",
                    });
                }

                const exist = await redis.get(`imgfp:${fp}`);
                if (exist) {
                    await cleanupLocks(fpLocks);
                    return res.status(400).json({
                        success: false,
                        code: process.env.NODE_ENV === "development" ? "DUPLICATE_IMAGE" : "UPLOAD_ERROR",
                        message: process.env.NODE_ENV === "development" ? `Hình ảnh trùng lặp được phát hiện: ${req.files[i].originalname}` : "Không thể tải hình ảnh lên",
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
                    message: process.env.NODE_ENV === "development" ? uploadError.message : "Không thể tải hình ảnh lên",
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
        io.to("User").emit("realEstateCreated", JSON.parse(JSON.stringify(created)));

        return res.status(201).json({
            success: true,
            code: "REAL_ESTATE_CREATED",
            message: "Tạo bất động sản thành công",
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
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
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

        if (currentUser.role === "User" && String(item.postedBy) !== String(currentUser.userId)) {
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

        io.to("User").emit("realEstateUpdated", JSON.parse(JSON.stringify(updated)));

        return res.status(200).json({
            success: true,
            code: "REAL_ESTATE_UPDATED",
            message: "Cập nhật bất động sản thành công",
            data: updated,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: process.env.NODE_ENV === "development" ? error.message : "Lỗi máy chủ"
        });
    }
};