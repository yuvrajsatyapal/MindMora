import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const provider = process.env.AUTH_TEST_PROVIDER_URL;
  if (!provider) throw new Error("Run auth tests with npm run test:auth");
  expect((await request.post(`${provider}/fixture/reset`)).ok()).toBe(true);
});

test("rejects foreign logout and callbacks without browser-bound pending state", async ({
  request,
}) => {
  const callback = await request.get(
    "/api/auth/callback?code=invalid&state=invalid",
  );
  expect(callback.status()).toBe(400);
  expect(callback.headers()["cache-control"]).toBe("private, no-store");
  const logout = await request.post("/api/auth/logout", {
    headers: { Origin: "https://attacker.example" },
  });
  expect(logout.status()).toBe(403);
  expect((await request.get("/api/auth/session")).status()).toBe(401);
});

test("PKCE flow uses protected cookies, safe projection, server refresh and revoking logout", async ({
  page,
  context,
}) => {
  const request = context.request;
  await page.goto("/");
  // Test-only form exercises native POST navigation; no sign-in screen is added in 1B.
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/start";
    document.body.append(form);
    form.submit();
  });
  await page.waitForURL("http://127.0.0.1:4173/");
  await expect
    .poll(async () =>
      (await context.cookies()).some(
        (cookie) => cookie.name === "mindmora-session",
      ),
    )
    .toBe(true);
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "mindmora-session",
  )!;
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");
  expect(session.secure).toBe(false); // Explicit loopback-only local test exemption.
  expect(session.path).toBe("/");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "mindmora-session",
  );
  const stores = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(stores).toEqual({ local: [], session: [] });
  const response = await request.get("/api/auth/session");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.json()).toEqual({
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "learner@example.test",
      displayName: "MindMora Learner",
    },
  });
  const body = await response.text();
  for (const marker of [
    "access_token",
    "refresh_token",
    "google-private-marker",
    "provider-marker",
  ])
    expect(body).not.toContain(marker);

  // Actual 1E HTTP adapters against migrated PostgreSQL; no workspace UI is added.
  const origin = { Origin: "http://127.0.0.1:4173" };
  const key = crypto.randomUUID();
  const createInput = {
    title: "Browser note",
    content: "browser-private-note-marker",
  };
  const created = await request.post("/api/notes/", {
    headers: { ...origin, "Idempotency-Key": key },
    data: createInput,
  });
  expect(created.status()).toBe(201);
  expect(created.headers()["cache-control"]).toBe("private, no-store");
  const note = await created.json();
  expect(note.revision).toBe(1);
  const replay = await request.post("/api/notes/", {
    headers: { ...origin, "Idempotency-Key": key },
    data: createInput,
  });
  expect(replay.status()).toBe(200);
  expect((await replay.json()).id).toBe(note.id);
  const list = await request.get("/api/notes/?limit=2");
  expect(list.status()).toBe(200);
  expect(
    (await list.json()).items.find(
      (item: { id: string }) => item.id === note.id,
    ),
  ).not.toHaveProperty("content");
  const updated = await request.patch(`/api/notes/${note.id}/`, {
    headers: origin,
    data: { title: "Renamed", expectedRevision: 1 },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).revision).toBe(2);
  const stale = await request.patch(`/api/notes/${note.id}/`, {
    headers: origin,
    data: { title: "Stale", expectedRevision: 1 },
  });
  expect(stale.status()).toBe(409);
  const denied = await request.delete(`/api/notes/${note.id}/`, {
    headers: { Origin: "https://attacker.example" },
    data: { expectedRevision: 2 },
  });
  expect(denied.status()).toBe(403);
  const removed = await request.delete(`/api/notes/${note.id}/`, {
    headers: origin,
    data: { expectedRevision: 2 },
  });
  expect(removed.status()).toBe(200);
  expect((await request.get(`/api/notes/${note.id}/`)).status()).toBe(404);

  // Age only the expiry hint, preserving credentials; backend must refresh/verify online.
  const aged: Record<string, unknown> = JSON.parse(
    Buffer.from(session.value, "base64url").toString(),
  );
  aged.expiresAt = 1;
  await context.addCookies([
    {
      ...session,
      value: Buffer.from(JSON.stringify(aged)).toString("base64url"),
    },
  ]);
  const refreshed = await request.get("/api/auth/session");
  expect(refreshed.status()).toBe(200);
  const rotated = (await context.cookies()).find(
    (cookie) => cookie.name === "mindmora-session",
  )!;
  expect(rotated.value).not.toBe(session.value);
  expect(rotated.httpOnly).toBe(true);
  const notesRefreshed = await request.get("/api/notes/");
  expect(notesRefreshed.status()).toBe(200);
  const oldCookie = `mindmora-session=${rotated.value}`;
  const logout = await request.post("/api/auth/logout", {
    headers: { Origin: "http://127.0.0.1:4173" },
  });
  expect(logout.status()).toBe(204);
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "mindmora-session",
    ),
  ).toBe(false);
  expect(
    (
      await request.get("/api/notes/", { headers: { Cookie: oldCookie } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get("/api/auth/session", { headers: { Cookie: oldCookie } })
    ).status(),
  ).toBe(401);
});

test("public auth throttles repeated starts and ignores forged forwarded addresses", async ({
  request,
}) => {
  let throttled = false;
  for (let i = 0; i < 11; i++) {
    const response = await request.post("/api/auth/start/", {
      maxRedirects: 0,
      headers: {
        Origin: "http://127.0.0.1:4173",
        "X-Forwarded-For": `192.0.2.${i}`,
        "X-Real-IP": `192.0.2.${i}`,
      },
    });
    if (response.status() === 429) {
      expect(Number(response.headers()["retry-after"])).toBeGreaterThan(0);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
      const error = await response.json();
      expect(error.error.code).toBe("rate_limited");
      expect(error.error.correlationId).toBe(
        response.headers()["x-request-id"],
      );
      throttled = true;
      break;
    }
    expect(response.status()).toBe(303);
  }
  expect(throttled).toBe(true);
});
