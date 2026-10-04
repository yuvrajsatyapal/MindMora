import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/startup-probes.test.ts"],
    fileParallelism: false,
    testTimeout: 12000,
  },
});
