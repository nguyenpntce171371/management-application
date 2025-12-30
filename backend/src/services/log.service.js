import { io } from "../index.js";
import Log from "../models/Log.js";

export const logEvent = async (data) => {
    try {
        const created = await Log.create(data);
        io.emit("log:created", JSON.parse(JSON.stringify(created)));
    } catch (err) {
        console.error("LogService error:", err.message);
    }
};