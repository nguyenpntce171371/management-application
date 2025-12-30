import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import router from "./routers/index.js";
import cookieParser from "cookie-parser";
import { loggingMiddleware } from "./middlewares/logging.js";
import http from "http";
import hpp from "hpp";
import compression from "compression";
import { initializeSocket } from "./sockets/index.js";
import { prototypePollutionMiddleware } from "./middlewares/prototypePollution.js";
import { sanitizeInputMiddleware } from "./middlewares/sanitizeInput.js";

const { MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, MONGO_DB_NAME, PORT = 3000, NODE_ENV = "development", TRUSTED_PROXY_RANGE } = process.env;
const app = express();
app.set("trust proxy", NODE_ENV === "production" ? TRUSTED_PROXY_RANGE.split(",").map(ip => ip.trim()) : true);
const server = http.createServer(app);
const io = initializeSocket(server);
app.set("io", io);
export { io };

app.use(express.json());
app.use(cookieParser());
app.use(prototypePollutionMiddleware);
app.use(sanitizeInputMiddleware);
app.use(hpp({ whitelist: ["page", "limit", "sort", "fields"] }));
app.use(compression());
app.use(loggingMiddleware);
app.use("/api", router);

mongoose
    .connect(`mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@mongo-${NODE_ENV}:27017/${MONGO_DB_NAME}?authSource=admin`)
    .then(async () => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err.message));

server.listen(PORT, "0.0.0.0", () => console.log(`Backend running on ${PORT}`));