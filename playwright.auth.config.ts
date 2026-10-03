import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "auth.spec.ts",
  fullyParallel: false,
  workers: 1,
});
