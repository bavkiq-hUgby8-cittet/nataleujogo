import { test, expect } from "@playwright/test";
import { room, player, send, buildCity, pickRole } from "./helpers.js";
test("3 celulares, sem TV: completar Cidade por papéis e pontuação coletiva", async ({
  browser,
}) => {
  const r = await room("cidade"),
    a = await player(browser, r, "Ana"),
    b = await player(browser, r, "Bia", "iPhone 13"),
    c = await player(browser, r, "Vô");
  await expect(a.page.locator("#people .person")).toHaveCount(3);
  await send(a.page, "iniciar");
  await buildCity([a.page, b.page, c.page]);
  await a.page.waitForFunction(() => tc.state.status === "vitoria");
  await expect(c.page.locator("#status")).toContainText("Conseguimos");
  await a.page.screenshot({ path: "docs/cidade-celular.png", fullPage: true });
  expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  await Promise.all([a.context.close(), b.context.close(), c.context.close()]);
});
test("drop-in não reinicia; host sai e quem fica conclui sozinho", async ({
  browser,
}) => {
  const r = await room("cidade"),
    a = await player(browser, r, "Ana");
  await send(a.page, "iniciar");
  await send(a.page, "catalogo", { type: "arvore" });
  await send(a.page, "soltar");
  const id = await a.page.evaluate(() => tc.state.id);
  const b = await player(browser, r, "Bia", "iPhone 13"),
    c = await player(browser, r, "Vô");
  await expect(c.page.locator("#people .person")).toHaveCount(3);
  expect(await c.page.evaluate(() => tc.state.id)).toBe(id);
  await a.context.close();
  await b.context.close();
  await c.page.waitForFunction(
    () => tc.session.isHost && tc.state.roles[tc.session.uid]?.length === 4,
    {},
    { timeout: 8000 },
  );
  for (const [type, x, z] of [
    ["praca", -2, -2],
    ["rua", 0, 2],
    ["casa", 2, 2],
  ]) {
    await send(c.page, "catalogo", { type });
    await send(c.page, "mover", { x, z });
    await send(c.page, "soltar");
  }
  await c.page.waitForFunction(() => tc.state.status === "vitoria");
  expect(c.errors).toEqual([]);
  await c.context.close();
});
test("Nossa Cidade sobrevive ao fechamento abrupto do último jogador", async ({
  browser,
}) => {
  const r = await room("mundo"),
    a = await player(browser, r, "Ana");
  await send(a.page, "catalogo", { type: "arvore" });
  await send(a.page, "soltar");
  await expect
    .poll(() =>
      a.page.evaluate(() => Object.keys(tc.state.contributions).length),
    )
    .toBe(1);
  const original = await a.page.evaluate(() => JSON.stringify(tc.state.blocks));
  await a.context.close();
  const b = await player(browser, r, "Vô");
  await b.page.waitForFunction(() => tc.state.blocks.length === 1);
  expect(await b.page.evaluate(() => JSON.stringify(tc.state.blocks))).toBe(
    original,
  );
  expect(await b.page.evaluate(() => tc.state.timeline.length)).toBe(1);
  expect(b.errors).toEqual([]);
  await b.context.close();
});
test("solo: botões de todos os papéis, movimento 2D e convite", async ({
  browser,
}) => {
  const r = await room(),
    a = await player(browser, r, "Ramon");
  await a.page.getByRole("button", { name: "Começar juntos" }).click();
  await pickRole(a.page, "Construtor");
  await a.page.getByRole("button", { name: "↓ Soltar peça" }).click();
  await expect
    .poll(() => a.page.evaluate(() => tc.state.blocks.length))
    .toBe(1);
  await a.page.getByRole("button", { name: "Alternar controles 2D" }).click();
  await expect(a.page.locator("#fallback")).toBeVisible();
  expect(a.errors).toEqual([]);
  await a.context.close();
});
test("bairro desbloqueia, carrega sob demanda e volta sem perder peças", async ({
  browser,
}) => {
  const r = await room("mundo"),
    a = await player(browser, r, "Ana");
  const cells = [
    [-4, -4],
    [-2, -4],
    [0, -4],
    [2, -4],
    [4, -4],
    [-4, -2],
    [-2, -2],
    [0, -2],
    [2, -2],
    [4, -2],
    [-4, 0],
    [-2, 0],
  ];
  for (const [x, z] of cells) {
    const type = x === 0 || z === 0 ? "rua" : x < 0 && z < 0 ? "praca" : "casa";
    await send(a.page, "catalogo", { type });
    await send(a.page, "mover", { x, z });
    await send(a.page, "repor");
    await send(a.page, "soltar");
  }
  await expect.poll(() => a.page.evaluate(() => tc.state.totalPieces)).toBe(12);
  const original = await a.page.evaluate(() =>
    JSON.stringify(tc.state.blocks.map((b) => b.id)),
  );
  await send(a.page, "bairro", { district: 1 });
  expect(await a.page.evaluate(() => tc.state.blocks.length)).toBe(0);
  await send(a.page, "bairro", { district: 0 });
  expect(
    await a.page.evaluate(() =>
      JSON.stringify(tc.state.blocks.map((b) => b.id)),
    ),
  ).toBe(original);
  await a.context.close();
});
