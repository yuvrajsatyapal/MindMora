import { expect, test } from "@playwright/test";

test("Next serves a rendered 404 for a missing runtime page", async ({ request }) => {
  const response = await request.get("/missing-runtime-page/");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.text()).toContain("This page could not be found");
});

test("public pages and loaded browser scripts exclude server credential markers", async ({ page, request }) => {
  const markers = [
    "mindmora-private-service-key-marker",
    "mindmora-private-database-marker",
  ];
  for (const pathname of ["/", "/dev/design-system/", "/workspace/"]) {
    const response = await page.goto(pathname);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const html = await response!.text();
    const dom = await page.content();
    for (const marker of markers) {
      expect(html).not.toContain(marker);
      expect(dom).not.toContain(marker);
    }
    const scripts = await page.locator("script[src]").evaluateAll((elements) =>
      elements.map((element) => (element as HTMLScriptElement).src),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const source of scripts) {
      const asset = await request.get(source);
      expect(asset.ok()).toBe(true);
      const body = await asset.text();
      for (const marker of markers) expect(body).not.toContain(marker);
    }
  }
});

// Production API reference is an explicit operator opt-in, checked independently
// of the auth harness that enables it for Swagger acceptance.
test("production API docs are disabled by default", async ({ request }) => {
  expect((await request.get("/dev/api-docs/")).status()).toBe(404);
});
