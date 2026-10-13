import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// Build before launching the fixture/browser, keeping memory use low on WSL.
const env = {
  ...process.env,
  CALENDAR_E2E: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "disposable-fixture-publishable-key",
  PLAYWRIGHT_BROWSERS_PATH: resolve(".playwright-browsers"),
  LD_LIBRARY_PATH: resolve(".playwright-libs/usr/lib/x86_64-linux-gnu"),
  ...(existsSync(".playwright-libs/fonts.conf") ? { FONTCONFIG_FILE: resolve(".playwright-libs/fonts.conf") } : {}),
};
for (const args of [["node_modules/next/dist/bin/next", "build"], ["node_modules/@playwright/test/cli.js", "test"]]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
