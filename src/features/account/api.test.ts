import { afterEach, expect, it, vi } from "vitest";
import { readSession, logout } from "./api";
afterEach(() => vi.unstubAllGlobals());

it("validates a minimal server session without accepting embedded tokens", async () => {
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    if (init.credentials !== "same-origin" || init.cache !== "no-store")
      throw new Error("Unsafe auth fetch");
    return Response.json({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "learner@example.test",
        displayName: "Learner",
      },
    });
  });
  expect(await readSession()).toEqual({
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "learner@example.test",
      displayName: "Learner",
    },
  });
  vi.stubGlobal("fetch", async () =>
    Response.json({ user: { id: "forged", access_token: "private-marker" } }),
  );
  await expect(readSession()).rejects.toThrow("Authentication request failed.");
});

it("returns signed-out on 401 and hides provider/network failure details", async () => {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
  expect(await readSession()).toBeNull();
  vi.stubGlobal("fetch", async () =>
    Response.json({ error: "private-marker" }, { status: 503 }),
  );
  await expect(readSession()).rejects.toThrow("Authentication request failed.");
  vi.stubGlobal("fetch", async () => {
    throw new Error("private-marker");
  });
  await expect(readSession()).rejects.toThrow("Authentication request failed.");
});

it("uses a cookie-authenticated POST logout and reports unsuccessful revocation", async () => {
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    if (
      init.method !== "POST" ||
      init.credentials !== "same-origin" ||
      init.cache !== "no-store"
    )
      throw new Error("Unsafe logout");
    return new Response(null, { status: 204 });
  });
  await expect(logout()).resolves.toBeUndefined();
  vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  await expect(logout()).rejects.toThrow("Authentication request failed.");
});
