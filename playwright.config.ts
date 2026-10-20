import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// Use the system Chromium when present (cloud build boxes), otherwise Playwright's own.
const systemChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM ?? (fs.existsSync(systemChromium) ? systemChromium : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: executablePath ? { executablePath } : {},
    timezoneId: "America/Los_Angeles",
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100/api/meta",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { GAMEDAY_FIXTURES: "1" },
  },
});
