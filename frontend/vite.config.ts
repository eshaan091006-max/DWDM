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
      //
      // Target 127.0.0.1, never "localhost". On Windows, "localhost" resolves
      // to ::1 first, waits for the IPv6 connection to fail, then falls back to
      // IPv4 — measured at ~206ms of dead connect time per request against
      // ~0.5ms for the explicit IPv4 address. Auto-run fires on every parameter
      // change, so that delay is the difference between the UI feeling live and
      // feeling broken.
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
