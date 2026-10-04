import { spawn } from "node:child_process";
import { once } from "node:events";
import { withTestRedis } from "./local-test-redis.mjs";
try {
  await withTestRedis(async (redisUrl) => {
    const child = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--experimental-strip-types",
        "scripts/test-database.mjs",
        "--notes",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          REDIS_URL: redisUrl,
          TRUSTED_CLIENT_IP_HEADER: "none",
        },
      },
    );
    const [code] = await once(child, "exit");
    process.exitCode = code ?? 1;
  });
} catch {
  console.error("Local notes fixtures unavailable; credentials omitted.");
  process.exitCode = 1;
}
