import Appraisal from "../models/Appraisal.js";

export const setupAppraisalSocketHandlers = (io, socket) => {

    socket.on("appraisal:update", async (data) => {
        try {
            const { id, field, value } = data;

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

            io.emit("appraisal:updated", JSON.parse(JSON.stringify(appraisal)));

        } catch (error) {
            console.error("Socket update error:", error);
            socket.emit("appraisal:error", { message: error.message });
        }
    });

    socket.on("appraisal:subscribe", (appraisalId) => {
        socket.join(`appraisal:${appraisalId}`);
    });

    socket.on("appraisal:unsubscribe", (appraisalId) => {
        socket.leave(`appraisal:${appraisalId}`);
    });
};
