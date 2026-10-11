import { defineConfig } from "vitest/config";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
