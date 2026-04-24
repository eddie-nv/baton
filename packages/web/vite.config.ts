import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward both the MCP dispatcher and the admin/listing routes to
      // the backend so the dev experience needs no CORS config.
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: {
    // Build straight into the backend's public/ directory so Hono's
    // serveStatic picks up the SPA in production with one deploy step.
    outDir: path.resolve(__dirname, "../backend/public"),
    emptyOutDir: true,
  },
});
