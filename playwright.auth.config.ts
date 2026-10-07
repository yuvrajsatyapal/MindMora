import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["auth.spec.ts", "foundation.spec.ts", "contracts.spec.ts", "editor.spec.ts", "knowledge.spec.ts"],
  fullyParallel: false,
  workers: 1,
});
