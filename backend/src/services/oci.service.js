import os from "oci-objectstorage";
import common from "oci-common";
import sharp from "sharp";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const {
    OCI_TENANCY_OCID,
    OCI_USER_OCID,
    OCI_FINGERPRINT,
    OCI_PRIVATE_KEY,
    OCI_REGION,
    OCI_NAMESPACE,
    OCI_BUCKET_NAME
} = process.env;

const provider = new common.SimpleAuthenticationDetailsProvider(
    OCI_TENANCY_OCID,
    OCI_USER_OCID,
    OCI_FINGERPRINT,
    Buffer.from(OCI_PRIVATE_KEY, "base64").toString("utf-8"),
    null,
    common.Region.fromRegionId(OCI_REGION)
);

const ociClient = new os.ObjectStorageClient({
    authenticationDetailsProvider: provider
});

export const OCI_CONFIG = {
    NAMESPACE: OCI_NAMESPACE,
    BUCKET: OCI_BUCKET_NAME,
    REGION: OCI_REGION
};

export { ociClient };

export const uploadImageToOCI = async (buffer, folder = "real-estate") => {
    const SOFT_TARGET_SIZE = 35 * 1024;
    const MAX_ITERATIONS = 10;

    let quality = 88;
    let optimized;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        optimized = await sharp(buffer)
            .resize(640, 640, {
                fit: "inside",
                withoutEnlargement: true
            })
            .webp({
                quality,
                effort: 4,
                smartSubsample: true
            })
            .toBuffer();

        if (optimized.length <= SOFT_TARGET_SIZE) break;

        quality -= 2;
        if (quality < 60) break;
    }

    if (!optimized || optimized.length > 50 * 1024) {
        optimized = await sharp(buffer)
            .resize(600, 600, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 65, effort: 4 })
            .toBuffer();
    }

    const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.webp`;

    await ociClient.putObject({
        namespaceName: OCI_NAMESPACE,
        bucketName: OCI_BUCKET_NAME,
        objectName: fileName,
        putObjectBody: optimized,
        contentType: "image/webp",
        contentLength: optimized.length
    });

    return fileName;
};

export const uploadMultipleImagesToOCI = async (files, folder) => {
    const objectNames = [];
    for (const file of files) {
        const name = await uploadImageToOCI(file.buffer, folder);
        objectNames.push(name);
        file.buffer = null;
    }
    return objectNames;
};

export const deleteImageFromOCI = async (objectName) => {
    if (objectName.startsWith("http://") || objectName.startsWith("https://")) {
        return;
    }

    try {
        await ociClient.deleteObject({
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            objectName,
        });
    } catch (error) {
        console.error("OCI delete error:", error);
    }
};

export const deleteMultipleImagesFromOCI = async (objectNames = []) => {
    for (const name of objectNames) {
        await deleteImageFromOCI(name);
    }
};

export const createImageFingerprint = async (buffer) => {
    const resized = await sharp(buffer)
        .resize(8, 8, { fit: "fill", kernel: sharp.kernel.nearest })
        .grayscale()
        .raw()
        .toBuffer();

    return crypto.createHash("sha256").update(resized).digest("hex");
};

export const generateReadPAR = async (objectName, ttlMinutes = 60) => {
    const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const par = await ociClient.createPreauthenticatedRequest({
        namespaceName: OCI_NAMESPACE,
        bucketName: OCI_BUCKET_NAME,
        createPreauthenticatedRequestDetails: {
            name: `read-${objectName}`,
            accessType: "ObjectRead",
            objectName,
            timeExpires: expires,
        },
    });

    return `https://objectstorage.${OCI_REGION}.oraclecloud.com${par.preauthenticatedRequest.accessUri}`;
};

export const uploadFileToOCI = async (localFilePath, objectName, contentType = "application/gzip") => {
    try {
        const stats = fs.statSync(localFilePath);
        const fileStream = fs.createReadStream(localFilePath);

        const putObjectRequest = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            objectName: objectName,
            putObjectBody: fileStream,
            contentLength: stats.size,
            contentType: contentType
        };

        await ociClient.putObject(putObjectRequest);

        return {
            success: true,
            objectName,
            size: stats.size,
            bucket: OCI_BUCKET_NAME,
            namespace: OCI_NAMESPACE
        };
    } catch (error) {
        console.error("OCI upload error:", error);
        throw new Error(`Failed to upload to OCI: ${error.message}`);
    }
};

