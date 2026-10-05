import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = "http://127.0.0.1:4173";
const provider = () => process.env.AUTH_TEST_PROVIDER_URL!;
const headers = { Origin: origin };

async function signIn(page: Page, context: BrowserContext, second = false) {
  await context.request.post(`${provider()}/fixture/user?second=${second}`);
  await page.goto("/workspace/");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(`${origin}/`);
  await page.goto("/workspace/");
  await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
}
async function create(
  context: BrowserContext,
  title: string,
  content = "browser note",
) {
  const response = await context.request.post("/api/notes/", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: { title, content },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; revision: number };
}

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${provider()}/fixture/reset`)).ok()).toBe(true);
});

test("workspace exposes sign-in instead of private content", async ({
  page,
}) => {
  await page.goto("/workspace/");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Markdown content")).toHaveCount(0);
});

test("explicit saves commit, reload across contexts, rename and soft-delete", async ({
  page,
  context,
  browser,
}) => {
  await signIn(page, context);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Workspace private marker");
  await page.getByLabel("Markdown content").fill("Committed private marker");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "Committed private marker",
  );
  await expect(
    page.getByText("Saved to server", { exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("note");
  expect(id).toBeTruthy();
  await page.reload();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Workspace private marker",
  );
  const device = await browser.newContext();
  await device.addCookies(await context.cookies());
  const other = await device.newPage();
  await other.goto(`/workspace/?note=${id}`);
  await expect(other.getByLabel("Markdown content")).toHaveValue(
    "Committed private marker",
  );
  await page
    .getByLabel("Title", { exact: true })
    .fill("Renamed workspace marker");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Saved to server", { exact: true }),
  ).toBeVisible();
  expect(
    (await (await context.request.get(`/api/notes/${id}/`)).json()).title,
  ).toBe("Renamed workspace marker");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete note", exact: true }).click();
  await expect
    .poll(async () => (await context.request.get(`/api/notes/${id}/`)).status())
    .toBe(404);
  await device.close();
});

test("concurrent tabs preserve draft and require explicit conflict resolution", async ({
  page,
  context,
}) => {
  await signIn(page, context);
  const note = await create(
    context,
    `Conflict ${crypto.randomUUID()}`,
    "Original",
  );
  await page.goto(`/workspace/?note=${note.id}`);
  await expect(page.getByLabel("Markdown content")).toHaveValue("Original");
  await page.getByLabel("Markdown content").fill("My unsaved draft");
  const updated = await context.request.patch(`/api/notes/${note.id}/`, {
    headers,
    data: {
      title: "T".repeat(200),
      content: "Other tab" + "C".repeat(2000),
      expectedRevision: 1,
    },
  });
  expect(updated.status()).toBe(200);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keep draft with latest revision" }),
  ).toBeVisible();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "My unsaved draft",
  );
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (await (await context.request.get(`/api/notes/${note.id}/`)).json())
      .content,
  ).toBe("Other tab" + "C".repeat(2000));
  await page
    .getByRole("button", { name: "Keep draft with latest revision" })
    .click();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Saved to server", { exact: true }),
  ).toBeVisible();
  expect(
    (await (await context.request.get(`/api/notes/${note.id}/`)).json())
      .content,
  ).toBe("My unsaved draft");
});

test("offline save retains same-tab draft, response loss reconciles create", async ({
  page,
  context,
}) => {
  await signIn(page, context);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const title = `Uncertain ${crypto.randomUUID()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Markdown content").fill("Unsaved private text");
  let committed = false;
  await page.route("**/api/notes/", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const result = await route.fetch();
    expect(result.status()).toBe(201);
    committed = true;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same create" }),
  ).toBeVisible();
  expect(committed).toBe(true);
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "Unsaved private text",
  );
  await page.unroute("**/api/notes/");
  await page.getByRole("button", { name: "Retry same create" }).click();
  await expect(
    page.getByText("Saved to server", { exact: true }),
  ).toBeVisible();
  const notes = await (
    await context.request.get("/api/notes/?limit=100")
  ).json();
  expect(
    notes.items.filter((n: { title: string }) => n.title === title),
  ).toHaveLength(1);
  await page.getByLabel("Markdown content").fill("Offline retained draft");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "Offline retained draft",
  );
  await expect(page.getByText("Saved to server", { exact: true })).toHaveCount(
    0,
  );
  await context.setOffline(false);
});

test("foreign note, logout/account switch and late private response stay isolated", async ({
  page,
  context,
  browser,
}) => {
  await signIn(page, context);
  const note = await create(
    context,
    `Owner one ${crypto.randomUUID()}`,
    "owner-one-private-marker",
  );
  await page.goto(`/workspace/?note=${note.id}`);
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "owner-one-private-marker",
  );
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await signIn(second, secondContext, true);
  expect(
    (await secondContext.request.get(`/api/notes/${note.id}/`)).status(),
  ).toBe(404);
  await second.goto(`/workspace/?note=${note.id}`);
  await expect(
    second.getByText("owner-one-private-marker", { exact: true }),
  ).toHaveCount(0);
  await expect(second.getByLabel("Markdown content")).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived!: () => void;
  const pending = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route(`**/api/notes/${note.id}/`, async (route) => {
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.getByRole("button", { name: "Refresh notes" }).click();
  await pending;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.getByLabel("Markdown content")).toHaveCount(0);
  const stores = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    dbs: (await indexedDB.databases()).map((db) => db.name),
    caches: await caches.keys(),
  }));
  expect(stores).toEqual({ local: [], session: [], dbs: [], caches: [] });
  await page.unroute(`**/api/notes/${note.id}/`);
  await context.addCookies(await secondContext.cookies());
  await page.goto(`/workspace/?note=${note.id}`);
  await expect(page.getByRole("heading", { name: "Your notes" })).toBeVisible();
  await expect(page.getByLabel("Markdown content")).toHaveCount(0);
  await secondContext.close();
});

test("workspace keyboard, mobile and accessibility", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, context);
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Markdown content")).toBeFocused();
  await page.getByLabel("Title", { exact: true }).fill("W".repeat(200));
  await page.getByLabel("Markdown content").fill("L".repeat(3000));
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("Theme", { exact: true }).selectOption(theme);
      await expect(page.getByLabel("Markdown content")).toHaveValue("L".repeat(3000));
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `/tmp/mindmora-workspace-${theme}-${width}.png`, fullPage: true });
    }
  }
});

test("clean refresh adopts newer commits and deletion keeps only an unsaved draft", async ({
  page,
  context,
}) => {
  await signIn(page, context);
  const note = await create(
    context,
    `Refresh ${crypto.randomUUID()}`,
    "Initial server text",
  );
  await page.goto(`/workspace/?note=${note.id}`);
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "Initial server text",
  );
  expect(
    (
      await context.request.patch(`/api/notes/${note.id}/`, {
        headers,
        data: { content: "New server text", expectedRevision: 1 },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Refresh notes" }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "New server text",
  );
  await page.getByLabel("Markdown content").fill("Retained deleted note draft");
  expect(
    (
      await context.request.delete(`/api/notes/${note.id}/`, {
        headers,
        data: { expectedRevision: 2 },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Refresh notes" }).click();
  await expect(page.getByLabel("Markdown content")).toHaveValue(
    "Retained deleted note draft",
  );
  await expect(
    page.getByRole("button", { name: "Save note", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Saved to server", { exact: true })).toHaveCount(
    0,
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel("Markdown content")).toHaveCount(0);
});
