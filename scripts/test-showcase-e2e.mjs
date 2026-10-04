import { spawn } from "node:child_process";
import { once } from "node:events";
import { withTestRedis } from "./local-test-redis.mjs";
import { withTestPostgres } from "./local-test-postgres.mjs";
try {
  await withTestRedis((redisUrl) =>
    withTestPostgres(async (databaseUrl) => {
      const child = spawn(
        process.execPath,
        ["node_modules/@playwright/test/cli.js", "test"],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            STARTUP_TEST_REDIS_URL: redisUrl,
            STARTUP_TEST_DATABASE_URL: databaseUrl,
            DATABASE_CA_CERT_PATH: "",
            TRUSTED_CLIENT_IP_HEADER: "none",
          },
        },
      );
      const [code] = await once(child, "exit");
      process.exitCode = code ?? 1;
    }),
  );
} catch {
  console.error(
    "Showcase browser fixtures unavailable; start Docker and retry.",
  );
  process.exitCode = 1;
}
