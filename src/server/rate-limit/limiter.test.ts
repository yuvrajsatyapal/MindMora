// @vitest-environment node
import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createLimiter, publicIdentity } from "./limiter";
import { getRateLimitConfig } from "../config";
import { verifyDatabaseSession } from "../db/user-context";
import { authProviderFixture } from "../../tests/auth-provider-fixture";
import { handleAuth } from "../auth/routes";
it("ignores spoofed forwarding by default and normalizes explicitly trusted IPv6", () => {
  const req = new Request("https://app.example", {
    headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "::1" },
  });
  expect(publicIdentity(req)).toBe("shared");
  expect(publicIdentity(req, "x-real-ip")).toBe("[::1]");
  expect(
    publicIdentity(
      new Request("https://app.example", {
        headers: { "x-real-ip": "1.1.1.1, 2.2.2.2" },
      }),
      "x-real-ip",
    ),
  ).toBe("shared");
});
it("fails closed on outage and returns precise throttle guidance without private key material", async () => {
  const unavailable = createLimiter(async () => {
    throw new Error("private-redis-marker");
  });
  await expect(unavailable.auth("start", "shared")).rejects.toMatchObject({
    status: 503,
    code: "admission_unavailable",
  });
  const denied = createLimiter(async (key) => {
    expect(key).not.toContain("private-ip-marker");
    return { count: 11, ttlMs: 1234 };
  });
  await expect(denied.auth("start", "private-ip-marker")).rejects.toMatchObject(
    { status: 429, retryAfter: 1.234 },
  );
});
it("requires issued verified owners before basic or expensive admission", async () => {
  const admission = createLimiter(async () => {
    throw new Error("outage");
  });
  expect(() =>
    admission.basic({ userId: "11111111-1111-4111-8111-111111111111" }),
  ).toThrow();
  expect(() =>
    admission.expensive({ userId: "11111111-1111-4111-8111-111111111111" }),
  ).toThrow();
});
it("allows only ten basic operations per owner during an outage and resets at expiry", async () => {
  const config = {
    appOrigin: "https://mindmora.example",
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_fixture",
  };
  const fixture = authProviderFixture();
  const deps = {
    config,
    fetcher: fixture.fetcher,
    admission: async () => {},
    logger: () => {},
  };
  const start = await handleAuth(
    "start",
    new Request(config.appOrigin + "/api/auth/start", {
      method: "POST",
      headers: { Origin: config.appOrigin },
    }),
    deps,
  );
  const pending = start.headers.getSetCookie()[0].split(";")[0];
  const callback = await handleAuth(
    "callback",
    new Request(fixture.authorize(start.headers.get("location")!), {
      headers: { Cookie: pending },
    }),
    deps,
  );
  const cookie = callback.headers
    .getSetCookie()
    .find((value) => value.includes("session="))!
    .split(";")[0];
  const { owner } = await verifyDatabaseSession(
    new Request(config.appOrigin, { headers: { Cookie: cookie } }),
    { config, fetcher: fixture.fetcher },
  );
  let time = 0;
  const admission = createLimiter(
    async () => {
      throw new Error("outage");
    },
    () => time,
  );
  for (let i = 0; i < 10; i++)
    expect(await admission.basic(owner)).toEqual({ degraded: true });
  await expect(admission.basic(owner)).rejects.toMatchObject({
    status: 429,
    retryAfter: 60,
  });
  await expect(admission.expensive(owner)).rejects.toMatchObject({
    status: 503,
  });
  time = 60_000;
  expect(await admission.basic(owner)).toEqual({ degraded: true });
});
it("requires remote TLS, rejects private URL query data and safely validates configuration", () => {
  for (const url of [
    "redis://remote.example:6379",
    "https://private-marker",
    "rediss://host/?private-marker",
  ]) {
    expect(() => getRateLimitConfig({ REDIS_URL: url })).toThrow(
      "Invalid server configuration: request admission.",
    );
  }
  expect(
    getRateLimitConfig({ REDIS_URL: "redis://127.0.0.1:6379" })
      .trustedClientIpHeader,
  ).toBe("none");
  expect(
    getRateLimitConfig({
      REDIS_URL: "rediss://user:password@example.test:6379",
    }).redisUrl,
  ).toContain("rediss:");
});
