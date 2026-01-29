import express from "express";
import { verify } from "../middlewares/authMiddleware.js";
import { createAppraisal, deleteAppraisal, getAppraisalById, getAppraisals, updateAppraisalAssets, updateAppraisal, getDeletedAppraisals, restoreAppraisal, permanentDeleteAppraisal } from "../controllers/appraisal.controller.js";

const router = express.Router();

router.get("/", verify("Staff"), getAppraisals);
router.post("/", verify("Staff"), createAppraisal);
router.post("/assets/:id", verify("Staff"), updateAppraisalAssets);
router.get("/deleted", verify("Admin"), getDeletedAppraisals);
router.post("/restore/:id", verify("Admin"), restoreAppraisal);
router.delete("/deleted/:id", verify("Admin"), permanentDeleteAppraisal);
router.get("/:id", verify("Staff"), getAppraisalById);
router.post("/:id", verify("Staff"), updateAppraisal);
router.delete("/:id", verify("Staff"), deleteAppraisal);

export default router;