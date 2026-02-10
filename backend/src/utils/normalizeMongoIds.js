import mongoose from "mongoose";

export function transformIds(value) {
    if (value instanceof Date) {
        return value;
    }

    // 👈 QUAN TRỌNG: bắt ObjectId trước
    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(transformIds);
    }

    if (value && typeof value === "object") {
        const transformed = {};

        for (const key in value) {
            if (key === "_id") {
                transformed.id = transformIds(value[key]);
            } else {
                transformed[key] = transformIds(value[key]);
            }
        }

        return transformed;
    }

    return value;
}
