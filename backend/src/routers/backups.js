import express from "express";
import { getBackups, createBackup, restoreBackup, deleteBackupById, importBackupFile, getBackupConfig, updateBackupConfig, cleanupBackups, getBackupStats, getDeletedBackups, permanentDeleteBackupById, restoreDeletedBackup } from "../controllers/backup.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { uploadBackup } from "../middlewares/upload.js";

const router = express.Router();

router.get("/", verify("Admin"), getBackups);
router.post("/", verify("Admin"), createBackup);
router.post("/restore", verify("Admin"), restoreBackup);
router.post("/import", verify("Admin"), uploadBackup.single("file"), importBackupFile);
router.get("/config", verify("Admin"), getBackupConfig);
router.post("/config", verify("Admin"), updateBackupConfig);
router.post("/cleanup", verify("Admin"), cleanupBackups);
router.get("/stats", verify("Admin"), getBackupStats);
router.delete("/:id", verify("Admin"), deleteBackupById);
router.get("/deleted", verify("Admin"), getDeletedBackups);
router.post("/restore/:id", verify("Admin"), restoreDeletedBackup);
router.delete("/deleted/:id", verify("Admin"), permanentDeleteBackupById);

export default router;