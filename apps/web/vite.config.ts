import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Keep font assets same-origin instead of generating CSP-blocked data URLs.
  build: { assetsInlineLimit: 0 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
    reporters: ["default", "junit"],
    outputFile: { junit: "../../test-results/web.xml" },
  },
});
