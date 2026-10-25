export const LEVELS = {
  baixo: { ratio: 0.8, shadow: 0 },
  medio: { ratio: 1, shadow: 512 },
  alto: { ratio: 1.5, shadow: 1024 },
  ultra: { ratio: 2, shadow: 1024 },
};
export class Quality {
  constructor(renderer, light, tv = false) {
    this.renderer = renderer;
    this.light = light;
    this.manual = false;
    this.level =
      (navigator.deviceMemory || 4) < 4 ? "baixo" : tv ? "alto" : "medio";
    this.frames = [];
    this.samples = [];
    this.last = performance.now();
    this.measureStart = this.last;
    this.set(this.level);
  }
  set(level, manual = false) {
    this.level = level;
    this.manual = manual;
    const q = LEVELS[level];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.ratio));
    this.renderer.shadowMap.enabled = q.shadow > 0;
    this.light.shadow.mapSize.set(q.shadow || 512, q.shadow || 512);
    this.light.shadow.map?.dispose();
    this.light.shadow.map = null;
    this.renderer.shadowMap.needsUpdate = true;
  }
  frame(now) {
    const delta = now - this.last;
    this.last = now;
    if (delta > 0 && delta < 1000) this.frames.push(delta);
    if (now - this.measureStart < 2000) return;
    const sorted = [...this.frames].sort((a, b) => a - b),
      avg =
        this.frames.reduce((a, b) => a + b, 0) /
        Math.max(1, this.frames.length);
    this.metrics = {
      fps: Math.round(1000 / avg),
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      quality: this.level,
    };
    this.samples.push(this.metrics);
    if (this.samples.length > 60) this.samples.shift();
    if (!this.manual) {
      const levels = Object.keys(LEVELS),
        i = levels.indexOf(this.level);
      if (this.metrics.fps < 32 && i > 0) this.set(levels[i - 1]);
      else if (
        this.metrics.fps > 57 &&
        i < 2 &&
        this.samples.slice(-3).every((s) => s.fps > 57) &&
        this.samples.length >= 3
      )
        this.set(levels[i + 1]);
    }
    this.frames = [];
    this.measureStart = now;
  }
}
