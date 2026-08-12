import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { SERVICE_PORT, VITE_PORT } from "../scripts/service-ports.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appVersion = readFileSync(resolve(__dirname, "../VERSION"), "utf8").trim();

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  clearScreen: false,
  server: {
    port: VITE_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://localhost:${SERVICE_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-router-dom")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/leaflet") ||
            id.includes("node_modules/react-leaflet")
          ) {
            return "vendor-leaflet";
          }
        },
      },
    },
  },
});
