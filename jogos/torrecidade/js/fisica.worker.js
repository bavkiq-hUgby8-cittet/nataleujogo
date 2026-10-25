import { Physics } from "./fisica.js";
const STEP = 1000 / 60;
let sim = null,
  timer = null,
  tick = 0,
  accumulator = 0,
  last = 0;
self.onmessage = ({ data }) => {
  if (data.type === "init") {
    clearInterval(timer);
    sim = new Physics(data.state);
    last = performance.now();
    accumulator = 0;
    timer = setInterval(() => {
      const now = performance.now();
      accumulator = Math.min(5 * STEP, accumulator + now - last);
      last = now;
      while (accumulator >= STEP) {
        sim.step(Date.now());
        tick++;
        accumulator -= STEP;
        if (tick % 6 === 0) postMessage({ bodies: sim.snapshot(), tick });
      }
    }, 8);
  }
  if (data.type === "sync") sim?.sync(data.state);
  if (data.type === "stop") {
    clearInterval(timer);
    close();
  }
};
