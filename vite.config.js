import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        review: resolve(import.meta.dirname, "review/index.html"),
        portal: resolve(import.meta.dirname, "portal/index.html"),
        portalEditor: resolve(import.meta.dirname, "portal/editor/index.html"),
        admin: resolve(import.meta.dirname, "admin/index.html"),
      },
    },
  },
});
