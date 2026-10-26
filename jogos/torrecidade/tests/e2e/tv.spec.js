import { test, expect } from "@playwright/test";
import { room, player, send, buildCity, root } from "./helpers.js";
async function tv(browser, r) {
  const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: "test-results/videos" },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(r.url.replace("jogar.html", "tv.html") + "&admin=1");
  await page.evaluate(async (creds) => {
    const F = await import("./vendor/firebase.js");
    const app = F.initializeApp(window.JOGOS_FIREBASE);
    const auth = F.initializeAuth(app, {
      persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence],
    });
    F.connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    F.connectDatabaseEmulator(F.getDatabase(app), "127.0.0.1", 9000);
    app._tcEmulator = true;
    app._tcAuth = auth;
    await F.signInWithEmailAndPassword(auth, creds.email, creds.password);
  }, r);
  await page.getByLabel("Seu nome", { exact: true }).fill("TV da família");
  await page.getByRole("button", { name: "Entrar na construção" }).click();
  await page.waitForFunction(() => tc.state);
  return { context, page, errors };
}
test("2 TVs + 3 celulares: um host, uma vitória e QR correto", async ({
  browser,
}) => {
  // Five independent WebGL contexts share a software GPU in hosted CI.
  // Protocol election/ACK timeouts remain unchanged; allow browser setup time.
  test.setTimeout(180000);
  const r = await room("cidade"),
    a = await tv(browser, r),
    other = await tv(browser, r);
  const b = await player(browser, r, "Ana"),
    c = await player(browser, r, "Bia", "iPhone 13"),
    d = await player(browser, r, "Vô");
  expect(await a.page.evaluate(() => tc.session.isHost)).toBe(true);
  expect(await other.page.evaluate(() => tc.session.isHost)).toBe(false);
  await expect(a.page.locator("#join-link")).toHaveAttribute(
    "href",
    new RegExp("jogar.html\\?familia="),
  );
  await send(a.page, "iniciar");
  await buildCity([a.page, b.page]);
  await a.page.waitForFunction(() => tc.state.status === "vitoria");
  await expect
    .poll(() =>
      a.page.evaluate(
        async () =>
          Object.keys((await tc.session.b.read("placar"))?.scores || {}).length,
      ),
    )
    .toBe(1);
  await other.page.evaluate(() => tc.session.checkpoint());
  expect(
    await a.page.evaluate(
      async () =>
        Object.keys((await tc.session.b.read("placar")).scores).length,
    ),
  ).toBe(1);
  const record = await a.page.evaluate(async () => {
    const F = await import('./vendor/firebase.js');
    const game = tc.session.b.path.split('/salas/')[0];
    const id = tc.state.id + '_' + tc.state.phase;
    return (await F.get(F.ref(tc.session.b.db, game + '/recordes/' + id))).val();
  });
  expect(record.stars).toBe(3);
  await a.page.screenshot({ path: "docs/cidade-tv.png" });
  expect([
    ...a.errors,
    ...other.errors,
    ...b.errors,
    ...c.errors,
    ...d.errors,
  ]).toEqual([]);
  for (const p of [a, other, b, c, d]) await p.context.close();
});
test("Torre completa com física, três celulares e escoras", async ({
  browser,
}) => {
  const r = await room(),
    a = await player(browser, r, "Ana"),
    b = await player(browser, r, "Bia"),
    c = await player(browser, r, "Vô");
  await send(a.page, "iniciar");
  for (let i = 0; i < 8; i++) {
    await send(b.page, "soltar");
    await b.page.waitForTimeout(900);
    if (i < 6) await send(c.page, "escora");
  }
  await a.page.waitForFunction(
    () => tc.state.status === "vitoria",
    {},
    { timeout: 30000 },
  );
  expect(await a.page.evaluate(() => tc.state.lives)).toBe(3);
  await a.page.screenshot({ path: "docs/torre-celular.png", fullPage: true });
  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  for (const p of [a, b, c]) await p.context.close();
});

test('admin reaproveita conta e reabre mundo sem substituir convite', async ({browser}) => {
  const r = await room(), a = await tv(browser, r);
  const result = await a.page.evaluate(async () => {
    const B = await import('./js/backend.js');
    const connection = await B.firebaseConnection(true);
    const first = await B.createRoom(connection, {room:'ABCD', mode:'mundo'});
    const second = await B.createRoom(connection, {room:'EFGH', mode:'mundo'});
    return {same: first.invite === second.invite, family: first.family};
  });
  expect(result.same).toBe(true);expect(result.family).toBe(r.family);
  expect(a.errors).toEqual([]);await a.context.close();
});
