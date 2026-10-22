import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
