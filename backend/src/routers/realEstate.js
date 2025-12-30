import express from "express";
import { verify } from "../middlewares/authMiddleware.js";
import { rateLimitRedis } from "../middlewares/rateLimitRedis.js";
import { createRealEstate, deleteRealEstateById, getNearbyRealEstate, getRealEstateById, getRealEstateData } from "../controllers/user.controller.js";
import { upload } from "../middlewares/upload.js";
import { getRealEstateStats, modifyRealEstateById } from "../controllers/staff.controller.js";

const router = express.Router();

router.get("/", verify("User"), getRealEstateData);
router.post("/", verify("User"), upload.array("images", 10), createRealEstate);
router.get("/stats", verify("Staff"), getRealEstateStats);
router.get("/nearby", verify("Staff"), getNearbyRealEstate);
router.get("/:id", verify("User"), getRealEstateById);
router.delete("/:id", verify("User"), deleteRealEstateById);
router.post("/:id", verify("User"), modifyRealEstateById);


export default router;