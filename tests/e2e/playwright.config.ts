import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 45_000,
  expect: { timeout: 12_000 },
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
    baseURL: process.env.BLACKSMITH_WEB_URL ?? "http://127.0.0.1:18102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /fallback\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Proves the page still works where WebGL is blocked or unsupported.
      name: "no-webgl",
      testMatch: /fallback\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--disable-3d-apis"] },
      },
    },
  ],
});
