import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts", "src/cdn.ts"] })], // every module index.d.ts re-exports from; tests + cdn entry stay out
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
