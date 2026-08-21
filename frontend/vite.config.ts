/// <reference types="vitest" />
// `defineConfig` comes from vitest/config, not vite: Vite's own config type has
// no `test` property, so importing it from "vite" turns this file into a
// TypeScript error that only surfaces later at `npm run build`.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // The backend runs separately on 8000; proxying keeps the frontend's
      // fetch calls same-origin so no CORS preflight is involved in dev.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
