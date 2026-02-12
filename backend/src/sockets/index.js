import { Server } from "socket.io";
import { socketAuthMiddleware } from "./auth.middlewares.js";
import { joinBaseRooms } from "./rooms.utils.js";
import { setupAppraisalSocketHandlers } from "./appraisal.controllers.js";

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.DOMAIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware());

  io.engine.on("connection_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  io.on("connection", (socket) => {
    joinBaseRooms(socket);
    setupAppraisalSocketHandlers(io, socket);
    socket.on("disconnect", () => { });
    socket.on("error", () => { });
  });

  return io;
};