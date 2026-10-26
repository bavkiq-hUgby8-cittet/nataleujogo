import { readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const files = [
  "jogar.html",
  "style.css",
  ...(await readdir("js"))
    .filter((f) => !["fisica.js", "fisica.worker.js"].includes(f))
    .map((f) => "js/" + f),
  "vendor/three.js",
  "vendor/OrbitControls.js",
  "vendor/RoundedBoxGeometry.js",
  "vendor/firebase.js",
  "vendor/qrcode.min.js",
];
const rows = [];
for (const path of files) {
  const data = await readFile(path);
  rows.push({ path, bytes: data.length, gzip: gzipSync(data).length });
}
const initial = rows.reduce((s, r) => s + r.gzip, 0),
  physics = gzipSync(await readFile("vendor/cannon-es.js")).length;
const report = {
  initialGzipBytes: initial,
  physicsLazyGzipBytes: physics,
  totalGzipBytes: initial + physics,
  initialLimit: 3000000,
  totalLimit: 8000000,
  pass: initial <= 3000000 && initial + physics <= 8000000,
  files: rows,
};
await writeFile("docs/download.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    initialGzipBytes: initial,
    physicsLazyGzipBytes: physics,
    pass: report.pass,
  }),
);
if (!report.pass) process.exitCode = 1;
