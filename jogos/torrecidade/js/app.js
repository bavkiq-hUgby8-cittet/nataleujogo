import { Scene } from "./cena.js";
import {
  makeState,
  TYPES,
  ROLES,
  goalFor,
  stability,
  can,
  zone,
} from "./regras.js";
import {
  DemoBackend,
  FirebaseBackend,
  firebaseConnection,
  pathFor,
  createRoom,
} from "./backend.js";
import { Session } from "./rede.js";
import { unlock, sound, mute } from "./audio.js";
const $ = (id) => document.getElementById(id),
  params = new URLSearchParams(location.search),
  tv = location.pathname.endsWith("/tv.html");
const roleNames = {
  arquiteto: "Arquiteto",
  construtor: "Construtor",
  engenheiro: "Engenheiro",
  intendente: "Intendente",
  guia: "Guia",
};
const roleIcons = {
  arquiteto: "▱",
  construtor: "▥",
  engenheiro: "⚖",
  intendente: "♧",
  guia: "✦",
};
let mode = params.get("modo") || "torre",
  session = null,
  scene = null,
  activeRole = null,
  lastRoleKey = "",
  lastControlKey = "",
  state = null,
  demo = params.has("demo"),
  theme = "neutro",
  render3d = true;
window.tc = {
  get session() {
    return session;
  },
  get state() {
    return state;
  },
  get scene() {
    return scene;
  },
};
if (tv) document.body.classList.add("tv");
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 6500);
}
function show(id) {
  for (const name of ["welcome", "join", "play", "admin"])
    $(name).hidden = name !== id;
}
function button(text, fn, cls = "secondary") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      b.disabled = false;
    }
  });
  return b;
}
async function send(type, data) {
  try {
    await session.send(type, data);
  } catch (e) {
    toast(e.message);
  }
}
function previewState() {
  const s = makeState({ mode: "cidade" });
  s.status = "lobby";
  const layout = [
    [-2, -2, "casa"],
    [2, -2, "casa"],
    [-2, 2, "casa"],
    [2, 2, "casa"],
    [0, 0, "arvore"],
    [0, 2, "rua"],
    [0, -2, "rua"],
    [-2, 0, "rua"],
    [2, 0, "rua"],
    [4, 0, "praca"],
  ];
  s.blocks = layout.map(([x, z, type], i) => ({
    id: `preview_${i}`,
    type,
    p: [x, TYPES[type].size[1] / 2 + 0.08, z],
    q: [0, 0, 0, 1],
    v: [0, 0, 0],
    sleep: true,
  }));
  return s;
}
try {
  scene = new Scene($("scene"), {
    tv,
    onMove: (x, z) => {
      if (session && state && can(state, session.uid, "mover")) {
        scene.preview(x, z);
        send("mover", { x, z });
      }
    },
  });
  scene.setState(previewState());
  scene.onPing = () => session?.ping("aqui").catch((e) => toast(e.message));
} catch (e) {
  $("fallback").hidden = false;
  $("scene").hidden = true;
}
$("recenter").onclick = () => scene?.recenter();
$("toggle-3d").onclick = () => {
  render3d = !render3d;
  $("scene").hidden = !render3d;
  $("fallback").hidden = render3d;
  $("toggle-3d").textContent = render3d ? "2D" : "3D";
};
$("settings-toggle").onclick = () => $("settings").showModal();
$("quality").onchange = (e) => {
  if (!scene) return;
  if (e.target.value === "auto") scene.quality.manual = false;
  else scene.quality.set(e.target.value, true);
  scene.fit();
};
$("theme").onclick = async () => {
  const next = theme === "natal" ? "neutro" : "natal";
  if (session && !demo) {
    if (session.uid !== params.get("familia")) {
      toast("Só a conta da família muda o tema.");
      return;
    }
    await session.b.write("config", { ...session.config, theme: next });
  } else applyTheme(next);
};
$("sound").onclick = () => {
  $("sound").textContent = mute() ? "Ligar sons" : "Desligar sons";
};
function applyTheme(value) {
  theme = value;
  document.documentElement.dataset.tema = theme;
  scene?.setTheme(theme);
  $("theme").textContent =
    theme === "natal" ? "Usar tema neutro" : "Usar tema de Natal";
}
for (const card of document.querySelectorAll("[data-mode]"))
  card.onclick = () => {
    mode = card.dataset.mode;
    for (const c of document.querySelectorAll("[data-mode]"))
      c.classList.toggle("selected", c === card);
  };
