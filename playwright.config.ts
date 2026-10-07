import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["auth.spec.ts", "foundation.spec.ts", "contracts.spec.ts", "editor.spec.ts", "knowledge.spec.ts"],
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      SUPABASE_SERVICE_ROLE_KEY: "mindmora-private-service-key-marker",
      DATABASE_URL:
        process.env.STARTUP_TEST_DATABASE_URL ??
        "postgresql://mindmora-private-database-marker",
      REDIS_URL:
        process.env.STARTUP_TEST_REDIS_URL ??
        "rediss://mindmora-private-redis-marker",
      DATABASE_CA_CERT_PATH: "",
      TRUSTED_CLIENT_IP_HEADER: "none",
    },
  },
  reporter: "list",
});
