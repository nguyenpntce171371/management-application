import express from "express";
import { verify } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";
import { createRealEstate, deleteRealEstateById, getDeletedRealEstates, getNearbyRealEstate, getRealEstate, getRealEstateById, getRealEstateStats, modifyRealEstateById, permanentDeleteRealEstate, restoreRealEstate } from "../controllers/realEstate.controller.js";

const router = express.Router();

router.get("/", verify("User"), getRealEstate);
router.post("/", verify("User"), upload.array("images", 10), createRealEstate);
router.get("/stats", verify("Staff"), getRealEstateStats);
router.get("/nearby", verify("Staff"), getNearbyRealEstate);
router.get("/deleted", verify("Admin"), getDeletedRealEstates);
router.post("/restore/:id", verify("Admin"), restoreRealEstate);
router.delete("/deleted/:id", verify("Admin"), permanentDeleteRealEstate);
router.get("/:id", verify("User"), getRealEstateById);
router.post("/:id", verify("User"), modifyRealEstateById);
router.delete("/:id", verify("User"), deleteRealEstateById);

export default router;