import sharp from "sharp";
import crypto from "crypto";
import { ociClient, OCI_CONFIG } from "../config/oci.js";

export const uploadImageToOCI = async (buffer, folder = "real-estate") => {
    const metadata = await sharp(buffer).metadata();

    let pipeline = sharp(buffer);
    if (metadata.width > 1200 || metadata.height > 800) {
        pipeline = pipeline.resize(1200, 800, { fit: "inside" });
    }

    const optimized = await pipeline
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

    const fileName = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.jpg`;

    await ociClient.putObject({
        namespaceName: OCI_CONFIG.NAMESPACE,
        bucketName: OCI_CONFIG.BUCKET,
        objectName: fileName,
        putObjectBody: optimized,
        contentType: "image/jpeg",
    });

    return fileName;
};

export const generateReadPAR = async (objectName, ttlMinutes = 60) => {
    const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const par = await ociClient.createPreauthenticatedRequest({
        namespaceName: OCI_CONFIG.NAMESPACE,
        bucketName: OCI_CONFIG.BUCKET,
        createPreauthenticatedRequestDetails: {
            name: `read-${objectName}`,
            accessType: "ObjectRead",
            objectName,
            timeExpires: expires,
        },
    });

    return `https://objectstorage.${OCI_CONFIG.REGION}.oraclecloud.com${par.preauthenticatedRequest.accessUri}`;
};

export const deleteImageFromOCI = async (objectName) => {
    await ociClient.deleteObject({
        namespaceName: OCI_CONFIG.NAMESPACE,
        bucketName: OCI_CONFIG.BUCKET,
        objectName,
    });
};

export const createImageFingerprint = async (buffer) => {
    const resized = await sharp(buffer)
        .resize(8, 8, { fit: "fill", kernel: sharp.kernel.nearest })
        .grayscale()
        .raw()
        .toBuffer();

    return crypto.createHash("sha256").update(resized).digest("hex");
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

export const deleteMultipleImagesFromOCI = async (objectNames = []) => {
    for (const name of objectNames) {
        await deleteImageFromOCI(name);
    }
};