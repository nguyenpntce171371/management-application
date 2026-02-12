import NodeCache from "node-cache";
import { generatePresignedUrl, isTokenExpired } from "../services/storage.service.js";

const imageUrlCache = new NodeCache({
    stdTTL: 1800,
    checkperiod: 600,
    useClones: false,
    maxKeys: 10000
});

export async function getCachedImageUrl(imagePath) {
    if (!(imagePath && !imagePath.startsWith("http"))) return imagePath;

    const cachedUrl = imageUrlCache.get(imagePath);

    if (cachedUrl) {
        const tokenMatch = cachedUrl.match(/\/api\/files\/temp\/([^\/]+)$/);

        if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];

            if (!isTokenExpired(token)) {
                return cachedUrl;
            }

            imageUrlCache.del(imagePath);
        }
    }

    try {
        const url = await generatePresignedUrl(imagePath, 3600);
        imageUrlCache.set(imagePath, url);
        return url;
    } catch (error) {
        console.error(`Failed to generate URL for ${imagePath}:`, error);
        return null;
    }
};