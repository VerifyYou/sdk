import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/cdn.ts",
      name: "VerifyYou",
      formats: ["iife"],
      fileName: () => "verifyyou.iife.js",
    },
    rollupOptions: {
      output: { exports: "default" },
    },
    minify: true, // Vite 8/Rolldown uses the built-in Oxc minifier; "esbuild" would need the optional esbuild dep
    sourcemap: true,
    target: "es2018",
  },
});
