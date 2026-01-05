import { Server } from "socket.io";
import { setupAppraisalSocketHandlers } from "./staff.socket.js";
import { socketAuthMiddleware } from "./auth.middleware.js";
import { joinBaseRooms } from "./rooms.js";

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.DOMAIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware());

  io.engine.on("connection_error", (err) => {
    console.error("Socket connection error:", err.message);
  });

  io.on("connection", (socket) => {
    joinBaseRooms(socket);
    setupAppraisalSocketHandlers(io, socket);
    socket.on("disconnect", () => {});
    socket.on("error", () => { });
  });

  return io;
};