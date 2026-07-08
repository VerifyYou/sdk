import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom gives us window/document/atob/MessageEvent so the redirect-param,
    // token, and iframe-embed code can run without a real browser.
    environment: "jsdom",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
