import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      SUPABASE_SERVICE_ROLE_KEY: "mindmora-private-service-key-marker",
      DATABASE_URL: "postgresql://mindmora-private-database-marker",
    },
  },
  reporter: "list",
});
