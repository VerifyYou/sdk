import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ include: ["src/index.ts", "src/vite-env.d.ts"] })], // public entry + env types, not cdn.ts
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (fmt) => `index.${fmt === "es" ? "mjs" : "cjs"}`,
    },
    sourcemap: true,
    target: "es2020",
  },
});
