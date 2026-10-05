import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/dev/design-system/");
});
for (const theme of ["light", "dark"]) {
  test(`${theme}: accessible semantics and contrast`, async ({ page }) => {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(
      page.getByRole("button", { name: "New note", exact: true }),
    ).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(230, 230, 230)" : "rgb(8, 127, 115)",
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
test("dialog traps focus, escapes, and restores its trigger", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Open dialog",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Example filename")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Example filename")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("tabs, menus, controlled tasks and toast work from keyboard", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Properties", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Backlinks", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Note actions" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Dismiss notification" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  const task = page.getByRole("checkbox", {
    name: "Read the local-first software paper",
  });
  await task.focus();
  await page.keyboard.press("Space");
  await expect(task).toBeChecked();
});
for (const width of [375, 768, 1440])
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
test("system theme follows OS, explicit override wins, reduced motion is respected", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(24, 24, 24)",
  );
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(246, 248, 245)",
  );
  await expect(
    page.getByRole("button", { name: "New note", exact: true }),
  ).toHaveCSS("transition-duration", "0s");
  await page.reload();
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("system");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(24, 24, 24)",
  );
});
test("loads without external requests or runtime errors and survives narrow reflow", async ({
  page,
}) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      remote.push(request.url());
  });
  await page.reload();
  await page.getByRole("switch", { name: "Show note properties" }).click();
  await expect(page.getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
