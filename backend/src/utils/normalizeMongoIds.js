import mongoose from "mongoose";

export function transformIds(value, seen = new WeakMap()) {
    if (value instanceof Date) {
        return value;
    }

    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(item => transformIds(item, seen));
    }

    if (value && typeof value === "object") {
        if (seen.has(value)) {
            return seen.get(value);
        }

        const transformed = {};

        seen.set(value, transformed);

        for (const key in value) {
            if (key === "_id") {
                transformed.id = transformIds(value[key], seen);
            } else {
                transformed[key] = transformIds(value[key], seen);
            }
        }

        return transformed;
    }

    return value;
}
