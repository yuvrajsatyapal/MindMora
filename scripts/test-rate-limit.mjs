import { spawn } from "node:child_process";
import { once } from "node:events";
import { withTestRedis } from "./local-test-redis.mjs";
try {
  await withTestRedis(async (url) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "vitest.rate-limit.config.ts",
      ],
      {
        stdio: "inherit",
        env: { ...process.env, RATE_LIMIT_TEST_URL: url },
      },
    );
    const [code] = await once(child, "exit");
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "Rate-limit integration unavailable: start Docker and retry npm run test:rate-limit.",
  );
  process.exitCode = 1;
}
