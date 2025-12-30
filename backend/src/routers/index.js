import express from "express";
import authRouter from "./authen.js";
import passwordRouter from "./password.js"
import userRouter from "./user.js";
import adminRouter from "./admin.js";
import staffRouter from "./staff.js";
import realEstateRouter from "./realEstate.js";

const router = express.Router();
router.use("/auth", authRouter);
router.use("/password", passwordRouter);
router.use("/user", userRouter);
router.use("/admin", adminRouter);
router.use("/staff", staffRouter);
router.use("/real-estate", realEstateRouter);

export default router;