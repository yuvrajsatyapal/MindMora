import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = "http://127.0.0.1:4173";
const preview = (page: Page) => page.getByRole("region", { name: "Markdown preview", exact: true });
const source = (page: Page) => page.getByRole("textbox", { name: "Markdown content" });
async function signIn(page: Page, context: BrowserContext, second = false) {
  await context.request.post(`${process.env.AUTH_TEST_PROVIDER_URL}/fixture/user?second=${second}`);
  await page.goto("/workspace/"); await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(`${origin}/`); await page.goto("/workspace/");
  await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
}
async function seed(context: BrowserContext, title: string, content = "") {
  const response = await context.request.post("/api/notes/", { headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() }, data: { title, content } });
  expect(response.status()).toBe(201); return await response.json() as { id: string; revision: number };
}
test.beforeEach(async ({ request }) => { expect((await request.post(`${process.env.AUTH_TEST_PROVIDER_URL}/fixture/reset`)).ok()).toBe(true); });
test("full corpus search, exact tag filters, safe wiki navigation and committed backlinks", async ({ page, context }) => {
  await signIn(page, context);
  const key = crypto.randomUUID(); const target = await seed(context, `Target ${key}`);
  const note = await seed(context, `Source ${key}`, `Context [[Target ${key}|Open target]] twice [[Target ${key}]] #Research${key.replaceAll("-", "")}`);
  for (let i = 0; i < 22; i++) await seed(context, `Later ${key} ${i}`);
  await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText("Open target");
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.getByRole("button", { name: "Open target", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("note")).toBe(target.id);
  await expect(page.getByText("Backlinks", { exact: true })).toBeVisible();
  await expect(page.getByText("1 incoming notes", { exact: true })).toBeVisible();
  await expect(page.getByText(/Context.*Open target/)).toBeVisible();
  await page.getByRole("textbox", { name: "Search all notes" }).fill(`Source ${key}`);
  await expect(page.getByRole("button", { name: `Source ${key}`, exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  const tag = page.getByRole("button", { name: new RegExp(`^#Research${key.replaceAll("-", "")}\\s`) });
  await tag.click(); await expect(tag).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: `Source ${key}`, exact: true }).first()).toBeVisible();
  for (const width of [320, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("wiki completion uses keyboard, explicit missing creation and duplicate titles stay ambiguous", async ({ page, context }) => {
  await signIn(page, context); const key = crypto.randomUUID(); const targetTitle = `Completion ${key}`; await seed(context, targetTitle);
  const note = await seed(context, `Writer ${key}`, `[[Missing ${key}]]`);
  await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText("Missing");
  await source(page).focus(); await page.keyboard.press("ControlOrMeta+End"); await page.keyboard.type(`\n[[Completion ${key.slice(0, 8)}`);
  await expect(page.getByRole("option", { name: new RegExp(`^${targetTitle}`) })).toBeVisible(); // CodeMirror intentionally ignores acceptance during its 75ms interaction delay.
  await page.waitForTimeout(100); await page.keyboard.press("Enter");
  await expect(source(page)).toContainText(`[[${targetTitle}]]`); await page.keyboard.press("ControlOrMeta+s"); await expect(page.getByText("Saved to server", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Split", exact: true }).click(); await page.getByRole("button", { name: `Missing ${key}`, exact: true }).click();
  const creation = page.getByRole("button", { name: `Create “Missing ${key}”`, exact: true }); await expect(creation).toBeVisible();
  page.once("dialog", dialog => dialog.accept()); await creation.click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Missing ${key}`);
  await seed(context, targetTitle); await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText(targetTitle);
  await page.getByRole("button", { name: "Split", exact: true }).click(); await preview(page).getByRole("button", { name: targetTitle, exact: true }).click();
  await expect(page.getByText("Ambiguous title", { exact: true })).toBeVisible(); expect(new URL(page.url()).searchParams.get("note")).toBe(note.id);
});
test("rename and delete re-resolve links without losing a dirty source draft", async ({ page, context }) => {
  await signIn(page, context); const key = crypto.randomUUID(); const title = `Guard ${key}`;
  const target = await seed(context, title); const note = await seed(context, `Guard source ${key}`, `[[${title}]]`);
  await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText(title); await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.route(`**/api/notes/${note.id}/`, route => route.request().method() === "PATCH" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "service_unavailable", message: "Fixture outage" } }) }) : route.continue());
  await source(page).fill(`Unsaved source [[${title}]]`); page.once("dialog", dialog => dialog.dismiss()); await preview(page).getByRole("button", { name: title, exact: true }).click();
  expect(new URL(page.url()).searchParams.get("note")).toBe(note.id); await expect(source(page)).toContainText("Unsaved source");
  expect((await context.request.patch(`/api/notes/${target.id}/`, { headers: { Origin: origin }, data: { title: `Renamed ${key}`, expectedRevision: 1 } })).status()).toBe(200);
  await preview(page).getByRole("button", { name: title, exact: true }).click(); await expect(page.getByRole("button", { name: `Create “${title}”` })).toBeVisible(); await expect(source(page)).toContainText("Unsaved source");
  expect((await context.request.delete(`/api/notes/${target.id}/`, { headers: { Origin: origin }, data: { expectedRevision: 2 } })).status()).toBe(200);
  const resolved = await context.request.post("/api/knowledge/wiki-targets/", { headers: { Origin: origin }, data: { kind: "resolve", targets: [`Renamed ${key}`] } }); expect((await resolved.json()).items[0].status).toBe("missing");
});
test("knowledge errors preserve drafts and account changes clear private results and browser persistence", async ({ page, context }) => {
  await signIn(page, context); const key = crypto.randomUUID(); const note = await seed(context, `Secret ${key}`, `Private ${key} #PrivateTag`);
  await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText(key);
  await page.route("**/api/search/", route => route.fulfill({ status: 429, headers: { "Retry-After": "1" }, contentType: "application/json", body: JSON.stringify({ error: { code: "rate_limited", message: "Try again later" } }) }));
  await page.getByRole("textbox", { name: "Search all notes" }).fill(key); await expect(page.getByText("Search unavailable", { exact: true })).toBeVisible(); await expect(source(page)).toContainText(key);
  await page.unroute("**/api/search/"); await page.getByRole("button", { name: "Clear search" }).click();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => /note|knowledge|search/i.test(key)))).toBe(false);
  expect((await context.request.post("/api/auth/logout/", { headers: { Origin: origin } })).ok()).toBe(true);
  await signIn(page, context, true); await page.getByRole("textbox", { name: "Search all notes" }).fill(key);
  await expect(page.getByRole("button", { name: `Secret ${key}`, exact: true })).toHaveCount(0);
  expect((await context.request.get(`/api/notes/${note.id}/backlinks/`)).status()).toBe(404);
});
test("uncertain missing-note creation retries one operation and declined navigation preserves the source draft", async ({ page, context }) => {
  await signIn(page, context); const key = crypto.randomUUID(); const missing = `Uncertain ${key}`;
  const note = await seed(context, `Uncertain writer ${key}`, `[[${missing}]]`);
  await page.goto(`/workspace/?note=${note.id}`); await expect(source(page)).toContainText(missing); await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.route(`**/api/notes/${note.id}/`, route => route.request().method() === "PATCH" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "service_unavailable", message: "Fixture outage" } }) }) : route.continue());
  await source(page).fill(`Retain draft [[${missing}]]`); await preview(page).getByRole("button", { name: missing, exact: true }).click();
  const keys: string[] = []; let createdId = "";
  await page.route("**/api/notes/", async route => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]); const result = await route.fetch(); createdId = (await result.json()).id;
    if (keys.length === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "service_unavailable", message: "Fixture response loss" } }) });
    else await route.fulfill({ response: result });
  });
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: `Create “${missing}”`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry create", exact: true }).first()).toBeVisible();
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Retry create", exact: true }).first().click();
  await expect.poll(() => keys.length).toBe(2); expect(keys[0]).toBe(keys[1]); expect(keys[0]).toBeTruthy();
  await expect(source(page)).toContainText("Retain draft"); expect(new URL(page.url()).searchParams.get("note")).toBe(note.id);
  const resolved = await context.request.post("/api/knowledge/wiki-targets/", { headers: { Origin: origin }, data: { kind: "resolve", targets: [missing] } });
  expect((await resolved.json()).items[0]).toMatchObject({ status: "resolved", note: { id: createdId } });
});
