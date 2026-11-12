import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: "../../test-results/artifacts",
  reporter: [
    ["list"],
    ["junit", { outputFile: "../../test-results/e2e.xml" }],
    ["html", { outputFolder: "../../playwright-report", open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.BLACKSMITH_WEB_URL ?? "http://127.0.0.1:18102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
