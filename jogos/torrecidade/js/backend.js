/** Firebase modular transport. Only this boundary knows paths and the SDK. */
import * as F from "../vendor/firebase.js";
export function pathFor(family, room, mode) {
  if (
    !/^[\w-]{1,128}$/.test(family) ||
    !(/^[A-HJ-NP-Z2-9]{4,6}$/.test(room) || room === "ensaio")
  )
    throw Error("Link de convite inválido.");
  return `familias/${family}/jogos/torrecidade/${mode === "mundo" ? "mundo" : `salas/${room}`}`;
}
export async function firebaseConnection(admin = false) {
  const config = window.JOGOS_FIREBASE;
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!config || (!local && config.apiKey.startsWith("demo-")))
    throw Error(
      "O multiplayer ainda precisa da configuração da família. Você já pode experimentar a demonstração.",
    );
  const name = admin ? "[DEFAULT]" : "convidado";
  const app =
    F.getApps().find((a) => a.name === name) || F.initializeApp(config, name);
  const auth =
      app._tcAuth ||
      F.initializeAuth(app, {
        persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence],
      }),
    db = F.getDatabase(app);
  app._tcAuth = auth;
  if (local && config.emuladorAutomatico !== false && !app._tcEmulator) {
    app._tcEmulator = true;
    F.connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    F.connectDatabaseEmulator(db, "127.0.0.1", 9000);
  }
  await auth.authStateReady();
  if (!admin && !auth.currentUser) await F.signInAnonymously(auth);
  if (admin && (!auth.currentUser || auth.currentUser.isAnonymous))
    throw Error("Entre no painel da família para criar uma sala.");
  return { auth, db, uid: auth.currentUser.uid };
}
export class FirebaseBackend {
  constructor(connection, path) {
    Object.assign(this, connection);
    this.path = path;
    this.offset = 0;
    this.connected = false;
    this.bytes = 0;
    this.start = Date.now();
    this.stops = [];
  }
  now() {
    return Date.now() + this.offset;
  }
  ref(path = "") {
    return F.ref(this.db, this.path + (path ? "/" + path : ""));
  }
  async read(path) {
    return (await F.get(this.ref(path))).val();
  }
  async write(path, value) {
    this.bytes += JSON.stringify(value).length;
    return F.set(this.ref(path), value);
  }
  async patch(value) {
    this.bytes += JSON.stringify(value).length;
    return F.update(this.ref(), value);
  }
  async transaction(path, fn) {
    return F.runTransaction(this.ref(path), fn, { applyLocally: false });
  }
  watch(path, fn, error = () => {}) {
    const stop = F.onValue(
      this.ref(path),
      (snap) => {
        const val = snap.val();
        this.bytes += JSON.stringify(val).length;
        fn(val);
      },
      error,
    );
    this.stops.push(stop);
    return stop;
  }
  connection(fn) {
    this.stops.push(
      F.onValue(F.ref(this.db, ".info/serverTimeOffset"), (s) => {
        this.offset = s.val() || 0;
      }),
    );
    this.stops.push(
      F.onValue(F.ref(this.db, ".info/connected"), (s) => {
        this.connected = !!s.val();
        fn(this.connected);
      }),
    );
  }
  async presence(uid, instance) {
    const r = this.ref(`online/${uid}/${instance}`);
    await F.onDisconnect(r).remove();
    await F.set(r, true);
  }
  async recordGame(state, epoch) {
    if (!this.path.includes("/salas/")) return;
    const [game, room] = this.path.split("/salas/");
    const id = `${state.id}_${state.phase}`;
    await F.runTransaction(
      F.ref(this.db, game + "/recordes/" + id),
      (old) =>
        old
          ? undefined
          : {
              sala: room,
              epoch,
              height: state.height,
              stars: state.stars,
              time: state.elapsed,
            },
      { applyLocally: false },
    );
  }
  async leave(uid, instance) {
    await F.set(this.ref(`online/${uid}/${instance}`), null);
  }
  close() {
    this.stops.forEach((stop) => stop());
  }
}
export class DemoBackend {
  constructor(key = "torrecidade-demo") {
    this.key = key;
    this.uid = sessionStorage.getItem("tc-demo-uid") || crypto.randomUUID();
    sessionStorage.setItem("tc-demo-uid", this.uid);
    this.listeners = [];
    this.bytes = 0;
    this.connected = true;
    this.channel = new BroadcastChannel(key);
    this.channel.onmessage = () => this.emit();
  }
  now() {
    return Date.now();
  }
  all() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || "{}");
    } catch {
      return {};
    }
  }
  refGet(data, path) {
    return (
      path
        .split("/")
        .filter(Boolean)
        .reduce((a, k) => a?.[k], data) ?? null
    );
  }
  assign(data, path, value) {
    const keys = path.split("/").filter(Boolean);
    let p = data;
    for (const k of keys.slice(0, -1)) p = p[k] ??= {};
    if (value === null) delete p[keys.at(-1)];
    else p[keys.at(-1)] = value;
  }
  async read(path) {
    return this.refGet(this.all(), path);
  }
  async lock(fn) {
    if (navigator.locks) return navigator.locks.request(this.key, fn);
    return fn();
  }
  async patch(values) {
    return this.lock(() => {
      const data = this.all();
      for (const [p, v] of Object.entries(values)) this.assign(data, p, v);
      localStorage.setItem(this.key, JSON.stringify(data));
      this.emit();
      this.channel.postMessage(1);
    });
  }
  write(p, v) {
    return this.patch({ [p]: v });
  }
  transaction(p, fn) {
    return this.lock(() => {
      const all = this.all();
      const next = fn(this.refGet(all, p));
      if (next === undefined) return { committed: false };
      this.assign(all, p, next);
      localStorage.setItem(this.key, JSON.stringify(all));
      this.emit();
      this.channel.postMessage(1);
      return { committed: true, snapshot: { val: () => next } };
    });
  }
  watch(p, fn) {
    const l = { p, fn, last: null };
    this.listeners.push(l);
    fn(this.refGet(this.all(), p));
    return () => {
      this.listeners = this.listeners.filter((x) => x !== l);
    };
  }
  emit() {
    const all = this.all();
    for (const l of this.listeners) {
      const v = this.refGet(all, l.p),
        json = JSON.stringify(v);
      if (json !== l.last) {
        l.last = json;
        l.fn(v);
      }
    }
  }
  connection(fn) {
    fn(true);
  }
  presence(uid, instance) {
    return this.write(`online/${uid}/${instance}`, true);
  }
  leave(uid, instance) {
    return this.write(`online/${uid}/${instance}`, null);
  }
  close() {
    this.listeners = [];
    this.channel.close();
  }
}
export async function createRoom(
  connection,
  { room, mode = "torre", difficulty = "familia", theme = "neutro" },
) {
  const family = connection.uid,
    path = pathFor(family, room, mode),
    b = new FirebaseBackend(connection, path);
  // No broad administrator write permission is required at the family or game root.
  await F.runTransaction(
    F.ref(connection.db, `familias/${family}/adminUid`),
    (v) => (v ? undefined : family),
  );
  const existing = await b.read("config");
  if (existing) return { family, room, mode, invite: existing.invite };
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const invite = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
    "",
  );
  await b.write("config", {
    mode,
    difficulty,
    theme,
    invite,
    created: Date.now(),
    closed: false,
  });
  return { family, room, mode, invite };
}
