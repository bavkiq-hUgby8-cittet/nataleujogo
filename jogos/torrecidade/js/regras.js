/** Domain model. No browser, Firebase or rendering dependencies. All mutations return copies. */
export const VERSION = 1;
export const ROLES = ["arquiteto", "construtor", "engenheiro", "intendente"];
export const TYPES = {
  bloco: {
    nome: "Bloco",
    size: [1.8, 0.65, 1.15],
    color: "#e5ac69",
    cost: [1, 0, 0],
  },
  viga: {
    nome: "Viga",
    size: [2.6, 0.5, 0.85],
    color: "#d98a6a",
    cost: [2, 0, 0],
  },
  cubo: {
    nome: "Cubo",
    size: [1.15, 1.15, 1.15],
    color: "#83aaa1",
    cost: [1, 1, 0],
  },
  casa: {
    nome: "Casa",
    size: [1.4, 1.1, 1.4],
    color: "#e5ad6a",
    cost: [2, 1, 0],
  },
  rua: {
    nome: "Rua",
    size: [1.8, 0.16, 1.8],
    color: "#d6cbb8",
    cost: [0, 1, 0],
  },
  praca: {
    nome: "Praça",
    size: [1.8, 0.25, 1.8],
    color: "#96b17e",
    cost: [1, 1, 1],
  },
  arvore: {
    nome: "Árvore",
    size: [1, 0.25, 1],
    color: "#699a7e",
    cost: [1, 0, 1],
  },
};
export const DIFFICULTIES = {
  familia: {
    nome: "Sem pressa",
    seconds: 0,
    friction: 0.95,
    goal: 5,
    braces: 6,
  },
  normal: { nome: "Normal", seconds: 600, friction: 0.65, goal: 7, braces: 4 },
  desafio: {
    nome: "Desafio",
    seconds: 300,
    friction: 0.45,
    goal: 9,
    braces: 3,
  },
};
export function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (1664525 * n + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const quantize = (v) => Math.round(v * 1000);
export const dequantize = (v) => v / 1000;
export function distribuirPapeis(players, mode = "torre") {
  const list = Object.entries(players || {})
    .filter(([, p]) => p.online !== false)
    .sort((a, b) => a[1].entrouEm - b[1].entrouEm || a[0].localeCompare(b[0]))
    .slice(0, 6);
  const count = list.length;
  const result = {};
  list.forEach(([uid], i) => {
    if (count === 1) result[uid] = [...ROLES];
    else if (count === 2)
      result[uid] =
        i === 0 ? ["arquiteto", "construtor"] : ["engenheiro", "intendente"];
    else if (count === 3)
      result[uid] = [
        ["arquiteto"],
        ["construtor"],
        ["engenheiro", "intendente"],
      ][i];
    else result[uid] = i < 4 ? [ROLES[i]] : ["guia"];
  });
  return result;
}
export function elegerHost(
  current,
  candidate,
  online,
  now,
  beat = 0,
  instance = "tab",
) {
  if (!online[candidate]) return null;
  if (current && online[current.uid] && now - beat <= 2800) return null;
  const first = Object.keys(online).sort(
    (a, b) => online[a].entrouEm - online[b].entrouEm || a.localeCompare(b),
  )[0];
  if (first !== candidate) return null;
  return {
    uid: candidate,
    instance,
    epoch: (current?.epoch || 0) + 1,
    desde: now,
  };
}
export function packQuaternion(q) {
  let index = 0;
  for (let i = 1; i < 4; i++)
    if (Math.abs(q[i]) > Math.abs(q[index])) index = i;
  const sign = q[index] < 0 ? -1 : 1;
  return [
    index,
    ...q.filter((_, i) => i !== index).map((v) => Math.round(v * sign * 32767)),
  ];
}
export function unpackQuaternion(p) {
  const a = p.slice(1).map((v) => v / 32767);
  const missing = Math.sqrt(Math.max(0, 1 - a.reduce((n, v) => n + v * v, 0)));
  a.splice(p[0], 0, missing);
  return a;
}
export function slerp(a, b, t) {
  let d = a.reduce((v, x, i) => v + x * b[i], 0);
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = b.map((v) => -v);
  }
  d = clamp(d, -1, 1);
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t);
    const n = Math.hypot(...r);
    return r.map((v) => v / n);
  }
  const angle = Math.acos(d),
    den = Math.sin(angle);
  return a.map(
    (v, i) =>
      (v * Math.sin((1 - t) * angle) + bb[i] * Math.sin(t * angle)) / den,
  );
}
export function packBody(b) {
  return [
    b.id,
    ...b.p.map(quantize),
    ...packQuaternion(b.q),
    ...b.v.map((v) => Math.round(v * 100)),
    b.sleep ? 1 : 0,
  ];
}
export function unpackBody(b) {
  return {
    id: b[0],
    p: b.slice(1, 4).map(dequantize),
    q: unpackQuaternion(b.slice(4, 8)),
    v: b.slice(8, 11).map((v) => v / 100),
    sleep: !!b[11],
  };
}
export class Interpolator {
  constructor() {
    this.frames = [];
    this.epoch = 0;
  }
  push(frame) {
    if (frame.epoch < this.epoch) return;
    if (frame.epoch > this.epoch) {
      this.frames = [];
      this.epoch = frame.epoch;
    }
    if (this.frames.at(-1)?.t >= frame.t) return;
    this.frames.push(frame);
    if (this.frames.length > 5) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return [];
    const target = now - 120;
    let a = this.frames[0],
      b = this.frames.at(-1);
    for (let i = 1; i < this.frames.length; i++)
      if (this.frames[i].t >= target) {
        a = this.frames[i - 1];
        b = this.frames[i];
        break;
      }
    const t = clamp((target - a.t) / Math.max(1, b.t - a.t), 0, 1),
      old = new Map(
        a.bodies.map((v) => {
          let u = unpackBody(v);
          return [u.id, u];
        }),
      );
    return b.bodies.map((v) => {
      const next = unpackBody(v),
        prev = old.get(next.id) || next;
      const dt = clamp((target - b.t) / 1000, 0, 0.25);
      return {
        ...next,
        p: next.p.map(
          (v, i) => prev.p[i] + (v - prev.p[i]) * t + next.v[i] * dt,
        ),
        q: slerp(prev.q, next.q, t),
      };
    });
  }
}
export function makeState({
  mode = "torre",
  difficulty = "familia",
  seed = 1,
  now = 0,
  id = "partida",
} = {}) {
  return {
    v: VERSION,
    id,
    mode,
    difficulty,
    seed,
    phase: 1,
    status: mode === "mundo" ? "jogando" : "lobby",
    started: now,
    elapsed: 0,
    lives: 3,
    stars: 0,
    height: 0,
    braces: DIFFICULTIES[difficulty].braces,
    holdUntil: 0,
    resources: [18, 14, 8],
    queue:
      mode === "torre" ? ["bloco", "viga", "cubo"] : ["casa", "rua", "arvore"],
    ghost: { x: 0, z: 0, rotation: 0, choice: 0, owner: "" },
    blocks: [],
    ack: {},
    contributions: {},
    timeline: [],
    completed: [],
    roles: {},
    pendingRoles: null,
    revision: 0,
    falls: 0,
    district: 0,
    districtCounts: {},
    totalPieces: 0,
    unlocked: 1,
    archive: null,
  };
}
export const goalFor = (s) =>
  DIFFICULTIES[s.difficulty].goal + (s.phase - 1) * 2;
