import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", ".agent-os/tests/**/*.test.ts"],
    testTimeout: 15000,
  },
});
