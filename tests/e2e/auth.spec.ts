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
      await request.get("/api/auth/session", { headers: { Cookie: oldCookie } })
    ).status(),
  ).toBe(401);
});
