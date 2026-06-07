import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [dts({ include: ["src"], exclude: ["src/**/*.test.ts"] })],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      // UMD global for raw-JS / <script> consumers: window.Vy
      name: "Vy",
      formats: ["es", "umd"],
      fileName: (format) => (format === "es" ? "index.js" : "index.umd.cjs"),
    },
  },
  test: {
    environment: "jsdom",
  },
});
