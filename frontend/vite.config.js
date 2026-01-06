import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        hmr: {
            clientPort: 80,
            protocol: 'ws'
        },
        watch: {
            usePolling: true,
            interval: 1000
        }
    },
    preview: {
        host: "0.0.0.0",
        port: 5173
    }
});