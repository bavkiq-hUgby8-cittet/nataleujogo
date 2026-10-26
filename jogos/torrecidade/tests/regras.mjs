import { before, test } from "node:test";
import assert from "node:assert/strict";
let admin, a, b, outsider;
let base;
const invite = "a".repeat(48);
const ref = (db, path) => ({ db, path });
async function req(db, path, method, value) {
  const response = await fetch(
    `http://127.0.0.1:9000/${path}.json?ns=demo-jogos-familia-default-rtdb&auth=${db.token}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: value === undefined ? undefined : JSON.stringify(value),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(Error(JSON.stringify(body)), {
      status: response.status,
    });
  return body;
}
const set = (r, v) => req(r.db, r.path, "PUT", v),
  get = (r) => req(r.db, r.path, "GET"),
  update = (r, v) => req(r.db, r.path, "PATCH", v);
const write = (db, p, v) => set(ref(db, base + "/" + p), v),
  read = (db, p) => get(ref(db, base + "/" + p));
const assertFails = (promise) =>
  assert.rejects(promise, (e) => [401, 403].includes(e.status));
const assertSucceeds = (promise) => promise;
async function account(email) {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-jogos-familia",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(email ? { email, password: "test-password-123" } : {}),
        returnSecureToken: true,
      }),
    },
  );
  const u = await response.json();
  return { token: u.idToken, uid: u.localId };
}
before(async () => {
  admin = await account("rules-" + Date.now() + "@example.com");
  a = await account();
  b = await account();
  outsider = await account();
  base = `familias/${admin.uid}/jogos/torrecidade/salas/ensaio`;
  await set(ref(admin, `familias/${admin.uid}/adminUid`), admin.uid);
  await write(admin, "config", {
    mode: "torre",
    difficulty: "familia",
    theme: "neutro",
    invite,
    created: Date.now(),
    closed: false,
  });
});
test("isolamento: sem listar famílias, salas ou entrar sem convite", async () => {
  await assertFails(get(ref(a, "familias")));
  await assertFails(
    get(ref(a, `familias/${admin.uid}/jogos/torrecidade/salas`)),
  );
  await assertFails(read(a, ""));
  await assertFails(
    write(a, `jogadores/${a.uid}`, {
      nome: "Ana",
      avatar: "🦊",
      convite: "b".repeat(48),
      entrouEm: Date.now(),
      ready: false,
    }),
  );
});
test("convidado entra com convite; tipos, nome, uid e extras validados", async () => {
  await assertFails(
    write(a, `jogadores/${a.uid}`, {
      nome: "a".repeat(31),
      avatar: "🦊",
      convite: invite,
      entrouEm: Date.now(),
      ready: false,
    }),
  );
  await assertSucceeds(
    write(a, `jogadores/${a.uid}`, {
      nome: "Ana",
      avatar: "🦊",
      convite: invite,
      entrouEm: Date.now(),
      ready: false,
    }),
  );
  await assertSucceeds(read(a, "config"));
  await assertFails(
    write(a, `jogadores/${b.uid}`, {
      nome: "Ana",
      avatar: "🦊",
      convite: invite,
      entrouEm: Date.now(),
      ready: false,
    }),
  );
  await assertFails(
    update(ref(a, base + `/jogadores/${a.uid}`), { pontos: 999 }),
  );
  await assertFails(read(outsider, ""));
  await assertFails(get(ref(a, "familias/other/jogos/torrecidade/mundo")));
});
test("cliente não grava snapshot, configuração, placar ou host sem presença", async () => {
  await assertFails(
    write(a, "estado/snapshot", { epoch: 1, t: Date.now(), payload: "{}" }),
  );
  await assertFails(write(a, "placar", { epoch: 1, scores: {} }));
  await assertFails(write(a, "config/theme", "natal"));
  await assertFails(
    write(a, "host", {
      uid: a.uid,
      instance: "tab-a",
      epoch: 1,
      desde: Date.now(),
    }),
  );
});
test("host exige presença; lease vivo impede usurpação", async () => {
  await write(a, `online/${a.uid}/tab-a`, true);
  await assertSucceeds(
    set(ref(a, base + "/host"), {
      uid: a.uid,
      instance: "tab-a",
      epoch: 1,
      desde: Date.now(),
    }),
  );
  await write(a, "hostBeat", { epoch: 1, t: Date.now() });
  await write(b, `jogadores/${b.uid}`, {
    nome: "Bia",
    avatar: "🐱",
    convite: invite,
    entrouEm: Date.now(),
    ready: false,
  });
  await write(b, `online/${b.uid}/tab-b`, true);
  await assertFails(
    write(b, "host", {
      uid: b.uid,
      instance: "tab-b",
      epoch: 2,
      desde: Date.now(),
    }),
  );
  await assertSucceeds(
    write(a, "estado/snapshot", { epoch: 1, t: Date.now(), payload: "{}" }),
  );
  await assertFails(
    write(b, "estado/snapshot", { epoch: 1, t: Date.now(), payload: "{}" }),
  );
});
test("inputs pequenos, sequência monotônica e rate limit", async () => {
  const i = { seq: 1, type: "mover", data: '{"x":0,"z":0}', t: Date.now() };
  await assertSucceeds(write(b, `inputs/${b.uid}`, i));
  await assertFails(write(b, `inputs/${b.uid}`, { ...i, seq: 2 }));
  await assertFails(write(b, `inputs/${a.uid}`, i));
  await assertFails(
    write(b, `inputs/${b.uid}`, {
      ...i,
      seq: 2,
      data: "x".repeat(81),
      t: i.t + 100,
    }),
  );
  await assertFails(
    write(b, `inputs/${b.uid}`, { ...i, seq: 2, type: "admin", t: i.t + 100 }),
  );
});
test("ping só do próprio uid e no máximo 1/s", async () => {
  const p = { type: "aqui", x: 0, z: 0, t: Date.now() };
  await assertSucceeds(write(b, `pings/${b.uid}`, p));
  await assertFails(write(b, `pings/${b.uid}`, { ...p, type: "boa" }));
  await assertFails(write(b, `pings/${a.uid}`, p));
  await assertFails(
    write(b, `pings/${b.uid}`, { ...p, t: p.t + 1000, x: 10000 }),
  );
});
test("migração cerca host antigo, inclusive snapshot e heartbeat atrasados", async () => {
  await write(a, `online/${a.uid}/tab-a`, null);
  await assertSucceeds(
    write(b, "host", {
      uid: b.uid,
      instance: "tab-b",
      epoch: 2,
      desde: Date.now(),
    }),
  );
  await assertFails(
    write(a, "estado/snapshot", { epoch: 1, t: Date.now(), payload: "{}" }),
  );
  await assertFails(write(a, "hostBeat", { epoch: 1, t: Date.now() }));
  await assertFails(
    write(b, "estado/snapshot", { epoch: 1, t: Date.now(), payload: "{}" }),
  );
  await assertSucceeds(
    write(b, "estado/snapshot", { epoch: 2, t: Date.now(), payload: "{}" }),
  );
});
test("somente admin pode apagar ensaio, nunca mundo por esse caminho", async () => {
  await assertFails(write(a, "", null));
  await assertFails(
    set(ref(admin, `familias/${admin.uid}/jogos/torrecidade/mundo`), { x: 1 }),
  );
  await assertSucceeds(write(admin, "", null));
});
