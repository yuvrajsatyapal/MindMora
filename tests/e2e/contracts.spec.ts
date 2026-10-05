import { expect, test } from "@playwright/test";
import { runCollectionSmoke } from "../../scripts/test-api-collection.mjs";

test.beforeEach(async ({ request }) => {
  expect(
    (
      await request.post(`${process.env.AUTH_TEST_PROVIDER_URL}/fixture/reset`)
    ).ok(),
  ).toBe(true);
});

test("generated Postman records execute unauthenticated guards and authenticated CRUD", async ({
  page,
  context,
}) => {
  const adapter = async (url: string, options: RequestInit) => {
    const response = await context.request.fetch(url, {
      method: options.method,
      headers: options.headers as Record<string, string>,
      data: options.body as string | undefined,
      maxRedirects: 0,
    });
    return {
      status: response.status(),
      headers: { get: (name: string) => response.headers()[name.toLowerCase()] ?? null },
      json: () => response.json(),
    };
  };
  const unauthenticated = await runCollectionSmoke(
    "http://127.0.0.1:4173",
    adapter,
    false,
  );
  expect(unauthenticated.length).toBeGreaterThanOrEqual(6);
  await page.goto("/workspace/");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL("http://127.0.0.1:4173/");
  const authenticated = await runCollectionSmoke(
    "http://127.0.0.1:4173",
    adapter,
    true,
  );
  expect(
    authenticated.map((item: { status: number }) => item.status),
  ).toContain(201);
});

test("opt-in Swagger works on React19 with same-origin cookie requests and no external validator", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4173/"))
      external.push(request.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dev/api-docs/");
  await expect(
    page.getByRole("heading", { name: /^MindMora auth and notes API/ }),
  ).toBeVisible();
  const operation = page.locator("#operations-default-authSession");
  await operation.getByRole("button", { name: /GET/ }).click();
  await operation.getByRole("button", { name: "Try it out" }).click();
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/session") &&
      response.request().method() === "GET" && response.status() !== 308,
  );
  await operation.getByRole("button", { name: "Execute", exact: true }).click();
  expect((await response).status()).toBe(401);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("Swagger executes an authenticated cookie-and-Origin note create", async ({page,context}) => {
  await page.goto("/workspace/");
  await page.getByRole("button",{name:"Continue with Google"}).click();
  await page.waitForURL("http://127.0.0.1:4173/");
  await page.goto("/dev/api-docs/");
  const operation = page.locator("#operations-default-createNote");
  await operation.getByRole("button",{name:/POST \/api\/notes/}).click();
  await operation.getByRole("button",{name:"Try it out"}).click();
  await operation.getByPlaceholder("Origin",{exact:true}).fill("http://127.0.0.1:4173");
  await operation.getByPlaceholder("Idempotency-Key",{exact:true}).fill(crypto.randomUUID());
  const title = `Swagger disposable ${crypto.randomUUID()}`;
  await operation.locator("textarea").fill(JSON.stringify({title,content:"Disposable console text"}));
  const response = page.waitForResponse(response => response.url().includes("/api/notes/") && response.request().method()==="POST");
  await operation.getByRole("button",{name:"Execute",exact:true}).click();
  const created = await response;
  expect(created.status()).toBe(201);
  const note = await created.json();
  expect(note.title).toBe(title);
  expect((await context.request.get(`/api/notes/${note.id}/`)).status()).toBe(200);
  expect((await context.request.delete(`/api/notes/${note.id}/`,{headers:{Origin:"http://127.0.0.1:4173"},data:{expectedRevision:note.revision}})).status()).toBe(200);
});
