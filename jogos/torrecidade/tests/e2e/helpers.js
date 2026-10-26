import { expect, devices } from "@playwright/test";
export const root = "/jogos/torrecidade/";
export async function room(mode = "torre") {
  const email = `family-${crypto.randomUUID()}@example.com`,
    password = "test-password-123";
  const a = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-jogos-familia",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const user = await a.json();
  if (!a.ok) throw Error(JSON.stringify(user));
  const family = user.localId,
    invite = "a".repeat(48),
    path = `familias/${family}/jogos/torrecidade/${mode === "mundo" ? "mundo" : "salas/ensaio"}`;
  const put = async (p, v) => {
    const res = await fetch(
      `http://127.0.0.1:9000/${p}.json?ns=demo-jogos-familia-default-rtdb&auth=${user.idToken}`,
      { method: "PUT", body: JSON.stringify(v) },
    );
    if (!res.ok) throw Error(await res.text());
  };
  await put(`familias/${family}/adminUid`, family);
  await put(path + "/config", {
    mode,
    difficulty: "familia",
    theme: "neutro",
    invite,
    created: Date.now(),
    closed: false,
  });
  return {
    family,
    invite,
    mode,
    path,
    email,
    password,
    url:
      root +
      `jogar.html?sala=ensaio&familia=${family}&convite=${invite}&modo=${mode}`,
  };
}
export async function player(browser, r, name, device = "Pixel 5") {
  const context = await browser.newContext({
    ...devices[device],
    recordVideo: { dir: "test-results/videos" },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(r.url);
  await page.getByLabel("Seu nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Entrar na construção" }).click();
  await expect(page.locator("#play")).toBeVisible();
  await page.waitForFunction(
    () => !!window.tc.state?.roles[window.tc.session.uid],
  );
  return { page, context, errors };
}
export const send = (p, type, data = {}) =>
  p.evaluate(async ({ type, data }) => window.tc.session.send(type, data), {
    type,
    data,
  });
export const waitState = (p, predicate) => p.waitForFunction(predicate);
export async function pickRole(p, role) {
  await p
    .locator("#roles")
    .getByRole("button", { name: role, exact: true })
    .click();
}
export async function buildCity(pages) {
  const architect = pages[0],
    builder = pages.length > 1 ? pages[1] : pages[0];
  for (const [type, x, z] of [
    ["arvore", 0, 0],
    ["praca", -2, -2],
    ["rua", 0, 2],
    ["casa", 2, 2],
  ]) {
    await send(architect, "catalogo", { type });
    await send(builder, "mover", { x, z });
    await send(builder, "soltar");
  }
}
