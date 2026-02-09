import express from "express";
import { getBackups, createBackup, restoreBackup, deleteBackup, getBackupConfig, updateBackupConfig, getBackupStats, getDeletedBackups, permanentDeleteBackup, restoreDeletedBackup } from "../controllers/backup.controller.js";
import { verify } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verify("Admin"), getBackups);
router.post("/", verify("Admin"), createBackup);
router.post("/restore", verify("Admin"), restoreBackup);
router.get("/config", verify("Admin"), getBackupConfig);
router.post("/config", verify("Admin"), updateBackupConfig);
router.get("/stats", verify("Admin"), getBackupStats);
router.delete("/:id", verify("Admin"), deleteBackup);
router.get("/deleted", verify("Admin"), getDeletedBackups);
router.post("/restore/:id", verify("Admin"), restoreDeletedBackup);
router.delete("/deleted/:id", verify("Admin"), permanentDeleteBackup);

export default router;