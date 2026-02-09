export function transformIds(value) {
    if (value instanceof Date) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(transformIds);
    }

    if (value && typeof value === "object") {
        const { _id, ...rest } = value;
        const transformed = {};

        for (const key in rest) {
            transformed[key] = transformIds(rest[key]);
        }

        if (_id) {
            transformed.id = _id.toString();
        }

        return transformed;
    }

    return value;
}