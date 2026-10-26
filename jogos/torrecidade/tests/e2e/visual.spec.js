import { test, expect } from "@playwright/test";
import { root } from "./helpers.js";
for (const [name, viewport] of [
  ["celular", { width: 390, height: 844 }],
  ["tv", { width: 1920, height: 1080 }],
])
  for (const theme of ["neutro", "natal"])
    for (const quality of ["baixo", "alto"])
      test(`visual ${name} ${theme} ${quality}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(root + "index.html?seed=1");
        await page.evaluate(
          ({ theme, quality }) => {
            document.documentElement.dataset.tema = theme;
            tc.scene.setTheme(theme);
            tc.scene.quality.set(quality, true);
            tc.scene.fit();
          },
          { theme, quality },
        );
        await page.waitForTimeout(1500);
        await expect(page).toHaveScreenshot(`${name}-${theme}-${quality}.png`, {
          maxDiffPixelRatio: 0.015,
          animations: "disabled",
        });
        if (theme === "neutro" && quality === "alto")
          await page.screenshot({
            path: `docs/inicio-${name}.png`,
            fullPage: true,
          });
      });
