import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BROWSER_SMOKE_BASE_URL || process.env.EVENTFILM_WEB_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
