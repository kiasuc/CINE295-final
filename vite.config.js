import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: { port: 5180, strictPort: true, open: false },
  base: "/CINE295-final/",
  build: { outDir: "dist", emptyOutDir: true },
});
