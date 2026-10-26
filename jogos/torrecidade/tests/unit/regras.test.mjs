import test from "node:test";
import assert from "node:assert/strict";
import {
  distribuirPapeis,
  elegerHost,
  makeState,
  reduceInput,
  rebalance,
  packQuaternion,
  unpackQuaternion,
  packBody,
  Interpolator,
  applyPhysics,
  hash,
  zone,
  compactChunk,
} from "../../js/regras.js";
import { Physics } from "../../js/fisica.js";
const players = (n) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      "p" + i,
      { entrouEm: i, online: true },
    ]),
  );
for (let n = 1; n <= 6; n++)
  test(`${n} jogadores: todos os papéis necessários cobertos`, () => {
    const roles = distribuirPapeis(players(n));
    assert.equal(Object.keys(roles).length, n);
    for (const r of ["arquiteto", "construtor", "engenheiro", "intendente"])
      assert(Object.values(roles).flat().includes(r));
  });
test("entrada preserva dono da peça até soltar", () => {
  let s = rebalance(makeState(), players(1));
  s = reduceInput(s, { seq: 1, type: "iniciar" }, "p0", 1000);
  s = reduceInput(
    s,
    { seq: 2, type: "mover", data: { x: 0, z: 0 } },
    "p0",
    1100,
  );
  s = rebalance(s, players(3));
  assert.equal(s.roles.p0.length, 4);
  assert(s.pendingRoles.p1);
  s = reduceInput(s, { seq: 3, type: "soltar" }, "p0", 1200);
  assert.deepEqual(s.roles.p0, ["arquiteto"]);
  assert.equal(s.blocks.length, 1);
});
test("sair libera papel; ficar sozinho assume tudo", () => {
  const s = rebalance(makeState(), players(3));
  const single = rebalance(s, { p2: players(3).p2 });
  assert.equal(single.roles.p2.length, 4);
});
test("uma ação repetida não cria peça nem contribuição dupla", () => {
  let s = rebalance(makeState(), players(1));
  s.status = "jogando";
  const i = { seq: 1, type: "soltar" };
  s = reduceInput(s, i, "p0", 100);
  assert.equal(reduceInput(s, i, "p0", 200), s);
  assert.equal(s.contributions.p0.pecas, 1);
});
test("papel errado, NaN e escolha fora da fila não alteram peça", () => {
  let s = rebalance(makeState(), players(3));
  s.status = "jogando";
  assert.equal(
    reduceInput(s, { seq: 1, type: "soltar" }, "p0", 1).blocks.length,
    0,
  );
  assert.equal(
    reduceInput(s, { seq: 1, type: "mover", data: { x: NaN, z: 0 } }, "p1", 1)
      .ghost.x,
    0,
  );
  assert.equal(
    reduceInput(s, { seq: 1, type: "escolher", data: { choice: 9 } }, "p0", 1)
      .ghost.choice,
    0,
  );
});
test("eleição, lease vivo e migração têm epoch crescente", () => {
  const p = players(3),
    h = elegerHost(null, "p0", p, 1000, 0);
  assert.equal(h.epoch, 1);
  assert.equal(elegerHost(h, "p1", p, 2000, 1900), null);
  delete p.p0;
  assert.equal(elegerHost(h, "p1", p, 4000, 1000).epoch, 2);
});
test("quaternions smallest-three dentro de 0.0001", () => {
  for (let i = 0; i < 100; i++) {
    const q = [Math.sin(i), Math.cos(i * 0.4), 0.2, 0.3],
      len = Math.hypot(...q);
    const n = q.map((v) => v / len),
      r = unpackQuaternion(packQuaternion(n));
    assert(Math.abs(n.reduce((s, v, k) => s + v * r[k], 0)) > 0.99999);
  }
});
test("buffer ignora epochs velhos e limita extrapolação", () => {
  const b = (x) =>
    packBody({
      id: "a",
      p: [x, 0, 0],
      q: [0, 0, 0, 1],
      v: [1, 0, 0],
      sleep: false,
    });
  const i = new Interpolator();
  i.push({ epoch: 2, t: 1000, bodies: [b(1)] });
  i.push({ epoch: 1, t: 2000, bodies: [b(99)] });
  assert.equal(i.frames.length, 1);
  assert.equal(i.sample(9000)[0].p[0], 1.25);
});
test("cidade exige tipo correto, célula única e recursos", () => {
  let s = rebalance(makeState({ mode: "cidade" }), players(1));
  s.status = "jogando";
  s = reduceInput(s, { seq: 1, type: "soltar" }, "p0", 1);
  assert.equal(s.blocks.length, 0);
  s = reduceInput(
    s,
    { seq: 2, type: "catalogo", data: { type: "arvore" } },
    "p0",
    2,
  );
  s = reduceInput(s, { seq: 3, type: "soltar" }, "p0", 3);
  assert.equal(s.blocks.length, 1);
  assert.equal(zone(0, 0), "arvore");
  assert.equal(
    reduceInput(s, { seq: 4, type: "soltar" }, "p0", 4).blocks.length,
    1,
  );
});
test("vitória só com torre assentada; queda desconta uma vida por lote", () => {
  let s = rebalance(makeState(), players(1));
  s.status = "jogando";
  s.blocks = [
    {
      id: "a",
      type: "bloco",
      p: [0, 6, 0],
      q: [0, 0, 0, 1],
      v: [0, 0, 0],
      sleep: false,
    },
  ];
  assert.equal(applyPhysics(s, s.blocks, 100).status, "jogando");
  assert.equal(
    applyPhysics(s, [{ ...s.blocks[0], sleep: true }], 100).status,
    "vitoria",
  );
  assert.equal(
    applyPhysics(s, [{ ...s.blocks[0], p: [0, -3, 0] }], 100).lives,
    2,
  );
});
test("física determinística: mesma sequência, mesmo hash", () => {
  function run() {
    let s = makeState();
    s.blocks = Array.from({ length: 6 }, (_, i) => ({
      id: "" + i,
      type: "bloco",
      p: [0, 0.4 + i * 0.7, 0],
      q: [0, 0, 0, 1],
      v: [0, 0, 0],
      sleep: false,
    }));
    const sim = new Physics(s);
    for (let t = 0; t < 600; t++) sim.step((t * 1000) / 60);
    return hash(sim.snapshot());
  }
  assert.equal(run(), run());
});
test("compactação de bairro preserva posição milimétrica", () => {
  const b = { id: "a", type: "casa", p: [2, 1.1, -2], q: [0, 0, 0, 1] };
  assert.deepEqual(compactChunk([b])[0].slice(2, 5), [2000, 1100, -2000]);
});
