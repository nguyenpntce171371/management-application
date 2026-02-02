import express from "express";
import authRouter from "./auth.js";
import passwordRouter from "./password.js"
import userRouter from "./user.js";
import usersRouter from "./users.js";
import sessionsRouter from "./sessions.js";
import realEstateRouter from "./real-estates.js";
import appraisalRouter from "./appraisals.js";
import backupRouter from "./backups.js";
import logRouter from "./logs.js";
import addressesRouter from "./addresses.js";
import filesRouter from "./files.js";

const router = express.Router();
router.use("/auth", authRouter);
router.use("/password", passwordRouter);
router.use("/user", userRouter)
router.use("/users", usersRouter);
router.use("/sessions", sessionsRouter);
router.use("/real-estates", realEstateRouter);
router.use("/appraisals", appraisalRouter);
router.use("/backups", backupRouter);
router.use("/logs", logRouter);
router.use("/addresses", addressesRouter);
router.use("/files", filesRouter);

export default router;