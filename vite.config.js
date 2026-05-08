import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: { port: 5180, strictPort: true, open: false },
  build: { outDir: "dist", emptyOutDir: true },
});
