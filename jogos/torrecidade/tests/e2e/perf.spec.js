import { test, expect } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { room, player, send } from "./helpers.js";
for (const rate of [4, 6])
  for (const who of ["host", "cliente"])
    test(`orçamento ${who} CPU ${rate}x`, async ({ browser }) => {
      const r = await room(),
        a = await player(browser, r, "Ana");
      const b = who === "cliente" ? await player(browser, r, "Bia") : null;
      // Remote phones have separate GPUs. Keep the helper host's physics/network
      // running, but use its supported 2D controls so it does not compete with
      // the measured client's software GPU on this one CI machine.
      if (b) await a.page.locator("#toggle-3d").click();
      const measured = b || a;
      await measured.page.setViewportSize({ width: 360, height: 640 });
      const cdp = await measured.context.newCDPSession(measured.page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      await measured.page.evaluate(() => {
        tc.scene.quality.set("baixo", true);
        tc.scene.fit();
        tc.scene.quality.samples = [];
      });
      await send(a.page, "iniciar");
      for (let i = 0; i < 4; i++) await send(a.page, "soltar");
      const before = await measured.page.evaluate(() => tc.session.b.bytes);
      await measured.page.waitForTimeout(8000);
      const metrics = await measured.page.evaluate(
        (before) => ({
          samples: tc.scene.quality.samples,
          bytesPerSecond: (tc.session.b.bytes - before) / 8,
          host: tc.session.isHost,
          renderer: tc.scene.renderer
            .getContext()
            .getParameter(tc.scene.renderer.getContext().RENDERER),
        }),
        before,
      );
      const summary = {
        rate,
        who,
        ...metrics,
        fps:
          metrics.samples.reduce((s, x) => s + x.fps, 0) /
          metrics.samples.length,
        p95: Math.max(...metrics.samples.map((x) => x.p95)),
        calls: Math.max(...metrics.samples.map((x) => x.calls)),
        triangles: Math.max(...metrics.samples.map((x) => x.triangles)),
        note: "Chromium SwiftShader emulado; não substitui validação em Mali-G52/Adreno 610 ou iPhone físico.",
      };
      await mkdir("docs/performance", { recursive: true });
      await writeFile(
        `docs/performance/${who}-${rate}x.json`,
        JSON.stringify(summary, null, 2),
      );
      await a.context.close();
      if (b) await b.context.close();
      expect(summary.calls).toBeLessThanOrEqual(60);
      expect(summary.triangles).toBeLessThanOrEqual(100000);
      expect(summary.bytesPerSecond).toBeLessThan(8000);
      expect(summary.fps).toBeGreaterThanOrEqual(30);
    });
