// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { handleNotes } from "./routes";
const config = {
  appOrigin: "http://localhost:3000",
  supabaseUrl: "https://fixture.supabase.co",
  publishableKey: "sb_publishable_fixture",
};
it("requires a verified session and returns a private correlation-tagged error", async () => {
  const result = await handleNotes(
    new Request("http://localhost:3000/api/notes"),
    undefined,
    { config },
  );
  expect(result.status).toBe(401);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(result.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
  expect(await result.text()).not.toContain("fixture");
});
it("rejects foreign mutations before provider or database work", async () => {
  const fetcher = vi.fn();
  const result = await handleNotes(
    new Request("http://localhost:3000/api/notes", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
    }),
    undefined,
    { config, fetcher },
  );
  expect(result.status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("makes unsupported methods private and explicit", async () => {
  const result = await handleNotes(
    new Request("http://localhost:3000/api/notes", { method: "PUT" }),
    undefined,
    { config },
  );
  expect(result.status).toBe(405);
  expect(result.headers.get("Allow")).toBe("GET, POST");
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
});

import { createAuthProvider } from "../auth/provider";
import { authProviderFixture } from "../../tests/auth-provider-fixture";
import { createNoteRepository } from "./repository";
import { DatabaseFailure } from "../db/client";
import { HttpFailure } from "../http/errors";
async function authenticatedRequest(
  method = "GET",
  body?: string,
  headers: Record<string, string> = {},
  expired = false,
) {
  const fixture = authProviderFixture();
  const provider = createAuthProvider(config, fixture.fetcher);
  try {
    const start = await provider.start(`${config.appOrigin}/api/auth/callback`);
    const callback = new URL(fixture.authorize(start.url));
    const tokens = await provider.exchange(
      callback.searchParams.get("code")!,
      start.flowId,
    );
    const cookie = `mindmora-session=${Buffer.from(JSON.stringify({ ...tokens, ...(expired ? { expiresAt: 1 } : {}) })).toString("base64url")}`;
    return {
      fixture,
      request: new Request(`${config.appOrigin}/api/notes`, {
        method,
        headers: {
          cookie,
          Origin: config.appOrigin,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body } : {}),
      }),
    };
  } finally {
    await provider.dispose();
  }
}
it("refreshes the protected cookie even when validated input is rejected", async () => {
  const f = await authenticatedRequest(
    "POST",
    JSON.stringify({
      title: "forged",
      content: "",
      userId: "private-owner-marker",
    }),
    { "Idempotency-Key": "11111111-1111-4111-8111-111111111111" },
    true,
  );
  const r = await handleNotes(f.request, undefined, {
    config,
    fetcher: f.fixture.fetcher,
    admission: async () => ({ degraded: false }),
    logger: () => {},
  });
  expect(r.status).toBe(400);
  expect(r.headers.getSetCookie().join(";")).toContain("HttpOnly");
  expect(r.headers.getSetCookie().join(";")).toContain("mindmora-session");
  expect(await r.text()).not.toContain("private-owner-marker");
});
it("does not authorize a revoked session during degraded admission", async () => {
  const f = await authenticatedRequest();
  f.fixture.revoke();
  const admission = vi.fn();
  const r = await handleNotes(f.request, undefined, {
    config,
    fetcher: f.fixture.fetcher,
    admission,
    logger: () => {},
  });
  expect(r.status).toBe(401);
  expect(admission).not.toHaveBeenCalled();
});
it("returns 429/Retry-After before SQL on exhausted admission", async () => {
  const f = await authenticatedRequest();
  const r = await handleNotes(f.request, undefined, {
    config,
    fetcher: f.fixture.fetcher,
    admission: async () => {
      throw new HttpFailure("rate_limited", 12);
    },
    logger: () => {},
  });
  expect(r.status).toBe(429);
  expect(r.headers.get("Retry-After")).toBe("12");
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
});
it("bounds actual JSON input and keeps persistence errors private", async () => {
  const f = await authenticatedRequest("POST", "{bad-json", {
    "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
  });
  expect(
    (
      await handleNotes(f.request, undefined, {
        config,
        fetcher: f.fixture.fetcher,
        admission: async () => ({ degraded: false }),
        logger: () => {},
      })
    ).status,
  ).toBe(400);
  const g = await authenticatedRequest();
  const repository = createNoteRepository({
    run: async () => {
      throw new DatabaseFailure();
    },
    close: async () => {},
  });
  const r = await handleNotes(g.request, undefined, {
    config,
    fetcher: g.fixture.fetcher,
    repository,
    admission: async () => ({ degraded: false }),
    logger: () => {},
  });
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("Database");
});
