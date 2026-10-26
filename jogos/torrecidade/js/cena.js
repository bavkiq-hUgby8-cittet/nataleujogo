import * as T from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.js";
import { TYPES, goalFor } from "./regras.js";
import { Quality } from "./qualidade.js";
const colors = ["#e7b376", "#de8f72", "#89aea4", "#e6c875"];
export class Scene {
  constructor(canvas, { tv = false, onMove = () => {} } = {}) {
    this.canvas = canvas;
    this.onMove = onMove;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.objects = new Map();
    this.bursts = [];
    const gl =
      canvas.getContext("webgl2", { alpha: true, antialias: false }) ||
      canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) throw Error("Seu aparelho pode usar os controles 2D.");
    this.renderer = new T.WebGLRenderer({
      canvas,
      context: gl,
      alpha: true,
      antialias: false,
      powerPreference: tv ? "high-performance" : "default",
    });
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog("#e9eddf", 40, 85);
    this.camera = new T.PerspectiveCamera(36, 1, 0.1, 150);
    this.camera.position.set(17, 15, 21);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.reduced;
    this.controls.enablePan = false;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 38;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 1.4, 0);
    this.scene.add(new T.HemisphereLight("#fff1d4", "#7e9b88", 2.3));
    this.sun = new T.DirectionalLight("#ffe6bf", 3);
    this.sun.position.set(-8, 18, 12);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
      far: 60,
    });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.025;
    this.scene.add(this.sun);
    this.quality = new Quality(this.renderer, this.sun, tv);
    this.geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.065);
    this.mats = new Map();
    this.tmp = new T.Object3D();
    this.buildEnvironment();
    this.buildInstances();
    this.ghost = new T.Mesh(
      this.geo,
      new T.MeshStandardMaterial({
        color: "#f5c86c",
        transparent: true,
        opacity: 0.45,
        roughness: 0.8,
        depthWrite: false,
      }),
    );
    this.scene.add(this.ghost);
    this.target = new T.Mesh(
      new T.RingGeometry(0.85, 0.94, 48),
      new T.MeshBasicMaterial({
        color: "#315e4b",
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.target.rotation.x = -Math.PI / 2;
    this.target.position.y = 0.025;
    this.scene.add(this.target);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();
    this.pointer();
    const animate = (now) => {
      this.raf = requestAnimationFrame(animate);
      if (document.hidden) return;
      this.controls.update();
      this.updateAnimations(now);
      this.renderer.render(this.scene, this.camera);
      this.quality.frame(now);
    };
    this.raf = requestAnimationFrame(animate);
  }
  mat(color) {
    if (!this.mats.has(color))
      this.mats.set(
        color,
        new T.MeshStandardMaterial({ color, roughness: 0.83, metalness: 0 }),
      );
    return this.mats.get(color);
  }
  mesh(geo, color, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new T.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  buildEnvironment() {
    this.base = this.mesh(this.geo, "#decdb2", 0, -0.58, 0, 13, 1.1, 13);
    this.grass = this.mesh(this.geo, "#bac69b", 0, -0.03, 0, 12.7, 0.16, 12.7);
    this.mesh(
      new T.PlaneGeometry(150, 150),
      "#e2e6d6",
      0,
      -1.18,
      0,
    ).rotation.x = -Math.PI / 2;
    const tex = document.createElement("canvas");
    tex.width = tex.height = 256;
    const ctx = tex.getContext("2d"),
      grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
    grad.addColorStop(0, "rgba(37,53,43,.28)");
    grad.addColorStop(1, "rgba(37,53,43,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(22, 22),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(tex),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -1.16, 0);
    this.scene.add(shadow);
    this.grid = new T.GridHelper(12, 6, "#80977d", "#a3b78f");
    this.grid.position.y = 0.065;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.45;
    this.scene.add(this.grid);
    const treePositions = [
      [-5, 5],
      [-5, -5],
      [5, -5],
      [5, 4],
      [-7, 1],
      [7, 0],
      [2, -7],
      [-2, 7],
    ];
    const trunks = new T.InstancedMesh(
      new T.CylinderGeometry(0.13, 0.18, 1, 6),
      this.mat("#a58666"),
      treePositions.length,
    );
    const tops = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.85, 1),
      this.mat("#6b9680"),
      treePositions.length * 2,
    );
    let i = 0;
    for (const [x, z] of treePositions) {
      this.tmp.position.set(x, 0.48, z);
      this.tmp.scale.set(1, 1, 1);
      this.tmp.updateMatrix();
      trunks.setMatrixAt(i, this.tmp.matrix);
      this.tmp.position.y = 1.45;
      this.tmp.scale.set(0.85, 1.15, 0.85);
      this.tmp.updateMatrix();
      tops.setMatrixAt(i * 2, this.tmp.matrix);
      this.tmp.position.set(x + 0.22, 1.8, z + 0.12);
      this.tmp.scale.set(0.65, 0.9, 0.65);
      this.tmp.updateMatrix();
      tops.setMatrixAt(i * 2 + 1, this.tmp.matrix);
      i++;
    }
    trunks.castShadow = tops.castShadow = true;
    this.scene.add(trunks, tops);
    this.environmentTops = tops;
    const stones = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.35, 0),
      this.mat("#d5cfbc"),
      14,
    );
    for (let j = 0; j < 14; j++) {
      const angle = j * 2.399;
      this.tmp.position.set(Math.cos(angle) * 7.4, -0.7, Math.sin(angle) * 7.4);
      this.tmp.scale.set(1.1, 0.7, 1);
      this.tmp.updateMatrix();
      stones.setMatrixAt(j, this.tmp.matrix);
    }
    this.scene.add(stones);
    this.clouds = new T.InstancedMesh(
      new T.SphereGeometry(1, 8, 6),
      new T.MeshStandardMaterial({ color: "#fff9e8", roughness: 1 }),
      12,
    );
    for (let j = 0; j < 12; j++) {
      this.tmp.position.set(
        -16 + (j % 4) * 2,
        9 + Math.floor(j / 4) * 2,
        -12 - Math.floor(j / 4) * 4,
      );
      this.tmp.scale.set(2, 0.7, 1.1);
      this.tmp.updateMatrix();
      this.clouds.setMatrixAt(j, this.tmp.matrix);
    }
    this.scene.add(this.clouds);
  }
  buildInstances() {
    this.instances = {};
    for (const [type, info] of Object.entries(TYPES)) {
      const mesh = new T.InstancedMesh(this.geo, this.mat(info.color), 2048);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.instances[type] = mesh;
    }
    this.roofs = new T.InstancedMesh(
      new T.ConeGeometry(1.12, 0.85, 4),
      this.mat("#b96950"),
      2048,
    );
    this.roofs.count = 0;
    this.roofs.castShadow = true;
    this.roofs.frustumCulled = false;
    this.scene.add(this.roofs);
    this.leaves = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.85, 1),
      this.mat("#568575"),
      2048,
    );
    this.leaves.count = 0;
    this.leaves.castShadow = true;
    this.leaves.frustumCulled = false;
    this.scene.add(this.leaves);
    this.windows = new T.InstancedMesh(this.geo, this.mat("#fff0c3"), 4096);
    this.windows.count = 0;
    this.windows.frustumCulled = false;
    this.scene.add(this.windows);
  }
  setState(s) {
    const previous = this.state?.blocks.length || 0;
    this.state = s;
    this.drawBlocks(s.blocks);
    const g = s.ghost,
      info = TYPES[s.queue[g.choice]];
    this.ghost.scale.set(...info.size);
    this.ghost.position.set(
      g.x,
      s.mode === "torre"
        ? s.height + info.size[1] / 2 + 0.35
        : info.size[1] / 2,
      g.z,
    );
    this.ghost.rotation.y = (g.rotation * Math.PI) / 2;
    this.target.position.set(g.x, 0.08, g.z);
    this.ghost.visible = s.status === "jogando";
    this.target.visible = s.status === "jogando";
    if (s.blocks.length > previous && !this.reduced)
      this.burst(s.blocks.at(-1).p);
  }
  drawBlocks(blocks) {
    const counts = {};
    let roof = 0,
      leaf = 0,
      win = 0;
    for (const b of blocks) {
      const info = TYPES[b.type];
      if (!info) continue;
      let n = counts[b.type] || 0;
      if (n >= 2048) continue;
      counts[b.type] = n + 1;
      this.tmp.position.set(...b.p);
      this.tmp.quaternion.set(...b.q);
      this.tmp.scale.set(...info.size);
      this.tmp.updateMatrix();
      this.instances[b.type].setMatrixAt(n, this.tmp.matrix);
      if (b.type === "casa") {
        this.tmp.position.y = b.p[1] + 0.85;
        this.tmp.rotation.set(0, Math.PI / 4, 0);
        this.tmp.scale.set(1, 1, 1);
        this.tmp.updateMatrix();
        this.roofs.setMatrixAt(roof++, this.tmp.matrix);
        for (const dx of [-0.32, 0.32]) {
          this.tmp.position.set(b.p[0] + dx, b.p[1] + 0.05, b.p[2] + 0.711);
          this.tmp.rotation.set(0, 0, 0);
          this.tmp.scale.set(0.22, 0.28, 0.025);
          this.tmp.updateMatrix();
          this.windows.setMatrixAt(win++, this.tmp.matrix);
        }
      }
      if (b.type === "arvore") {
        this.tmp.position.y = b.p[1] + 1.1;
        this.tmp.scale.set(1, 1.4, 1);
        this.tmp.updateMatrix();
        this.leaves.setMatrixAt(leaf++, this.tmp.matrix);
      }
    }
    for (const [type, mesh] of Object.entries(this.instances)) {
      mesh.count = counts[type] || 0;
      this.uploadInstances(mesh);
    }
    for (const [mesh, count] of [
      [this.roofs, roof],
      [this.leaves, leaf],
      [this.windows, win],
    ]) {
      mesh.count = count;
      this.uploadInstances(mesh);
    }
  }
  uploadInstances(mesh) {
    // Upload only occupied transforms, not the capacity of a whole district.
    const matrix = mesh.instanceMatrix;
    matrix.clearUpdateRanges();
    if (mesh.count) {
      matrix.addUpdateRange(0, mesh.count * 16);
      matrix.needsUpdate = true;
    }
  }
  setFrame(bodies) {
    if (!this.state || !bodies.length) return;
    const m = new Map(bodies.map((b) => [b.id, b]));
    this.drawBlocks(this.state.blocks.map((b) => ({ ...b, ...m.get(b.id) })));
  }
  preview(x, z) {
    if (!this.state) return;
    this.ghost.position.x = x;
    this.ghost.position.z = z;
    this.target.position.x = x;
    this.target.position.z = z;
  }
  setTheme(theme) {
    this.grass.material = this.mat(theme === "natal" ? "#e6eade" : "#bac69b");
    this.environmentTops.material = this.mat(
      theme === "natal" ? "#8ca393" : "#6b9680",
    );
  }
  recenter() {
    this.controls.target.set(0, Math.min(8, (this.state?.height || 2) / 2), 0);
    this.camera.position.set(17, 15, 21);
    this.controls.update();
  }
  pointer() {
    const ray = new T.Raycaster(),
      pointer = new T.Vector2(),
      plane = new T.Plane(new T.Vector3(0, 1, 0), 0),
      hit = new T.Vector3();
    let start = null,
      press = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
      press = setTimeout(() => this.onPing?.(), 700);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (start && Math.hypot(start.x - e.clientX, start.y - e.clientY) > 8)
        clearTimeout(press);
    });
    this.canvas.addEventListener("pointerup", (e) => {
      clearTimeout(press);
      if (
        !start ||
        Date.now() - start.t > 500 ||
        Math.hypot(start.x - e.clientX, start.y - e.clientY) > 8
      )
        return;
      const r = this.canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, this.camera);
      if (ray.ray.intersectPlane(plane, hit))
        this.onMove(Math.round(hit.x * 2) / 2, Math.round(hit.z * 2) / 2);
    });
  }
  burst(p) {
    const mesh = new T.InstancedMesh(
      new T.BoxGeometry(0.08, 0.08, 0.08),
      this.mat("#f5ce81"),
      12,
    );
    this.scene.add(mesh);
    this.bursts.push({ mesh, p: [...p], start: performance.now() });
  }
  updateAnimations(now) {
    for (const b of this.bursts) {
      const t = (now - b.start) / 700;
      if (t > 1) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        continue;
      }
      for (let i = 0; i < 12; i++) {
        const a = i * 2.399;
        this.tmp.position.set(
          b.p[0] + Math.cos(a) * t * 1.6,
          b.p[1] + Math.sin(t * Math.PI) * 0.8,
          b.p[2] + Math.sin(a) * t * 1.6,
        );
        this.tmp.scale.setScalar(1 - t);
        this.tmp.updateMatrix();
        b.mesh.setMatrixAt(i, this.tmp.matrix);
      }
      b.mesh.instanceMatrix.needsUpdate = true;
    }
    this.bursts = this.bursts.filter((b) => now - b.start < 700);
  }
  fit() {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / Math.max(1, rect.height);
    this.camera.updateProjectionMatrix();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
