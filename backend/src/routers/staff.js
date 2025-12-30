import express from "express";
import { convertAddress, createAppraisal, deleteAppraisal, getAppraisalById, getAppraisals, updateAppraisalAssets, updateAppraisalInfo } from "../controllers/staff.controller.js";
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";
const router = express.Router();

router.post("/convert-address", verify("Staff"), convertAddress);
router.get("/appraisals", verify("Staff"), getAppraisals);
router.post("/appraisals", verify("Staff"), createAppraisal);
router.get("/appraisals/:id", verify("Staff"), getAppraisalById);
router.post("/appraisals/:id", verify("Staff"), updateAppraisalInfo);
router.post("/appraisals/assets/:id", verify("Staff"), updateAppraisalAssets);
router.delete("/appraisals/:id", verify("Staff"), deleteAppraisal);

export default router;