export function starsFor(s) {
  return Math.max(1, 3 - (s.lives < 3 ? 1 : 0) - (s.elapsed > 240000 ? 1 : 0));
}
export function zone(x, z) {
  if (x === 0 && z === 0) return "arvore";
  if (x === 0 || z === 0) return "rua";
  if (x < 0 && z < 0) return "praca";
  return "casa";
}
export function cityGoal(s) {
  const required = ["-2,-2", "0,0", "0,2", "2,2"];
  return required.every((key) => s.blocks.some((b) => b.cell === key));
}
export function can(s, uid, type) {
  const roles = s.roles[uid] || [];
  const required = {
    girar: "arquiteto",
    escolher: "arquiteto",
    catalogo: "arquiteto",
    mover: "construtor",
    soltar: "construtor",
    escora: "engenheiro",
    segurar: "engenheiro",
    repor: "intendente",
  };
  return !required[type] || roles.includes(required[type]);
}
export function rebalance(s, players) {
  const roles = distribuirPapeis(players, s.mode);
  if (
    s.ghost.owner &&
    players[s.ghost.owner]?.online !== false &&
    players[s.ghost.owner]
  )
    return { ...s, pendingRoles: roles };
  return { ...s, roles, pendingRoles: null, ghost: { ...s.ghost, owner: "" } };
}
export function reduceInput(state, input, uid, now) {
  if (!Number.isSafeInteger(input.seq) || input.seq <= (state.ack[uid] || 0))
    return state;
  const s = structuredClone(state);
  s.ack[uid] = input.seq;
  s.revision++;
  if (!can(s, uid, input.type)) return s;
  const data = input.data || {};
  if (input.type === "trocar" && ROLES.includes(data.role)) {
    const current = s.roles[uid] || [];
    const other = Object.keys(s.roles).find(
      (id) => id !== uid && s.roles[id].includes(data.role),
    );
    if (other && current.length) {
      const roles = structuredClone(s.roles),
        given = current[0];
      roles[uid] = [...current.filter((r) => r !== given), data.role];
      roles[other] = [...roles[other].filter((r) => r !== data.role), given];
      if (s.ghost.owner) s.pendingRoles = roles;
      else s.roles = roles;
    }
    return s;
  }
  if (input.type === "iniciar" && s.status === "lobby") {
    s.status = "jogando";
    s.started = now;
    return s;
  }
  if (input.type === "proxima" && s.status === "vitoria") {
    s.phase++;
    s.status = "jogando";
    s.blocks = [];
    s.height = 0;
    s.started = now;
    s.ghost.owner = "";
    return s;
  }
  if (s.status !== "jogando") return s;
  s.elapsed = Math.max(0, now - s.started);
  if (
    input.type === "escolher" &&
    Number.isInteger(data.choice) &&
    data.choice >= 0 &&
    data.choice < 3
  )
    s.ghost.choice = data.choice;
  if (
    input.type === "catalogo" &&
    s.mode !== "torre" &&
    ["casa", "rua", "praca", "arvore"].includes(data.type)
  )
    s.queue[s.ghost.choice] = data.type;
  if (input.type === "girar") s.ghost.rotation = (s.ghost.rotation + 1) % 4;
  if (
    input.type === "mover" &&
    Number.isFinite(data.x) &&
    Number.isFinite(data.z)
  ) {
    const limit = s.mode === "torre" ? 10 : 4;
    s.ghost.x = clamp(Math.round(data.x * 2) / 2, -limit, limit);
    s.ghost.z = clamp(Math.round(data.z * 2) / 2, -limit, limit);
    s.ghost.owner = uid;
  }
  if (input.type === "escora" && s.braces > 0) {
    const b = s.blocks.find((b) => b.id === data.id) || s.blocks.at(-1);
    if (b && !b.braced) {
      b.braced = true;
      b.sleep = true;
      s.braces--;
      contribute(s, uid, "escoras", now);
    }
  }
  if (input.type === "segurar" && s.braces > 0 && s.holdUntil < now) {
    s.holdUntil = now + 3000;
    s.braces--;
    contribute(s, uid, "salvamentos", now);
  }
  if (input.type === "repor" && now - (s.lastSupply || 0) >= 4000) {
    s.resources = s.resources.map((v, i) => Math.min(40, v + [3, 2, 1][i]));
    s.lastSupply = now;
    contribute(s, uid, "recursos", now);
  }
  if (input.type === "soltar") {
    if (s.blocks.length >= 150 && s.mode !== "mundo") return s;
    let type = s.queue[s.ghost.choice];
    let x = s.ghost.x,
      z = s.ghost.z;
    if (s.mode !== "torre") {
      x = Math.round(x / 2) * 2;
      z = Math.round(z / 2) * 2;
      // The architect chooses the building; zones are requirements, never silently substituted.
      if (s.blocks.some((b) => b.cell === `${x},${z}`) || type !== zone(x, z))
        return s;
      const cost = TYPES[type].cost;
      if (cost.some((v, i) => v > s.resources[i])) return s;
      s.resources = s.resources.map((v, i) => v - cost[i]);
    }
    const size = TYPES[type].size;
    const y = s.mode === "torre" ? s.height + size[1] / 2 + 0.35 : size[1] / 2;
    const angle = (s.ghost.rotation * Math.PI) / 2;
    s.blocks.push({
      id: `${uid}_${input.seq}`,
      type,
      p: [x, y, z],
      q: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
      v: [0, 0, 0],
      sleep: s.mode !== "torre",
      braced: false,
      cell: `${x},${z}`,
    });
    if (s.mode === "torre") s.height = y + size[1] / 2 - 0.35;
    contribute(s, uid, "pecas", now, type);
    if (s.mode === "mundo") {
      s.totalPieces++;
      s.districtCounts[s.district] = s.blocks.length;
      s.unlocked = Math.min(64, 1 + Math.floor(s.totalPieces / 12));
    }
    const next =
      s.mode === "torre"
        ? ["bloco", "viga", "cubo"][(s.seed + s.blocks.length) % 3]
        : ["casa", "rua", "praca", "arvore"][s.blocks.length % 4];
    s.queue.splice(s.ghost.choice, 1);
    s.queue.push(next);
    s.ghost.owner = "";
    if (s.pendingRoles) {
      s.roles = s.pendingRoles;
      s.pendingRoles = null;
    }
    if (s.mode === "cidade" && cityGoal(s)) complete(s);
  }
  return s;
}
function contribute(s, uid, kind, now, type = "") {
  const c = s.contributions[uid] || {
    pecas: 0,
    escoras: 0,
    salvamentos: 0,
    recursos: 0,
  };
  c[kind]++;
  s.contributions[uid] = c;
  if (kind === "pecas") {
    s.timeline.push({ id: `${uid}_${s.ack[uid]}`, uid, type, t: now });
    s.timeline = s.timeline.slice(-40);
  }
}
function complete(s) {
  s.status = "vitoria";
  s.stars = starsFor(s);
  const id = `${s.id}_${s.phase}`;
  if (!s.completed.includes(id)) s.completed.push(id);
}
export function applyPhysics(state, bodies, now) {
  const s = structuredClone(state),
    map = new Map(bodies.map((b) => [b.id, b]));
  let fell = 0;
  s.blocks = s.blocks.flatMap((b) => {
    const p = map.get(b.id);
    if (!p) return [b];
    if (p.p[1] < -2 || Math.abs(p.p[0]) > 12 || Math.abs(p.p[2]) > 12) {
      fell++;
      return [];
    }
    return [{ ...b, ...p }];
  });
  if (s.mode === "torre") {
    s.height = Math.max(
      0,
      ...s.blocks
        .filter((b) => Math.abs(b.p[0]) < 6 && Math.abs(b.p[2]) < 6)
        .map((b) => b.p[1] + TYPES[b.type].size[1] / 2),
    );
    if (fell) {
      s.lives = Math.max(0, s.lives - 1);
      s.falls += fell;
      if (!s.lives) s.status = "derrota";
    }
    if (
      s.status === "jogando" &&
      s.height >= goalFor(s) &&
      s.blocks.length &&
      s.blocks.every((b) => b.sleep)
    )
      complete(s);
  }
  s.elapsed = Math.max(0, now - s.started);
  const seconds = DIFFICULTIES[s.difficulty].seconds;
  if (
    s.mode !== "mundo" &&
    s.status === "jogando" &&
    seconds &&
    s.elapsed > seconds * 1000
  )
    s.status = "derrota";
  return s;
}
export function stability(s) {
  if (!s.blocks.length) return 100;
  const mass = s.blocks.reduce(
    (a, b) => a + TYPES[b.type].size.reduce((x, y) => x * y, 1),
    0,
  );
  const center = s.blocks
    .reduce(
      (a, b) => {
        const m = TYPES[b.type].size.reduce((x, y) => x * y, 1);
        return [a[0] + b.p[0] * m, a[1] + b.p[2] * m];
      },
      [0, 0],
    )
    .map((x) => x / mass);
  return Math.round(
    clamp(100 - Math.hypot(...center) * 35 - s.height * 1.1, 0, 100),
  );
}
export function chunkId(x, z) {
  return `${Math.floor(x / 16)}_${Math.floor(z / 16)}`;
}
export function compactChunk(blocks) {
  return blocks.map((b) => [
    b.id,
    b.type,
    ...b.p.map(quantize),
    Math.round((Math.atan2(b.q[1], b.q[3]) * 4) / Math.PI + 8) % 4,
  ]);
}
export function hash(value) {
  let h = 2166136261;
  for (const c of JSON.stringify(value)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function expandChunk(rows) {
  return rows.map(([id, type, x, y, z, rotation]) => ({
    id,
    type,
    p: [x / 1000, y / 1000, z / 1000],
    q: [
      0,
      Math.sin((rotation * Math.PI) / 4),
      0,
      Math.cos((rotation * Math.PI) / 4),
    ],
    v: [0, 0, 0],
    sleep: true,
    braced: false,
    cell: `${x / 1000},${z / 1000}`,
  }));
}
