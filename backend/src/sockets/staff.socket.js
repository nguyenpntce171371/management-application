import Appraisal from "../models/Appraisal.js";
import { redis } from "../middlewares/rateLimitRedis.js";

export const setupAppraisalSocketHandlers = (io, socket) => {
    socket.on("appraisal:update", async (data) => {
        try {
            if (!["Admin", "Staff"].includes(socket.user.role)) {
                return socket.emit("FORBIDDEN");
            }

            const { id, field, value } = data;
            if (!id || !field) return;

            const deviceId = socket.deviceId;
            const redisKey = `socket:update:${socket.user.userId}:${deviceId}:${id}:${field}`;

            const allowed = await redis.set(redisKey, 1, "PX", 300, "NX");

            if (!allowed) {
                return;
            }

            const allowedFields = [
                "customerName",
                "propertyType",
                "status",
                "appraiser",
                "createdDate",
                "completedDate",
                "notes"
            ];

            if (!allowedFields.includes(field)) {
                return socket.emit("appraisal:error", {
                    message: "Field không được phép cập nhật"
                });
            }

            let parsedValue = value;
            if (field === "createdDate" || field === "completedDate") {
                parsedValue = value ? new Date(value) : null;
            }

            const updateData = {
                [field]: parsedValue,
                updatedAt: new Date()
            };

            const appraisal = await Appraisal.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!appraisal) {
                return socket.emit("appraisal:error", {
                    message: "Không tìm thấy hồ sơ"
                });
            }

            io.to("Staff").emit("appraisalUpdated", JSON.parse(JSON.stringify(appraisal)));
        } catch (error) {
            console.error("Socket update error:", error);
            socket.emit("appraisal:error", { message: error.message });
        }
    });
};
