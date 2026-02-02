import express from "express";
import { getTemp } from "../controllers/files.controller.js";

const router = express.Router();

router.get("/temp/:token", getTemp);

export default router;