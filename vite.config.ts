import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Only this app's tests; percy-report-main/ is a separate reference project with its own suite.
    include: ["src/**/*.test.ts"],
  },
  server: {
    // Dev-only pass-through so the browser can call Percy without CORS issues.
    // No auth logic lives here: Percy / BrowserStack validate the credentials.
    proxy: {
      "/percy-api": {
        target: "https://percy.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/percy-api/, "/api/v1"),
      },
    },
  },
});
