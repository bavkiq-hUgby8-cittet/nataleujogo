import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
await mkdir("vendor", { recursive: true });
for (const [source, target] of [
  ["three/build/three.module.js", "three.js"],
  ["three/examples/jsm/controls/OrbitControls.js", "OrbitControls.js"],
  [
    "three/examples/jsm/geometries/RoundedBoxGeometry.js",
    "RoundedBoxGeometry.js",
  ],
  ["cannon-es/dist/cannon-es.js", "cannon-es.js"],
])
  await copyFile("node_modules/" + source, "vendor/" + target);
await build({
  stdin: {
    contents: `export {initializeApp,getApps,getApp} from 'firebase/app';export {getAuth,initializeAuth,indexedDBLocalPersistence,browserLocalPersistence,signInAnonymously,connectAuthEmulator,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut} from 'firebase/auth';export {getDatabase,ref,onValue,get,set,update,runTransaction,onDisconnect,connectDatabaseEmulator,serverTimestamp,goOffline,goOnline} from 'firebase/database';`,
    resolveDir: process.cwd(),
  },
  outfile: "vendor/firebase.js",
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "eof",
});
for (const name of ["three", "cannon-es", "firebase"]) {
  try {
    await copyFile(`node_modules/${name}/LICENSE`, `vendor/LICENSE-${name}`);
  } catch {}
}
console.log("Pinned runtime files ready; serving needs no build.");
