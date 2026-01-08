import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        allowedHosts: [
            "phamnguyentuannguyen.duckdns.org"
        ],
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
        allowedHosts: [
            "phamnguyentuannguyen.duckdns.org"
        ]
    }
});
