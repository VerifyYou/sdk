import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

// Dev server for the demo "partner site". Serves demo/index.html on :3000 and
// imports the SDK from src/ (hot reload). Kept separate from the library build
// configs (vite.config.ts / vite.config.cdn.ts).
export default defineConfig({
  root: "demo",
  publicDir: false,
  // HTTPS via mkcert (source:"system" → the host's installed mkcert + CA, the
  // same one app-fe uses and that's trusted on the test devices). Needed so the
  // whole chain is a secure context — iOS Safari blocks the camera in an iframe
  // when the top-level page isn't https, and an https demo + https app-fe are
  // also schemefully same-site, so the session cookie survives.
  plugins: [mkcert({ source: "system" })],
  server: {
    host: true, // bind all interfaces so the demo is reachable at the LAN IP
    port: 3000,
    strictPort: true,
    // demo/main.ts imports "../src/index", which lives outside the demo root.
    fs: { allow: [".."] },
    // Proxy the connect-service call through this https origin so the browser
    // never makes an http fetch from an https page (mixed content). The SDK
    // points connectBase at the demo origin; vite forwards /v3 to connect.
    proxy: {
      "/v3": { target: "http://localhost:8090", changeOrigin: true },
    },
  },
});
