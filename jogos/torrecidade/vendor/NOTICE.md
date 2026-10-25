# Third-party runtime dependencies

- Three.js 0.160.1, including OrbitControls and RoundedBoxGeometry — MIT (LICENSE-three).
- Cannon ES 0.20.0 — MIT (LICENSE-cannon-es).
- Firebase JavaScript SDK 10.14.1 — Apache 2.0 (LICENSE-firebase). Bundled modular Auth/RTDB/App only. Original copyright notices are retained in firebase.js.
- QRCode.js from the family's karaoke/vendor/qrcode.min.js — MIT; David Shim, source notice retained.

These files are vendored so production needs neither a build nor a third-party CDN. Upstream formatting is preserved where copied directly. Regenerate through scripts/vendor.mjs when deliberately upgrading versions, then rerun determinism, security, network and visual tests.