export const downloadFileFromOCI = async (objectName, localFilePath) => {
    try {
        const response = await ociClient.getObject({
            namespaceName: OCI_CONFIG.NAMESPACE,
            bucketName: OCI_CONFIG.BUCKET,
            objectName: objectName
        });

        const dir = path.dirname(localFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const readableStream = response.value;

        await new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(localFilePath);

            writeStream.on("error", reject);
            writeStream.on("finish", resolve);

            if (readableStream instanceof ReadableStream) {
                const reader = readableStream.getReader();
                const pump = async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                writeStream.end();
                                break;
                            }
                            if (!writeStream.write(value)) {
                                await new Promise(resolve => writeStream.once("drain", resolve));
                            }
                        }
                    } catch (err) {
                        writeStream.destroy(err);
                    }
                };
                pump();
            } else if (readableStream && typeof readableStream.pipe === "function") {
                readableStream.pipe(writeStream);
            } else if (Buffer.isBuffer(readableStream) || readableStream instanceof Uint8Array) {
                writeStream.write(readableStream);
                writeStream.end();
            } else if (readableStream && readableStream.readable) {
                readableStream.readable.pipe(writeStream);
            } else {
                try {
                    const buffer = Buffer.from(readableStream);
                    writeStream.write(buffer);
                    writeStream.end();
                } catch (bufferError) {
                    reject(new Error(`Unsupported stream type: ${typeof readableStream}`));
                }
            }
        });

        const stats = fs.statSync(localFilePath);

        return {
            success: true,
            objectName,
            localPath: localFilePath,
            size: stats.size
        };
    } catch (error) {
        console.error("OCI download error:", error);
        throw new Error(`Failed to download from OCI: ${error.message}`);
    }
};

export const deleteFileFromOCI = async (objectName) => {
    try {
        const deleteObjectRequest = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            objectName: objectName
        };

        await ociClient.deleteObject(deleteObjectRequest);

        return {
            success: true,
            objectName
        };
    } catch (error) {
        console.error("OCI delete error:", error);
    }
};

export const generatePresignedUrl = async (objectName, expirySeconds = 3600) => {
    try {
        const preauthRequest = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            createPreauthenticatedRequestDetails: {
                name: `temp-access-${Date.now()}`,
                accessType: os.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
                timeExpires: new Date(Date.now() + expirySeconds * 1000),
                objectName: objectName
            }
        };

        const response = await ociClient.createPreauthenticatedRequest(preauthRequest);

        const baseUrl = `https://objectstorage.${OCI_REGION}.oraclecloud.com`;
        const fullUrl = `${baseUrl}${response.preauthenticatedRequest.accessUri}`;

        return fullUrl;
    } catch (error) {
        console.error("Presigned URL generation error:", error);
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
};

export const listObjects = async (prefix = "") => {
    try {
        const request = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            prefix: prefix
        };

        const response = await ociClient.listObjects(request);

        return response.listObjects.objects || [];
    } catch (error) {
        console.error("OCI list error:", error);
        throw new Error(`Failed to list objects: ${error.message}`);
    }
};

export const objectExists = async (objectName) => {
    try {
        const request = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            objectName: objectName
        };

        await ociClient.headObject(request);
        return true;
    } catch (error) {
        if (error.statusCode === 404) {
            return false;
        }
        throw error;
    }
};

export const getObjectMetadata = async (objectName) => {
    try {
        const request = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            objectName: objectName
        };

        const response = await ociClient.headObject(request);

        return {
            size: parseInt(response.contentLength),
            contentType: response.contentType,
            lastModified: response.lastModified,
            etag: response.etag
        };
    } catch (error) {
        console.error("Get metadata error:", error);
        throw new Error(`Failed to get object metadata: ${error.message}`);
    }
};

export const copyObject = async (sourceObjectName, destinationObjectName) => {
    try {
        const request = {
            namespaceName: OCI_NAMESPACE,
            bucketName: OCI_BUCKET_NAME,
            copyObjectDetails: {
                sourceObjectName: sourceObjectName,
                destinationRegion: OCI_REGION,
                destinationNamespace: OCI_NAMESPACE,
                destinationBucket: OCI_BUCKET_NAME,
                destinationObjectName: destinationObjectName
            }
        };

        await ociClient.copyObject(request);

        return {
            success: true,
            source: sourceObjectName,
            destination: destinationObjectName
        };
    } catch (error) {
        console.error("Copy object error:", error);
        throw new Error(`Failed to copy object: ${error.message}`);
    }
};