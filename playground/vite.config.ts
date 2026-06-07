import { resolve } from "node:path";
import { defineConfig } from "vite";

// Serve the playground and resolve the package name to the SDK source, so the
// demo imports exactly what a real consumer would: `@verifyyou-sdk/client`.
export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@verifyyou-sdk/client": resolve(__dirname, "../src/index.ts"),
    },
  },
  server: { port: 5180, open: true },
});
