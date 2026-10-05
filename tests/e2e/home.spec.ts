import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`homepage ${theme}: keyboard, readable theme and responsive composition`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/A place for\s*your thinking\./);
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "dark" ? "rgb(24, 24, 24)" : "rgb(246, 248, 245)");
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByLabel("Theme", { exact: true }).selectOption(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
      await expect(page.locator(".mm-home-intro")).toHaveCSS("animation-name", "none");
      await page.screenshot({ path: `/tmp/mindmora-home-${theme}-${width}.png`, fullPage: true });
    }
    const cta = page.getByRole("link", { name: "Open your workspace" });
    await cta.focus();
    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/workspace/");
  });
}
