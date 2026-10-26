import { test, expect } from "@playwright/test";
import { room, player, send, buildCity } from "./helpers.js";
for (const latency of [150, 300])
  test(`RTT ${latency} ms: cliente reconecta com identidade e estado`, async ({
    browser,
  }) => {
    const r = await room("cidade"),
      a = await player(browser, r, "Ana"),
      b = await player(browser, r, "Bia");
    const cdp = await b.context.newCDPSession(b.page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: latency / 2,
      downloadThroughput: 750000,
      uploadThroughput: 350000,
    });
    await send(a.page, "iniciar");
    const uid = await b.page.evaluate(() => tc.session.uid);
    await b.context.setOffline(true);
    await b.page.waitForTimeout(1000);
    await b.context.setOffline(false);
    await b.page.waitForFunction(() => tc.session.connected);
    expect(await b.page.evaluate(() => tc.session.uid)).toBe(uid);
    await send(a.page, "catalogo", { type: "arvore" });
    await send(a.page, "mover", { x: 0, z: 0 });
    await send(a.page, "soltar");
    await b.page.waitForFunction(() => tc.state.blocks.length === 1);
    expect(
      b.errors.filter((e) => !e.includes("ERR_INTERNET_DISCONNECTED")),
    ).toEqual([]);
    await a.context.close();
    await b.context.close();
  });
test("WebSocket: 300 ms RTT, jitter e 5% de retransmissões simuladas", async ({
  browser,
}) => {
  const r = await room("cidade"),
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  let count = 0,
    retransmissions = 0;
  await context.routeWebSocket(/127\.0\.0\.1:9000/, (socket) => {
    const server = socket.connectToServer();
    let clientNext = 0,
      serverNext = 0;
    function delayed(message, send, direction) {
      count++;
      const retry = count % 20 === 0;
      if (retry) retransmissions++;
      const now = Date.now(),
        delay = 150 + (count % 5) * 6 + (retry ? 150 : 0),
        target = Math.max(
          now + delay,
          (direction === "client" ? clientNext : serverNext) + 1,
        );
      if (direction === "client") clientNext = target;
      else serverNext = target;
      setTimeout(() => {
        try {
          send(message);
        } catch {}
      }, target - now);
    }
    socket.onMessage((message) =>
      delayed(message, (m) => server.send(m), "client"),
    );
    server.onMessage((message) =>
      delayed(message, (m) => socket.send(m), "server"),
    );
  });
  const page = await context.newPage();
  await page.goto(r.url);
  await page.getByLabel("Seu nome", { exact: true }).fill("Ana");
  await page.getByRole("button", { name: "Entrar na construção" }).click();
  await page.waitForFunction(
    () => tc.session?.isHost && tc.state?.roles[tc.session.uid],
  );
  await send(page, "iniciar");
  await buildCity([page]);
  await page.waitForFunction(() => tc.state.status === "vitoria");
  expect(retransmissions).toBeGreaterThan(0);
  expect(await page.evaluate(() => tc.state.blocks.length)).toBe(4);
  await context.close();
});
