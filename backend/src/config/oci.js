import fs from "fs";
import common from "oci-common";
import objectstorage from "oci-objectstorage";

const provider = new common.SimpleAuthenticationDetailsProvider(
  process.env.OCI_TENANCY_OCID,
  process.env.OCI_USER_OCID,
  process.env.OCI_FINGERPRINT,
  fs.readFileSync(Buffer.from(process.env.OCI_PRIVATE_KEY, "base64").toString("utf-8"), "utf8"),
  null,
  common.Region.fromRegionId(process.env.OCI_REGION)
);
console.log(Buffer.from(process.env.OCI_PRIVATE_KEY, "base64").toString("utf-8"));
export const ociClient = new objectstorage.ObjectStorageClient({
  authenticationDetailsProvider: provider,
});

export const OCI_CONFIG = {
  NAMESPACE: process.env.OCI_NAMESPACE,
  BUCKET: process.env.OCI_BUCKET_NAME,
  REGION: process.env.OCI_REGION,
  MAX_FILE_SIZE: 3 * 1024 * 1024,
  ALLOWED_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
};
