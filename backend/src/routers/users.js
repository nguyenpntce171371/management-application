import express from "express";
import { deleteUser, updateUserRole, getUserStats, getDeletedUsers, restoreUser, permanentDeleteUser, getUsers } from "../controllers/user.controller.js";
import { verify } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verify("Admin"), getUsers);
router.get("/stats", verify("Admin"), getUserStats);
router.post("/role", verify("Admin"), updateUserRole);
router.get("/deleted", verify("Admin"), getDeletedUsers);
router.post("/restore/:id", verify("Admin"), restoreUser);
router.delete("/deleted/:id", verify("Admin"), permanentDeleteUser);
router.delete("/:id", verify("Admin"), deleteUser);

export default router;