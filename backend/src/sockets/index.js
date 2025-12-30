import { Server } from "socket.io";
import { setupAppraisalSocketHandlers } from "./staff.socket.js";

export const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === "production" ? process.env.DOMAIN : "*",
            methods: ["GET", "POST"],
            credentials: process.env.NODE_ENV === "production"
        }
    });

    io.on("connection", (socket) => {
        setupAppraisalSocketHandlers(io, socket);
        socket.on("disconnect", () => { });
    });

    return io;
};