import { defineConfig } from "vite";

// Base is set to "./" so the built site works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: "./",
  build: {
    target: "es2021",
    outDir: "dist",
  },
});
