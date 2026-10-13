import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3002", viewport: { width: 390, height: 844 }, trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: { env: { ...process.env, ...(existsSync(".playwright-libs/fonts.conf") ? { FONTCONFIG_FILE: resolve(".playwright-libs/fonts.conf") } : {}) } },
  },
  webServer: [
    { command: "npx tsx tests/e2e/fixture-server.mts", url: "http://127.0.0.1:54329/health", timeout: 60000, reuseExistingServer: false },
    { command: "npm run start -- --hostname 0.0.0.0 --port 3002", url: "http://localhost:3002/login", timeout: 60000, reuseExistingServer: false, env: { CALENDAR_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "disposable-fixture-publishable-key" } },
  ],
});
