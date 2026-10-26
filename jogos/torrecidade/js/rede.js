import {
  makeState,
  reduceInput,
  rebalance,
  elegerHost,
  applyPhysics,
  packBody,
  Interpolator,
  chunkId,
  compactChunk,
  expandChunk,
  hash,
} from "./regras.js";
/** One physics owner, fenced by epoch; durable state + ACK are one transaction. */
export class Session extends EventTarget {
  constructor(backend, { name, avatar = "🦊", invite, config, demo = false }) {
    super();
    this.b = backend;
    this.uid = backend.uid;
    this.instance = crypto.randomUUID();
    this.name = name;
    this.avatar = avatar;
    this.invite = invite;
    this.config = config;
    this.demo = demo;
    this.host = null;
    this.beat = 0;
    this.players = {};
    this.connections = {};
    this.state = null;
    this.inputs = {};
    this.worker = null;
    this.busy = false;
    this.seq = 0;
    this.connected = false;
    this.interpolator = new Interpolator();
    this.chunkHashes = {};
    this.timers = [];
    this.pending = [];
    this.lastSent = 0;
  }
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
  get isHost() {
    return (
      this.connected &&
      !this.config.closed &&
      this.host?.uid === this.uid &&
      this.host.instance === this.instance
    );
  }
  async join() {
    const old = await this.b.read(`jogadores/${this.uid}`);
    await this.b.write(`jogadores/${this.uid}`, {
      nome: this.name.slice(0, 30),
      avatar: this.avatar,
      convite: this.invite,
      entrouEm: old?.entrouEm || this.b.now(),
      ready: false,
    });
    this.b.connection(async (connected) => {
      this.connected = connected;
      this.emit("connection", connected);
      if (connected) {
        try {
          await this.b.presence(this.uid, this.instance);
          await this.elect();
        } catch (e) {
          this.error(e);
        }
      } else this.stopPhysics();
    });
    this.b.watch("config", (v) => {
      if (v) {
        this.config = v;
        if (v.closed) this.stopPhysics();
        this.emit("config", v);
      }
    });
    this.b.watch("jogadores", (v) => {
      this.players = v || {};
      this.updatePlayers();
    });
    this.b.watch("online", (v) => {
      this.connections = v || {};
      this.updatePlayers();
      this.elect().catch((e) => this.error(e));
    });
    this.b.watch("host", (v) => {
      const changed =
        v?.epoch !== this.host?.epoch || v?.instance !== this.host?.instance;
      this.host = v;
      if (changed) {
        this.stopPhysics();
        this.emit("host", v);
        if (this.isHost) this.takeover().catch((e) => this.error(e));
      }
    });
    this.b.watch("hostBeat", (v) => {
      this.beat = v?.t || 0;
    });
    this.b.watch(
      "estado/snapshot",
      (v) => {
        if (!v || v.epoch < (this.host?.epoch || 0)) return;
        const state = JSON.parse(v.payload);
        if (
          this.state &&
          state.revision < this.state.revision &&
          state.id === this.state.id
        )
          return;
        this.state = state;
        this.seq = Math.max(this.seq, state.ack[this.uid] || 0);
        this.emit("state", state);
        this.worker?.postMessage({ type: "sync", state });
        if (this.isHost && !this.worker) this.startPhysics();
      },
      (e) => this.error(e),
    );
    this.b.watch("estado/frame", (v) => {
      if (v && v.epoch === (this.host?.epoch || 0)) {
        this.interpolator.push({ ...v, bodies: JSON.parse(v.payload) });
        this.emit("frame", v);
      }
    });
    this.b.watch("inputs", (v) => {
      this.inputs = v || {};
      this.seq = Math.max(this.seq, this.inputs[this.uid]?.seq || 0);
      if (this.isHost) this.consume().catch((e) => this.error(e));
    });
    this.b.watch("pings", (v) => this.emit("pings", v || {}));
    this.timers.push(
      setInterval(() => this.heartbeat().catch((e) => this.error(e)), 750),
    );
    this.timers.push(
      setInterval(() => {
        if (this.isHost) this.checkpoint().catch((e) => this.error(e));
      }, 2000),
    );
    this.timers.push(
      setInterval(() => this.elect().catch((e) => this.error(e)), 250),
    );
    this.onHide = () => {
      if (document.hidden && this.isHost) this.checkpoint().catch(() => {});
    };
    this.onPageHide = () => {
      this.b.leave(this.uid, this.instance).catch(() => {});
    };
    document.addEventListener("visibilitychange", this.onHide);
    window.addEventListener("pagehide", this.onPageHide);
    await this.elect();
  }
  updatePlayers() {
    const online = {};
    for (const [uid, p] of Object.entries(this.players))
      if (Object.keys(this.connections[uid] || {}).length)
        online[uid] = { ...p, online: true };
    this.online = online;
    this.emit("players", online);
    if (this.isHost && this.state) {
      const next = rebalance(this.state, online);
      if (
        JSON.stringify([next.roles, next.pendingRoles]) !==
        JSON.stringify([this.state.roles, this.state.pendingRoles])
      )
        this.commit((s) => rebalance(s, this.online)).catch((e) =>
          this.error(e),
        );
    }
  }
  async elect() {
    if (
      this.config.closed ||
      !this.connected ||
      this.electing ||
      !this.online?.[this.uid]
    )
      return;
    if (
      this.host &&
      Object.keys(this.connections[this.host.uid] || {}).includes(
        this.host.instance,
      ) &&
      this.b.now() - this.beat <= 2800
    )
      return;
    this.electing = true;
    try {
      const now = this.b.now();
      await this.b.transaction("host", (current) => {
        const alive =
          current && this.connections[current.uid]?.[current.instance];
        const online = { ...this.online };
        // A connected but frozen former host must not block the remaining eligible clients.
        if (current && !alive) delete online[current.uid];
        if (current && now - this.beat > 2800 && current.uid !== this.uid)
          delete online[current.uid];
        return (
          elegerHost(
            current,
            this.uid,
            online,
            now,
            alive ? this.beat : 0,
            this.instance,
          ) || undefined
        );
      });
    } finally {
      this.electing = false;
    }
  }
  async heartbeat() {
    if (this.isHost)
      await this.b.write("hostBeat", {
        epoch: this.host.epoch,
        t: this.b.now(),
      });
  }
  async takeover() {
    await this.heartbeat();
    const snap = await this.b.read("estado/snapshot");
    this.state = snap
      ? JSON.parse(snap.payload)
      : makeState({
          mode: this.config.mode,
          difficulty: this.config.difficulty,
          seed: 1,
          now: this.b.now(),
          id: crypto.randomUUID(),
        });
    await this.commit((s) => rebalance(s, this.online || {}));
    this.startPhysics();
    await this.consume();
  }
  startPhysics() {
    if (this.worker || !this.isHost || !this.state) return;
    this.worker = new Worker(new URL("./fisica.worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.postMessage({ type: "init", state: this.state });
    this.worker.onerror = (e) => this.error(Error(e.message));
    this.worker.onmessage = ({ data }) => {
      if (!this.isHost) return;
      this.physicsBodies = data.bodies;
      const bodies = data.bodies.filter((b) => !b.sleep).map(packBody);
      if (bodies.length || this.hadActive) {
        this.hadActive = bodies.length > 0;
        this.b
          .write("estado/frame", {
            epoch: this.host.epoch,
            t: this.b.now(),
            payload: JSON.stringify(
              bodies.length ? bodies : data.bodies.map(packBody),
            ),
          })
          .catch((e) => this.error(e));
      }
    };
  }
  stopPhysics() {
    this.worker?.terminate();
    this.worker = null;
    this.physicsBodies = null;
  }
  async commit(fn) {
    if (!this.isHost) return;
    const epoch = this.host.epoch;
    const result = await this.b.transaction("estado/snapshot", (old) => {
      if (!this.isHost || this.host.epoch !== epoch) return;
      const current = old ? JSON.parse(old.payload) : this.state;
      if (!current) return;
      const next = fn(current);
      if (!next) return;
      next.revision = Math.max(next.revision, current.revision + 1);
      return { epoch, t: this.b.now(), payload: JSON.stringify(next) };
    });
    if (result.committed) {
      this.state = JSON.parse(result.snapshot.val().payload);
      this.emit("state", this.state);
      this.worker?.postMessage({ type: "sync", state: this.state });
    }
  }
  async consume() {
    if (this.busy || !this.isHost || !this.state) return;
    this.busy = true;
    try {
      const batch = Object.entries(this.inputs).filter(
        ([uid, i]) => i.seq > (this.state.ack[uid] || 0) && this.online[uid],
      );
      if (!batch.length) return;
      const travel = batch.find(([uid, i]) => i.type === "bairro");
      if (travel && this.state.mode === "mundo") {
        const [uid, i] = travel;
        const requested = JSON.parse(i.data).district;
        if (
          Number.isInteger(requested) &&
          requested >= 0 &&
          requested < this.state.unlocked &&
          !this.state.ghost.owner
        ) {
          await this.persistWorld();
          const saved = await this.b.read(`chunks/b${requested}`);
          const loaded = saved ? expandChunk(JSON.parse(saved.payload)) : [];
          await this.commit((s) => ({
            ...s,
            district: requested,
            blocks: loaded,
            archive: {
              id: "b" + s.district,
              payload: JSON.stringify(compactChunk(s.blocks)),
            },
            ghost: { x: 0, z: 0, rotation: 0, choice: 0, owner: "" },
            ack: { ...s.ack, [uid]: i.seq },
          }));
          this.stopPhysics();
          this.startPhysics();
        } else
          await this.commit((s) => ({ ...s, ack: { ...s.ack, [uid]: i.seq } }));
      }
      await this.commit((s) => {
        for (const [uid, i] of batch) {
          if (
            ["iniciar", "proxima"].includes(i.type) &&
            uid !== this.host.uid
          ) {
            s.ack[uid] = i.seq;
            continue;
          }
          let data;
          try {
            data = JSON.parse(i.data);
          } catch {
            continue;
          }
          s = reduceInput(s, { ...i, data }, uid, this.b.now());
        }
        return s;
      });
      await this.persistWorld();
    } finally {
      this.busy = false;
    }
    if (
      Object.entries(this.inputs).some(
        ([uid, i]) => i.seq > (this.state.ack[uid] || 0) && this.online[uid],
      )
    )
      queueMicrotask(() => this.consume().catch((e) => this.error(e)));
  }
  async checkpoint() {
    if (!this.isHost || !this.state || this.busy) return;
    const bodies = this.physicsBodies;
    if (bodies) await this.commit((s) => applyPhysics(s, bodies, this.b.now()));
    await this.persistWorld();
  }
  async persistWorld() {
    if (!this.isHost || !this.state) return;
    const s = this.state,
      epoch = this.host.epoch;
    if (s.status === "vitoria")
      await this.b.transaction("placar", (old) => {
        const scores = old?.scores || {};
        const id = `${s.id}_${s.phase}`;
        if (scores[id]) return;
        return {
          epoch,
          scores: {
            ...scores,
            [id]: { height: s.height, stars: s.stars, time: s.elapsed },
          },
        };
      });
    if (s.status === "vitoria" && this.b.recordGame)
      await this.b.recordGame(s, epoch);
    if (s.mode !== "mundo") return;
    const groups = { ["b" + s.district]: s.blocks };
    const updates = {
      checkpoint: {
        epoch,
        versao: 1,
        salvoEm: this.b.now(),
        revision: s.revision,
      },
      contribuicoes: { epoch, payload: JSON.stringify(s.contributions) },
      linhaDoTempo: { epoch, payload: JSON.stringify(s.timeline) },
    };
    for (const [id, blocks] of Object.entries(groups)) {
      const payload = JSON.stringify(compactChunk(blocks)),
        h = hash(payload);
      if (this.chunkHashes[id] !== h) {
        updates[`chunks/${id}`] = { epoch, payload };
        this.chunkHashes[id] = h;
      }
    }
    if (s.archive && s.archive.id !== "b" + s.district)
      updates["chunks/" + s.archive.id] = { epoch, payload: s.archive.payload };
    await this.b.patch(updates);
  }
  send(type, data = {}) {
    if (!this.connected)
      return Promise.reject(
        Error("Sem conexão. Sua peça continua guardada; espere reconectar."),
      );
    const task = async () => {
      const wait = Math.max(0, 80 - (Date.now() - this.lastSent));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const seq = ++this.seq;
      this.lastSent = Date.now();
      await this.b.write(`inputs/${this.uid}`, {
        seq,
        type,
        data: JSON.stringify(data),
        t: this.b.now(),
      });
      const start = Date.now();
      while ((this.state?.ack[this.uid] || 0) < seq) {
        if (Date.now() - start > 6000)
          throw Error(
            "Aguardando o anfitrião. Tente novamente quando a conexão voltar.",
          );
        await new Promise((r) => setTimeout(r, 30));
      }
    };
    const result = (this.sendChain || Promise.resolve()).then(task);
    this.sendChain = result.catch(() => {});
    return result;
  }
  async ping(type = "aqui") {
    const now = this.b.now();
    if (now - (this.lastPing || 0) < 1000) return;
    this.lastPing = now;
    await this.b.write(`pings/${this.uid}`, {
      type,
      x: this.state?.ghost.x || 0,
      z: this.state?.ghost.z || 0,
      t: now,
    });
  }
  error(e) {
    this.emit("error", e);
  }
  async leave() {
    this.timers.forEach(clearInterval);
    document.removeEventListener("visibilitychange", this.onHide);
    window.removeEventListener("pagehide", this.onPageHide);
    if (this.isHost) await this.checkpoint();
    this.stopPhysics();
    await this.b.leave(this.uid, this.instance);
    this.b.close();
  }
}
