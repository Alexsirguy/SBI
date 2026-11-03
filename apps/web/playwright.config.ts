import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Specs start with the privacy notes folded away, so they never cover what a test clicks.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${port}`,
          localStorage: [{ name: "sbi.privacy-corner", value: "collapsed" }],
        },
      ],
    },
  },
  // Its own spec checks the privacy tab; baselines stay about the page beneath it.
  expect: { toHaveScreenshot: { stylePath: "./e2e/screenshot.css" } },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A synthetic camera lets the live photo flow run headless, with permission already given.
        permissions: ["camera"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
