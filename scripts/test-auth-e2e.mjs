import assert from "node:assert/strict";
import { withTestRedis } from "./local-test-redis.mjs";
import { withTestPostgres } from "./local-test-postgres.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { authProviderFixture } from "../src/tests/auth-provider-fixture.ts";

let fixture = authProviderFixture();
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/fixture/reset" && req.method === "POST") {
      fixture = authProviderFixture();
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/auth/v1/authorize") {
      res.writeHead(302, { Location: fixture.authorize(url.toString()) });
      res.end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32_768) throw new Error("Fixture body limit exceeded");
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    const response = await fixture.fetcher(url, {
      method: req.method,
      headers: req.headers,
      ...(body ? { body } : {}),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch {
    res.writeHead(500);
    res.end("Fixture failure");
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const providerUrl = `http://127.0.0.1:${address.port}`;
try {
  await withTestRedis((redisUrl) =>
    withTestPostgres(async (databaseUrl) => {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
          ),
          "test",
          "--config=playwright.auth.config.ts",
        ],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            REDIS_URL: redisUrl,
            STARTUP_TEST_REDIS_URL: redisUrl,
            STARTUP_TEST_DATABASE_URL: databaseUrl,
            DATABASE_CA_CERT_PATH: "",
            TRUSTED_CLIENT_IP_HEADER: "none",
            APP_ORIGIN: "http://127.0.0.1:4173",
            SUPABASE_URL: providerUrl,
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
            AUTH_TEST_PROVIDER_URL: providerUrl,
          },
        },
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () => child.kill(signal));
      const [code] = await once(child, "exit");
      process.exitCode = code ?? 1;
    }),
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
