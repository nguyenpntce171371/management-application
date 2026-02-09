import { io } from "../index.js";
import Log from "../models/Log.js";

export const logEvent = async (data) => {
    try {
        await Log.create(data);
        io.to("Admin").emit("logCreated");
    } catch (err) {
        console.error("LogService error:", err.message);
    }
};