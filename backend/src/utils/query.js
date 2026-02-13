export async function executeCursorPaginatedQuery(Model, baseQuery, options = {}) {
    const { select, sortBy = "createdAt", sortOrder = -1, cursor, direction = "next", limit: rawLimit, populate, lean = true } = options;
    const limit = Math.min((parseInt(rawLimit) || 20), 100);

    const query = buildCursorQuery(baseQuery, cursor, sortBy, sortOrder, direction);

    const actualSortOrder = direction === "prev" ? -sortOrder : sortOrder;
    const sort = { [sortBy]: actualSortOrder, _id: actualSortOrder };

    let findQuery = Model.find(query);

    if (select) findQuery = findQuery.select(select);
    findQuery = findQuery.sort(sort);
    findQuery = findQuery.limit(limit + 1);

    if (populate) {
        if (Array.isArray(populate)) {
            populate.forEach(p => {
                findQuery = findQuery.populate(p);
            });
        } else {
            findQuery = findQuery.populate(populate);
        }
    }

    if (lean) findQuery = findQuery.lean();

    let data = await findQuery;

    const hasExtra = data.length > limit;

    if (direction === "prev") {
        data = data.reverse();
    }

    if (hasExtra) {
        if (direction === "prev") {
            data.shift();
        } else {
            data.pop();
        }
    }

    const nextCursor = data.length > 0 ? createCursor(data[data.length - 1], sortBy) : null;
    const prevCursor = data.length > 0 ? createCursor(data[0], sortBy) : null;

    let hasMore, hasPrev;

    if (direction === "next") {
        hasMore = hasExtra;
        hasPrev = false;
        if (prevCursor) {
            const prevCheckQuery = buildCursorQuery(baseQuery, prevCursor, sortBy, sortOrder, "prev");
            const exists = await Model.exists(prevCheckQuery);
            hasPrev = !!exists;
        }
    } else {
        hasPrev = hasExtra;
        hasMore = false;
        if (nextCursor) {
            const nextCheckQuery = buildCursorQuery(baseQuery, nextCursor, sortBy, sortOrder, "next");
            const exists = await Model.exists(nextCheckQuery);
            hasMore = !!exists;
        }
    }

    return { data, hasMore, hasPrev, nextCursor, prevCursor };
}

export function parseSort(query, allowedFields = [], defaultField = "createdAt") {
    const sortBy = query.sortBy || defaultField;
    const sortOrder = query.sortOrder === "asc" ? 1 : -1;
    const safeSortBy = allowedFields.length > 0 && !allowedFields.includes(sortBy) ? defaultField : sortBy;
    return { sortBy: safeSortBy, sortOrder };
};

export async function getApproximateCount(Model, query = {}, options = {}) {
    const { maxCount = 10000, timeout = 1000 } = options;

    if (options.cursor) {
        return null;
    }

    if (Object.keys(query).length === 0) {
        try {
            const count = await Model.estimatedDocumentCount();
            return count > maxCount ? `${maxCount}+` : count;
        } catch (error) {
            return null;
        }
    }

    try {
        const count = await Model.countDocuments(query).maxTimeMS(timeout);
        return count > maxCount ? `${maxCount}+` : count;
    } catch (error) {
        return null;
    }
};

function parseCursor(cursorString) {
    if (!cursorString) return null;

    try {
        const decoded = Buffer.from(cursorString, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);

        if (parsed.value && typeof parsed.value === "string") {
            const date = new Date(parsed.value);
            if (!isNaN(date.getTime())) {
                parsed.value = date;
            }
        }

        return parsed;
    } catch (e) {
        return null;
    }
};

function createCursor(doc, sortBy = "createdAt") {
    if (!doc) return null;

    const id = doc._id.toString();
    const sortValue = doc[sortBy];

    if (sortValue === undefined) {
        return Buffer.from(JSON.stringify({ value: null, _id: id })).toString("base64");
    }

    return Buffer.from(JSON.stringify({ value: sortValue instanceof Date ? sortValue.toISOString() : sortValue, _id: id })).toString("base64");
};

function buildCursorQuery(baseQuery, cursor, sortBy, sortOrder, direction = "next") {
    if (!cursor) return baseQuery;

    const parsedCursor = typeof cursor === "string" ? parseCursor(cursor) : cursor;
    if (!parsedCursor) return baseQuery;

    const query = { ...baseQuery };

    let valueOperator, idOperator;

    if (direction === "next") {
        valueOperator = sortOrder === 1 ? "$gt" : "$lt";
        idOperator = sortOrder === 1 ? "$gt" : "$lt";
    } else {
        valueOperator = sortOrder === 1 ? "$lt" : "$gt";
        idOperator = sortOrder === 1 ? "$lt" : "$gt";
    }

    if (parsedCursor.value !== null && parsedCursor.value !== undefined) {
        query.$or = [
            { [sortBy]: { [valueOperator]: parsedCursor.value } },
            {
                [sortBy]: parsedCursor.value,
                _id: { [idOperator]: parsedCursor._id }
            }
        ];
    } else {
        query._id = { [idOperator]: parsedCursor._id };
    }

    return query;
};