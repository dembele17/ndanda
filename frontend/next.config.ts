import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep disposable browser-test builds separate from the normal development server.
  distDir: process.env.CALENDAR_E2E === "1" ? ".next-e2e" : ".next",
  ...(process.env.CALENDAR_E2E === "1" ? { experimental: { cpus: 2 } } : {}),
};

export default nextConfig;
