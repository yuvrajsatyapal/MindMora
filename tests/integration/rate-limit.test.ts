import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { createServer } from "node:net";
vi.mock("server-only", () => ({}));
import { createRedisCounter } from "../../src/server/rate-limit/client";
import { createLimiter } from "../../src/server/rate-limit/limiter";
import { handleAuth } from "../../src/server/auth/routes";
import { authProviderFixture } from "../../src/tests/auth-provider-fixture";
const url = process.env.RATE_LIMIT_TEST_URL;
if (!url)
  throw new Error(
    "Use npm run test:rate-limit with a disposable local Redis-compatible server.",
  );
const config = { redisUrl: url, trustedClientIpHeader: "none" as const };
const store = createRedisCounter(config);
const control = createClient({ url });
control.on("error", () => {});
const prefix = `mindmora:integration:${randomUUID()}`;
beforeAll(async () => {
  await control.connect();
});
afterAll(() => {
  store.close();
  control.destroy();
});
it("atomically admits concurrent counts and expires counters without storing private markers", async () => {
  const key = prefix + ":counter";
  const results = await Promise.all(
    Array.from({ length: 20 }, () => store.counter(key, 250)),
  );
  expect(results.map((result) => result.count).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  expect(await control.pTTL(key)).toBeGreaterThan(0);
  expect(await control.get(key)).toBe("20");
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(await control.exists(key)).toBe(0);
  expect((await store.counter(key, 250)).count).toBe(1);
});
it("repairs a counter with missing TTL", async () => {
  const key = prefix + ":repair";
  await control.set(key, "1");
  expect(await store.counter(key, 250)).toMatchObject({ count: 2 });
  expect(await control.pTTL(key)).toBeGreaterThan(0);
});
it("enforces independent identity budgets and real HTTP 429/Retry-After", async () => {
  const admission = createLimiter(store.counter);
  const fixture = authProviderFixture();
  const authConfig = {
    appOrigin: "https://mindmora.example",
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_fixture",
  };
  const identity = randomUUID();
  for (let i = 0; i < 11; i++) {
    const response = await handleAuth(
      "start",
      new Request(authConfig.appOrigin + "/api/auth/start", {
        method: "POST",
        headers: { Origin: authConfig.appOrigin },
      }),
      {
        config: authConfig,
        fetcher: fixture.fetcher,
        logger: () => {},
        admission: () => admission.auth("start", identity),
      },
    );
    expect(response.status).toBe(i < 10 ? 303 : 429);
    if (i === 10)
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  }
  await expect(admission.auth("start", randomUUID())).resolves.toEqual({
    degraded: false,
  });
});
it("bounds stalled TCP Redis work and fails closed", async () => {
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Invalid test socket");
  const stalled = createRedisCounter({
    ...config,
    redisUrl: `redis://127.0.0.1:${address.port}`,
  });
  try {
    const started = performance.now();
    await expect(
      createLimiter(stalled.counter).auth("start", "shared"),
    ).rejects.toMatchObject({ status: 503 });
    expect(performance.now() - started).toBeLessThan(2500);
  } finally {
    stalled.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("recovers a real connection after command timeout and circuit cooldown", async () => {
  const recovery = createRedisCounter(config);
  try {
    await recovery.counter(prefix + ":recover", 60_000);
    await control.sendCommand(["CLIENT", "PAUSE", "1800", "ALL"]);
    await expect(recovery.counter(prefix + ":recover", 60_000)).rejects.toThrow(
      "Admission unavailable.",
    );
    await expect(recovery.counter(prefix + ":recover", 60_000)).rejects.toThrow(
      "Admission unavailable.",
    );
    await new Promise((resolve) => setTimeout(resolve, 5100));
    expect(
      (await recovery.counter(prefix + ":recover", 60_000)).count,
    ).toBeGreaterThan(1);
  } finally {
    recovery.close();
  }
});
