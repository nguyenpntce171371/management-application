import { io } from "socket.io-client";

const socket = io(window.location.origin, {
  path: "/socket.io/",
  transports: ["websocket"],
  autoConnect: true,

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 10000,
});

export default socket;