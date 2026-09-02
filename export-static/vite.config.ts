import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const exportDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: exportDir,
  base: "./",
  publicDir: path.resolve(exportDir, "../public"),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(exportDir, ".."),
    },
  },
  build: {
    outDir: path.resolve(exportDir, "dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

