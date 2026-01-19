import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        allowedHosts: [`dev.${process.env.DOMAIN}`],
        hmr: {
            clientPort: 443,
            protocol: "wss"
        },
        watch: {
            usePolling: true,
            interval: 1000
        }
    },
    preview: {
        host: "0.0.0.0",
        port: 5173,
        allowedHosts: [`dev.${process.env.DOMAIN}`]
    }
});
