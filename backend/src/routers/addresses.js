import express from "express";
import { verify } from "../middlewares/authMiddleware.js";
import { convertAddress } from "../controllers/address.controller.js";

const router = express.Router();

router.post("/convert", verify("Staff"), convertAddress);

export default router;