$("demo").onclick = () => {
  demo = true;
  params.set("demo", "1");
  params.set("sala", "ensaio");
  params.set("modo", mode);
  history.replaceState(null, "", "jogar.html?" + params);
  showJoin();
};
function showJoin() {
  show("join");
  $("name").value = localStorage.getItem("jogos-nome") || "";
  $("join-note").textContent = demo
    ? "Demonstração neste navegador. Para jogar em lugares diferentes, crie uma sala no painel."
    : "Seu nome e suas contribuições ficam apenas nesta família.";
  $("name").focus();
}
$("join-form").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (!name) return;
  const b = e.submitter;
  b.disabled = true;
  try {
    unlock();
    localStorage.setItem("jogos-nome", name);
    await join(name, $("avatar").value);
  } catch (err) {
    toast(err.message);
  } finally {
    b.disabled = false;
  }
};
async function join(name, avatar) {
  let backend,
    config = { mode, difficulty: "familia", theme: "neutro" },
    invite = params.get("convite") || "demo";
  if (demo) {
    backend = new DemoBackend("torrecidade-demo-v1-" + mode);
    await backend.write("config", config);
  } else {
    const connection = await firebaseConnection(params.has("admin"));
    backend = new FirebaseBackend(
      connection,
      pathFor(params.get("familia") || "", params.get("sala") || "", mode),
    );
  }
  session = new Session(backend, { name, avatar, invite, config, demo });
  session.addEventListener("state", (e) => renderState(e.detail));
  session.addEventListener("players", (e) => renderPeople(e.detail));
  session.addEventListener("connection", (e) => {
    $("connection").textContent = e.detail
      ? demo
        ? "Demo neste navegador"
        : "Família conectada"
      : "Sem conexão";
    $("connection").classList.toggle("offline", !e.detail);
  });
  session.addEventListener("host", (e) => {
    if (e.detail)
      toast(
        e.detail.uid === session.uid
          ? "Você está cuidando da construção."
          : "Anfitrião conectado. Vamos continuar!",
      );
  });
  session.addEventListener("config", (e) => applyTheme(e.detail.theme));
  session.addEventListener("error", (e) => toast(e.detail.message));
  session.addEventListener("pings", (e) => {
    const entries = Object.entries(e.detail)
      .filter(([, p]) => session.b.now() - p.t < 3000)
      .sort((a, b) => b[1].t - a[1].t);
    if (entries[0]) {
      const [uid, p] = entries[0];
      $("world-ping").textContent =
        (session.players[uid]?.nome || "Alguém") +
        ": " +
        ({
          aqui: "📍 Aqui!",
          cuidado: "⚠ Cuidado!",
          espera: "✋ Espera!",
          boa: "💚 Boa!",
          gira: "Gira!",
          esquerda: "Mais à esquerda!",
          solta: "Solta!",
        }[p.type] || "");
      $("world-ping").classList.add("visible");
      clearTimeout(join.pingTimer);
      join.pingTimer = setTimeout(
        () => $("world-ping").classList.remove("visible"),
        3000,
      );
    }
  });
  await session.join();
  show("play");
  document.body.classList.add("playing");
  $("hud").hidden = false;
  $("tv-invite").hidden = !tv;
  $("reset").hidden =
    params.get("sala") !== "ensaio" || (!demo && !params.has("admin"));
  $("scene-title").textContent = "Vamos construir.";
  const link = shareLink();
  $("join-link").href = link;
  $("join-link").textContent = "Entrar pelo celular";
  if (tv)
    new QRCode($("qr"), {
      text: link,
      width: 140,
      height: 140,
      correctLevel: QRCode.CorrectLevel.M,
    });
  const loop = () => {
    if (!session) return;
    const bodies = session.interpolator.sample(session.b.now());
    if (render3d) scene?.setFrame(bodies);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function renderPeople(people) {
  $("people").replaceChildren();
  for (const [uid, p] of Object.entries(people)) {
    const el = document.createElement("div");
    el.className = "person";
    const icon = document.createElement("b");
    icon.textContent = p.nome.slice(0, 1).toUpperCase();
    icon.title = p.avatar;
    const text = document.createElement("span");
    text.textContent = p.nome + (uid === session.uid ? " · você" : "");
    const small = document.createElement("small");
    small.textContent =
      (state?.roles[uid] || []).map((r) => roleNames[r]).join(" + ") ||
      "Chegando";
    text.append(small);
    el.append(icon, text);
    $("people").append(el);
  }
}
function renderState(s) {
  const prev = state;
  state = s;
  scene?.setState(s);
  if (prev && s.blocks.length > prev.blocks.length) sound("encaixe");
  if (prev && prev.status !== "vitoria" && s.status === "vitoria")
    sound("vitoria");
  const tower = s.mode === "torre",
    goal = tower ? goalFor(s) : 4;
  $("height").textContent = tower
    ? s.height.toFixed(1) + " m"
    : (s.mode === "mundo" ? s.totalPieces : s.blocks.length) + " peças";
  $("goal-label").textContent = tower
    ? "ALTURA DA FAMÍLIA"
    : s.mode === "mundo"
      ? "NOSSA CIDADE"
      : "CONSTRUÍMOS JUNTOS";
  $("goal").textContent = tower
    ? "Meta: " + goal + " m"
    : s.mode === "mundo"
      ? "Cada visita deixa uma lembrança"
      : "Casa, rua, praça e árvore";
  $("progress").max = goal;
  $("progress").value = tower ? s.height : s.blocks.length;
  $("lives").textContent = s.mode === "mundo" ? "∞" : "♥ ".repeat(s.lives);
  const stable = stability(s);
  $("stability").value = stable;
  $("stability-label").textContent =
    stable > 65
      ? "Firme e forte"
      : stable > 35
        ? "Vamos com cuidado"
        : "Precisamos de uma escora";
  const myRoles = s.roles[session.uid] || ["guia"];
  const key = myRoles.join();
  if (key !== lastRoleKey) {
    lastRoleKey = key;
    if (!myRoles.includes(activeRole)) activeRole = myRoles[0];
    $("roles").replaceChildren();
    for (const role of myRoles)
      $("roles").append(
        button(
          roleNames[role],
          () => {
            activeRole = role;
            lastControlKey = "";
            renderControls();
          },
          role === activeRole ? "active" : "",
        ),
      );
    renderPeople(session.online || {});
  }
  $("status").textContent =
    s.status === "lobby"
      ? "Todo mundo pronto? O anfitrião pode começar."
      : s.status === "vitoria"
        ? "★".repeat(s.stars) + " Conseguimos! Essa conquista é de todos."
        : s.status === "derrota"
          ? "A construção caiu, mas ninguém perde sozinho. Vamos tentar de novo?"
          : s.pendingRoles
            ? "Terminamos esta peça e dividimos os novos papéis."
            : s.mode === "mundo"
              ? "Sua construção está sendo guardada para a próxima visita."
              : "Cada pessoa ajuda de um jeito. Conversem pelos marcadores.";
  renderControls();
  renderDistricts();
  const memories = $("memories");
  memories.replaceChildren();
  for (const [uid, c] of Object.entries(s.contributions)) {
    const p = document.createElement("p");
    p.textContent = `${session.players[uid]?.nome || "Alguém da família"}: ${c.pecas} peças, ${c.escoras} escoras. ${c.escoras ? "💚 Salvou a construção" : "🌱 Deixou sua marca"}`;
    memories.append(p);
  }
  for (const entry of s.timeline.slice(-4).reverse()) {
    const p = document.createElement("p");
    p.textContent = `${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(entry.t)} · ${session.players[entry.uid]?.nome || "A família"} construiu ${TYPES[entry.type]?.nome.toLowerCase() || "uma peça"}.`;
    memories.append(p);
  }
}
function renderControls() {
  if (!state) return;
  const s = state,
    role = activeRole || "guia";
  const key = JSON.stringify([
    role,
    s.status,
    s.queue,
    s.ghost,
    s.braces,
    s.resources,
    session.isHost,
  ]);
  if (key === lastControlKey) return;
  lastControlKey = key;
  $("role-title").textContent = roleNames[role];
  $("role-icon").textContent = roleIcons[role];
  [...$("roles").children].forEach((b) =>
    b.classList.toggle("active", b.textContent === roleNames[role]),
  );
  const box = $("controls");
  box.replaceChildren();
  if (Object.keys(s.roles).length > 1) {
    const swap = document.createElement("select");
    swap.setAttribute("aria-label", "Pedir troca de papel");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Trocar de papel…";
    swap.append(placeholder);
    for (const r of ROLES)
      if (!(s.roles[session.uid] || []).includes(r)) {
        const o = document.createElement("option");
        o.value = r;
        o.textContent = roleNames[r];
        swap.append(o);
      }
    swap.onchange = () => {
      if (swap.value) send("trocar", { role: swap.value });
    };
    box.append(swap);
  }

  if (s.status === "lobby") {
    box.append(
      button("Estou pronto", () =>
        session.b.write(`jogadores/${session.uid}`, {
          ...session.players[session.uid],
          ready: true,
        }),
      ),
    );
    if (session.isHost)
      box.append(button("Começar juntos", () => send("iniciar"), "primary"));
    return;
  }
  if (s.status === "vitoria") {
    if (session.isHost)
      box.append(button("Próximo desafio →", () => send("proxima"), "primary"));
    return;
  }
  if (s.status === "derrota") {
    box.append(
      button("Chamar a família para tentar de novo", share, "primary"),
    );
    return;
  }
  const queue = document.createElement("div");
  queue.className = "queue";
  for (let i = 0; i < 3; i++) {
    const type = s.queue[i];
    const b = button(
      "",
      () => send("escolher", { choice: i }),
      "piece" + (i === s.ghost.choice ? " selected" : ""),
    );
    const icon = document.createElement("span");
    icon.style.background = TYPES[type].color;
    b.append(icon, document.createTextNode(TYPES[type].nome));
    b.setAttribute("aria-label", "Escolher " + TYPES[type].nome);
    b.disabled = !s.roles[session.uid]?.includes("arquiteto");
    queue.append(b);
  }
  box.append(queue);
  if (role === "arquiteto") {
    $("help").textContent =
      "Escolha a próxima peça e gire. O construtor cuida de encontrar o lugar.";
    box.append(button("↻ Girar a peça", () => send("girar"), "primary"));
    if (s.mode !== "torre") {
      const row = document.createElement("div");
      row.className = "role-tabs";
      for (const type of ["casa", "rua", "praca", "arvore"])
        row.append(button(TYPES[type].nome, () => send("catalogo", { type })));
      box.append(row);
    }
  } else if (role === "construtor") {
    $("help").textContent =
      s.mode === "torre"
        ? "Toque no chão ou use as setas. Centralize a sombra e solte com carinho."
        : "Use as setas: árvore no centro; rua nos eixos; praça à esquerda e atrás; casas nos outros cantos.";
    const pad = document.createElement("div");
    pad.className = "dpad";
    const step = s.mode === "torre" ? 0.5 : 2;
    for (const [text, dx, dz] of [
      ["↖", -step, -step],
      ["↑", 0, -step],
      ["↗", step, -step],
      ["←", -step, 0],
      ["◎", 0, 0],
      ["→", step, 0],
      ["↙", -step, step],
      ["↓", 0, step],
      ["↘", step, step],
    ])
      pad.append(
        button(text, () =>
          send("mover", {
            x: dx === 0 && dz === 0 ? 0 : s.ghost.x + dx,
            z: dx === 0 && dz === 0 ? 0 : s.ghost.z + dz,
          }),
        ),
      );
    box.append(pad);
    const hint = document.createElement("p");
    hint.className = "fine";
    hint.textContent =
      `Posição ${s.ghost.x}, ${s.ghost.z}` +
      (s.mode !== "torre"
        ? ` · Zona: ${TYPES[zone(Math.round(s.ghost.x / 2) * 2, Math.round(s.ghost.z / 2) * 2)].nome}`
        : "");
    box.append(
      hint,
      button("↓ Soltar peça", () => send("soltar"), "primary"),
    );
  } else if (role === "engenheiro") {
    $("help").textContent =
      `Você cuida do equilíbrio. Restam ${s.braces} apoios. Uma escora fixa a última peça; segurar dá 3 segundos para respirar.`;
    box.append(
      button("╱ Aplicar escora", () => send("escora"), "primary"),
      button("✋ Segurar por 3 segundos", () => send("segurar")),
    );
  } else if (role === "intendente") {
    $("help").textContent =
      "Mantenha a oficina abastecida para ninguém parar de construir.";
    const p = document.createElement("div");
    p.className = "resource-row";
    p.textContent = `🪵 ${s.resources[0]}   🪨 ${s.resources[1]}   ⚡ ${s.resources[2]}`;
    box.append(
      p,
      button("Abastecer a oficina", () => send("repor"), "primary"),
    );
  } else {
    $("help").textContent =
      "Você enxerga o todo. Marque o melhor lugar e ajude a família a se entender.";
    box.append(button("📍 Marcar aqui", () => session.ping("aqui"), "primary"));
  }
}
function shareLink() {
  const u = new URL("jogar.html", location.href);
  for (const k of ["familia", "sala", "convite", "modo", "demo"])
    if (params.has(k)) u.searchParams.set(k, params.get(k));
  return u.href;
}
async function share() {
  const url = shareLink(),
    text = "Uma peça sua faz toda a diferença. Vem construir com a família!";
  if (navigator.share) {
    try {
      await navigator.share({ title: "Torre / Cidade Juntos", text, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  window.open(
    "https://wa.me/?text=" + encodeURIComponent(text + " " + url),
    "_blank",
    "noopener",
  );
}
$("invite").onclick = share;
document
  .querySelectorAll("[data-ping]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        session?.ping(b.dataset.ping).catch((e) => toast(e.message))),
  );
$("leave").onclick = async () => {
  await session.leave();
  location.href = "index.html";
};
$("reset").onclick = async () => {
  if (params.get("sala") !== "ensaio") return;
  await session.leave();
  if (demo) localStorage.removeItem("torrecidade-demo-v1-" + mode);
  else {
    const connection = await firebaseConnection(true);
    const backend = new FirebaseBackend(
      connection,
      pathFor(params.get("familia"), "ensaio", mode),
    );
    if (mode === "mundo") {
      toast("O mundo persistente não é apagado pelo reset de ensaio.");
      return;
    }
    await backend.write("", null);
  }
  location.href = "index.html";
};
$("create").onclick = async () => {
  try {
    const connection = await firebaseConnection(true);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const room = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (b) => chars[b % chars.length],
    ).join("");
    const created = await createRoom(connection, {
      room,
      mode: $("admin-mode").value,
      difficulty: $("difficulty").value,
      theme,
    });
    const u = new URL(tv ? "tv.html" : "jogar.html", location.href);
    for (const [k, v] of Object.entries({
      familia: created.family,
      sala: created.room,
      modo: created.mode,
      convite: created.invite,
      admin: "1",
    }))
      u.searchParams.set(k, v);
    location.href = u.href;
  } catch (e) {
    toast(e.message);
  }
};
if (params.has("criar")) show("admin");
else if (params.has("sala") || demo) showJoin();
else show("welcome");
if (params.get("tema") === "natal" && demo) applyTheme("natal");

function renderDistricts() {
  let panel = document.getElementById("districts");
  if (state.mode !== "mundo") {
    panel?.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "districts";
    panel.className = "districts";
    $("play").insertBefore(panel, $("roles"));
  }
  panel.replaceChildren();
  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = `NOSSA CIDADE · ${state.unlocked} BAIRRO${state.unlocked > 1 ? "S" : ""}`;
  panel.append(label);
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Visitar bairro");
  const names = [
    "Praça dos encontros",
    "Vila das janelas",
    "Jardim dos abraços",
    "Bairro das pontes",
  ];
  for (let i = 0; i < state.unlocked; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent =
      (names[i] || "Bairro " + (i + 1)) +
      ` · ${state.districtCounts[i] || 0} peças`;
    option.selected = i === state.district;
    select.append(option);
  }
  select.onchange = () => send("bairro", { district: Number(select.value) });
  panel.append(select);
  const hint = document.createElement("p");
  hint.className = "fine";
  hint.textContent = `Mais ${12 - (state.totalPieces % 12)} peças abrem um novo bairro para toda a família.`;
  panel.append(hint);
}
