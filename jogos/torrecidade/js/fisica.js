import * as C from "../vendor/cannon-es.js";
import { TYPES, DIFFICULTIES } from "./regras.js";
export class Physics {
  constructor(state) {
    this.world = new C.World({
      gravity: new C.Vec3(0, -9.82, 0),
      allowSleep: true,
    });
    this.world.solver.iterations = 12;
    this.world.broadphase = new C.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction =
      DIFFICULTIES[state.difficulty].friction;
    this.world.defaultContactMaterial.restitution = 0.015;
    this.bodies = new Map();
    this.tick = 0;
    this.state = state;
    const floor = new C.Body({
      mass: 0,
      shape: new C.Box(new C.Vec3(6, 0.2, 6)),
      position: new C.Vec3(0, -0.2, 0),
    });
    this.world.addBody(floor);
    this.sync(state);
  }
  sync(state) {
    this.state = state;
    const ids = new Set(state.blocks.map((b) => b.id));
    for (const [id, b] of this.bodies)
      if (!ids.has(id)) {
        this.world.removeBody(b);
        this.bodies.delete(id);
      }
    for (const b of state.blocks) {
      let body = this.bodies.get(b.id);
      if (!body) {
        const size = TYPES[b.type].size;
        body = new C.Body({
          mass: state.mode === "torre" && !b.braced ? 1 : 0,
          shape: new C.Box(new C.Vec3(...size.map((v) => v / 2))),
          position: new C.Vec3(...b.p),
          quaternion: new C.Quaternion(...b.q),
          velocity: new C.Vec3(...b.v),
          angularVelocity: new C.Vec3(...(b.w || [0, 0, 0])),
          linearDamping: 0.15,
          angularDamping: 0.3,
          allowSleep: true,
          sleepSpeedLimit: 0.12,
          sleepTimeLimit: 0.5,
        });
        this.world.addBody(body);
        this.bodies.set(b.id, body);
        if (b.sleep) body.sleep();
      }
      if (b.braced && body.mass !== 0) {
        body.mass = 0;
        body.type = C.Body.STATIC;
        body.updateMassProperties();
        body.velocity.setZero();
        body.angularVelocity.setZero();
      }
    }
  }
  step(now) {
    this.tick++;
    if (now < this.state.holdUntil) return;
    const wind =
      this.state.phase > 1
        ? Math.sin(this.tick / 70 + this.state.seed) *
          0.1 *
          (this.state.phase - 1)
        : 0;
    for (const b of this.bodies.values())
      if (b.mass && b.sleepState !== C.Body.SLEEPING)
        b.applyForce(new C.Vec3(wind, 0, 0));
    this.world.step(1 / 60);
  }
  snapshot() {
    return [...this.bodies].map(([id, b]) => ({
      id,
      p: b.position.toArray(),
      q: b.quaternion.toArray(),
      v: b.velocity.toArray(),
      w: b.angularVelocity.toArray(),
      sleep: b.sleepState === C.Body.SLEEPING || b.mass === 0,
    }));
  }
}
